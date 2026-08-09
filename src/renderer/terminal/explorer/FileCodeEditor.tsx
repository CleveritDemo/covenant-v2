import React, { useEffect, useMemo, useRef, useState } from 'react'
import { defaultKeymap, history, historyKeymap, indentWithTab, selectAll } from '@codemirror/commands'
import { Compartment, EditorState, Prec, type Extension } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { autocompletion } from '@codemirror/autocomplete'
import {
  bracketMatching,
  foldAll,
  foldGutter,
  foldKeymap,
  indentOnInput,
  unfoldAll,
} from '@codemirror/language'
import {
  highlightSelectionMatches,
  openSearchPanel,
  search,
  searchKeymap,
  selectSelectionMatches,
} from '@codemirror/search'
import { useT } from '@i18n/useT'
import { getTheme } from '../../../themes/presets'
import { createCodeMirrorTheme } from '../../../themes/codeMirrorTheme'
import { applyLspDiagnostics, lspCompletionSource, lspExtensions, type LspHost } from '../../lsp/cm6'
import { lspManager, onCodeIntelChange, type LspDoc, type LspDocStatus } from '../../lsp/manager'
import { lspRangeToCm } from '../../lsp/positions'
import type { LspEdit } from '../../lsp/edits'
import { languageExtensionForPath } from './languageFromPath'
import { FileEditorContextMenu } from './FileEditorContextMenu'
import '../../lsp/lsp.css'

interface FileCodeEditorProps {
  filePath: string
  themeId: string
  content: string
  readOnly?: boolean
  /** Sesión dueña del explorador; el main resuelve las rutas contra su raíz. */
  sessionId?: string
  /** Fuerza reintentar el arranque LSP (tras conceder permiso o instalar). */
  lspRetryToken?: number
  /**
   * Salto a una línea 1-based (go-to-definition, panel de referencias). Lleva
   * `nonce` porque saltar dos veces a la MISMA línea es el caso normal —con un
   * número pelado el efecto no volvería a dispararse y el segundo click no haría
   * nada.
   */
  gotoTarget?: { line: number; nonce: number }
  onChange: (content: string) => void
  onSave: () => void
  onLspStatusChange?: (status: LspDocStatus) => void
  /** Abre otro archivo del proyecto (ruta relativa a la raíz de la sesión). */
  onOpenFile?: (relPath: string, line: number) => void
}

export const FileCodeEditor: React.FC<FileCodeEditorProps> = ({
  filePath,
  themeId,
  content,
  readOnly = false,
  sessionId,
  lspRetryToken = 0,
  gotoTarget,
  onChange,
  onSave,
  onLspStatusChange,
  onOpenFile,
}) => {
  const { t } = useT()
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onSaveRef = useRef(onSave)
  const onLspStatusChangeRef = useRef(onLspStatusChange)
  const onOpenFileRef = useRef(onOpenFile)
  const suppressUpdateRef = useRef(false)
  const [menu, setMenu] = useState<{ x: number; y: number; hasSelection: boolean } | null>(null)

  // Estado LSP del archivo abierto. `lspDocRef` es null mientras el server no
  // esté listo, y todas las extensiones de cm6 hacen no-op en ese caso.
  const lspDocRef = useRef<LspDoc | null>(null)
  const completionCompartment = useRef(new Compartment()).current
  // Cambiar el toggle de code intelligence tiene que apagar la sesión en curso,
  // no sólo la próxima: este contador re-dispara el efecto LSP.
  const [codeIntelToken, setCodeIntelToken] = useState(0)

  onChangeRef.current = onChange
  onSaveRef.current = onSave
  onLspStatusChangeRef.current = onLspStatusChange
  onOpenFileRef.current = onOpenFile

  const lspHost = useMemo<LspHost>(() => ({
    doc: () => lspDocRef.current,
    activeUri: () => lspDocRef.current?.uri ?? null,
    openFile: (absPath, line) => {
      const doc = lspDocRef.current
      if (!doc) return
      const prefix = doc.sessionRoot.endsWith('/') ? doc.sessionRoot : `${doc.sessionRoot}/`
      // Un destino fuera de la raíz de la sesión (dependencia del sistema, otro
      // repo del monorepo) no se puede abrir en este explorador: se ignora en vez
      // de abrir algo que el panel no sabe leer.
      if (!absPath.startsWith(prefix)) return
      onOpenFileRef.current?.(absPath.slice(prefix.length), line)
    },
    applyToActiveView: (edits: LspEdit[]) => {
      const view = viewRef.current
      if (!view) return
      // Todos los rangos están en coordenadas del MISMO documento, así que se
      // despachan juntos: CM6 los resuelve como un solo ChangeSet.
      const changes = edits
        .map(e => {
          const { from, to } = lspRangeToCm(view.state.doc, e.range)
          return { from, to, insert: e.newText }
        })
        .sort((a, b) => a.from - b.from)
      view.dispatch({ changes })
    },
    labels: {
      referencesCount: n => t('lsp.references.count', { count: n }),
      referencesMore: n => t('lsp.references.more', { count: n }),
      close: t('lsp.close'),
      cancel: t('common.cancel'),
      apply: t('lsp.rename.apply'),
      renameTouchesFiles: n => t('lsp.rename.touchesFiles', { count: n }),
    },
  }), [t])

  // Textos del panel de búsqueda nativo de cm6. Se capturan al montar: cambiar de
  // idioma con un archivo abierto es raro y basta con reabrirlo.
  const searchPhrases = useMemo(() => ({
    Find: t('fileExplorer.editor.search.find'),
    Replace: t('fileExplorer.editor.search.replaceField'),
    next: t('fileExplorer.editor.search.next'),
    previous: t('fileExplorer.editor.search.previous'),
    all: t('fileExplorer.editor.search.all'),
    'match case': t('fileExplorer.editor.search.matchCase'),
    regexp: t('fileExplorer.editor.search.regexp'),
    'by word': t('fileExplorer.editor.search.byWord'),
    replace: t('fileExplorer.editor.search.replace'),
    'replace all': t('fileExplorer.editor.search.replaceAll'),
    close: t('fileExplorer.editor.search.close'),
    'current match': t('fileExplorer.editor.search.currentMatch'),
    'on line': t('fileExplorer.editor.search.onLine'),
    'Go to line': t('fileExplorer.editor.search.gotoLine'),
    go: t('fileExplorer.editor.search.go'),
  }), [t])

  /** Ejecuta un comando de cm6 sobre la vista viva y le devuelve el foco. */
  const runOnView = (fn: (view: EditorView) => unknown): void => {
    const view = viewRef.current
    if (!view) return
    fn(view)
    view.focus()
  }

  const selectedText = (view: EditorView): string => {
    const { from, to } = view.state.selection.main
    return view.state.sliceDoc(from, to)
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const appTheme = getTheme(themeId)
    const saveKeymap = Prec.highest(
      keymap.of([
        {
          key: 'Mod-s',
          run: () => {
            if (readOnly) return false
            onSaveRef.current()
            return true
          },
        },
      ]),
    )

    const extensions: Extension[] = [
      lineNumbers(),
      foldGutter(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      history(),
      indentOnInput(),
      bracketMatching(),
      // Panel de búsqueda/reemplazo nativo de cm6: next/previous/all, match case,
      // regexp, by word y replace all salen de aquí.
      search({ top: true }),
      highlightSelectionMatches(),
      EditorState.phrases.of(searchPhrases),
      EditorView.lineWrapping,
      EditorState.tabSize.of(2),
      EditorView.updateListener.of(update => {
        if (update.docChanged) {
          // El sync con el server va SIEMPRE, incluso durante una recarga desde
          // disco: el documento del server tiene que seguir al buffer o los
          // diagnósticos quedan apuntando a offsets que ya no existen.
          lspDocRef.current?.changeIncremental(update)
          if (!suppressUpdateRef.current) onChangeRef.current(update.state.doc.toString())
        }
      }),
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, ...foldKeymap, indentWithTab]),
      saveKeymap,
      ...languageExtensionForPath(filePath),
      // El compartimento arranca sin fuente semántica y se reconfigura cuando el
      // `LspDoc` queda listo, así el completado degrada en vez de desaparecer.
      completionCompartment.of(autocompletion()),
      lspExtensions(lspHost),
      createCodeMirrorTheme(appTheme),
    ]

    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true))
    }

    const state = EditorState.create({
      doc: content,
      extensions,
    })

    const view = new EditorView({ state, parent: el })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // Remonta al cambiar archivo, tema o modo sólo-lectura
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath, themeId, readOnly])

  // Ciclo de vida del documento LSP. Comparte las deps del efecto de arriba
  // porque el `LspDoc` está atado a la vista concreta que ese efecto creó: si la
  // vista se rehace (cambio de tema) hay que re-suscribir diagnósticos y volver a
  // configurar el compartimento de completado sobre la vista nueva.
  useEffect(() => {
    const view = viewRef.current
    if (!view || !sessionId) return

    let cancelled = false
    let unsubDiagnostics: (() => void) | null = null

    const run = async (): Promise<void> => {
      const status = await lspManager.status(filePath)
      if (cancelled) return
      onLspStatusChangeRef.current?.(status)
      if (status.kind !== 'ready') return

      onLspStatusChangeRef.current?.({ kind: 'starting' })
      try {
        const doc = await lspManager.open(sessionId, filePath, view.state.doc.toString())
        if (cancelled) {
          doc.close()
          return
        }
        lspDocRef.current = doc
        unsubDiagnostics = doc.onDiagnostics(diags => {
          if (viewRef.current === view) applyLspDiagnostics(view, diags)
        })
        view.dispatch({
          effects: completionCompartment.reconfigure(
            autocompletion({ override: [lspCompletionSource(lspHost)] }),
          ),
        })
        onLspStatusChangeRef.current?.({ kind: 'ready' })
      } catch (e) {
        if (!cancelled) onLspStatusChangeRef.current?.({ kind: 'error', message: String(e) })
      }
    }
    void run()

    return () => {
      cancelled = true
      unsubDiagnostics?.()
      lspDocRef.current?.close()
      lspDocRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath, themeId, readOnly, sessionId, lspRetryToken, codeIntelToken])

  useEffect(() => onCodeIntelChange(() => setCodeIntelToken(n => n + 1)), [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current === content) return
    suppressUpdateRef.current = true
    view.dispatch({
      changes: { from: 0, to: current.length, insert: content },
    })
    suppressUpdateRef.current = false
  }, [content])

  useEffect(() => {
    const view = viewRef.current
    if (!view || !gotoTarget) return
    const line = view.state.doc.line(Math.min(Math.max(1, gotoTarget.line), view.state.doc.lines))
    view.dispatch({
      selection: { anchor: line.from },
      effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
    })
    view.focus()
  }, [gotoTarget, filePath])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.type !== 'keydown') return
      if (!e.metaKey && !e.ctrlKey) return
      if (e.altKey) return

      const view = viewRef.current
      if (!view?.dom.contains(document.activeElement)) return

      // ⌘F se captura aquí, antes que cualquier handler global de la app, y abre
      // el panel nativo de cm6 en vez de dejar que lo robe otra búsqueda.
      if (!e.shiftKey && (e.key === 'f' || e.key === 'F' || e.code === 'KeyF')) {
        e.preventDefault()
        e.stopPropagation()
        openSearchPanel(view)
        return
      }

      if (e.shiftKey || (e.key !== 's' && e.key !== 'S' && e.code !== 'KeyS')) return
      if (readOnly) return
      e.preventDefault()
      e.stopPropagation()
      onSaveRef.current()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [readOnly])

  return (
    <>
      <div
        className="file-code-editor"
        ref={containerRef}
        aria-label={t('fileExplorer.editor.codeEditorAria')}
        onContextMenu={e => {
          const view = viewRef.current
          if (!view) return
          e.preventDefault()
          setMenu({ x: e.clientX, y: e.clientY, hasSelection: !view.state.selection.main.empty })
        }}
      />
      {menu && (
        <FileEditorContextMenu
          x={menu.x}
          y={menu.y}
          hasSelection={menu.hasSelection}
          readOnly={readOnly}
          onCut={() => runOnView(view => {
            const { from, to } = view.state.selection.main
            void navigator.clipboard.writeText(selectedText(view)).catch(() => {})
            view.dispatch({ changes: { from, to, insert: '' } })
          })}
          onCopy={() => runOnView(view => {
            void navigator.clipboard.writeText(selectedText(view)).catch(() => {})
          })}
          onPaste={() => runOnView(view => {
            void navigator.clipboard.readText().then(text => {
              if (!text || viewRef.current !== view) return
              const { from, to } = view.state.selection.main
              view.dispatch({
                changes: { from, to, insert: text },
                selection: { anchor: from + text.length },
              })
            }).catch(() => {})
          })}
          onSelectAll={() => runOnView(selectAll)}
          onSelectOccurrences={() => runOnView(selectSelectionMatches)}
          onFind={() => runOnView(openSearchPanel)}
          onFoldAll={() => runOnView(foldAll)}
          onUnfoldAll={() => runOnView(unfoldAll)}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  )
}
