import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { EditorState, Prec, type Extension } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { bracketMatching, indentOnInput } from '@codemirror/language'
import { useT } from '@i18n/useT'
import { getTheme } from '../../../themes/presets'
import { createCodeMirrorTheme } from '../../../themes/codeMirrorTheme'
import { languageExtensionForPath } from './languageFromPath'
import {
  countSearchMatches,
  fileEditorSearchExtension,
  fileFindFirst,
  fileFindNext,
  fileFindPrevious,
  searchQueryFromTerm,
  setFileSearchQuery,
} from './fileEditorSearch'

export interface FileCodeEditorHandle {
  findNext: () => boolean
  findPrevious: () => boolean
}

interface FileCodeEditorProps {
  filePath: string
  themeId: string
  content: string
  findQuery?: string
  readOnly?: boolean
  onChange: (content: string) => void
  onSave: () => void
  onMatchCountChange?: (count: number) => void
  onFindFocusRequest?: () => void
}

export const FileCodeEditor = forwardRef<FileCodeEditorHandle, FileCodeEditorProps>(function FileCodeEditor(
  {
    filePath,
    themeId,
    content,
    findQuery = '',
    readOnly = false,
    onChange,
    onSave,
    onMatchCountChange,
    onFindFocusRequest,
  },
  ref,
) {
  const { t } = useT()
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onSaveRef = useRef(onSave)
  const onMatchCountChangeRef = useRef(onMatchCountChange)
  const onFindFocusRequestRef = useRef(onFindFocusRequest)
  const findQueryRef = useRef(findQuery)
  const suppressUpdateRef = useRef(false)

  onChangeRef.current = onChange
  onSaveRef.current = onSave
  onMatchCountChangeRef.current = onMatchCountChange
  onFindFocusRequestRef.current = onFindFocusRequest
  findQueryRef.current = findQuery

  useImperativeHandle(ref, () => ({
    findNext: () => {
      const view = viewRef.current
      if (!view) return false
      return fileFindNext(view)
    },
    findPrevious: () => {
      const view = viewRef.current
      if (!view) return false
      return fileFindPrevious(view)
    },
  }))

  const applySearchQuery = (view: EditorView, term: string, scrollToFirst: boolean): void => {
    const query = searchQueryFromTerm(term)
    view.dispatch({ effects: setFileSearchQuery.of(query) })
    onMatchCountChangeRef.current?.(countSearchMatches(view.state, query))
    if (scrollToFirst && term && query.valid) {
      queueMicrotask(() => {
        if (viewRef.current === view) fileFindFirst(view)
      })
    }
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
      highlightActiveLine(),
      highlightActiveLineGutter(),
      history(),
      indentOnInput(),
      bracketMatching(),
      ...fileEditorSearchExtension(),
      EditorView.lineWrapping,
      EditorState.tabSize.of(2),
      EditorView.updateListener.of(update => {
        if (update.docChanged && !suppressUpdateRef.current) {
          onChangeRef.current(update.state.doc.toString())
          const query = searchQueryFromTerm(findQueryRef.current.trim())
          onMatchCountChangeRef.current?.(countSearchMatches(update.state, query))
        }
      }),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      saveKeymap,
      ...languageExtensionForPath(filePath),
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

    applySearchQuery(view, findQueryRef.current.trim(), true)

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // Remount when file, theme or read-only mode changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath, themeId, readOnly])

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
    if (!view) return
    applySearchQuery(view, findQuery.trim(), true)
  }, [findQuery])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.type !== 'keydown') return
      if (!e.metaKey && !e.ctrlKey) return
      if (e.altKey) return

      const view = viewRef.current
      if (!view?.dom.contains(document.activeElement)) return

      if (!e.shiftKey && (e.key === 'f' || e.key === 'F' || e.code === 'KeyF')) {
        e.preventDefault()
        e.stopPropagation()
        onFindFocusRequestRef.current?.()
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

  return <div className="file-code-editor" ref={containerRef} aria-label={t('fileExplorer.editor.codeEditorAria')} />
})
