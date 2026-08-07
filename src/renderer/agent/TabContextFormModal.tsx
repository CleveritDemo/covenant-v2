import React, { useEffect, useRef, useState } from 'react'
import type { TabContext, TabContextKind } from '@shared/tabContext'
import {
  applyCanonicalContextIdentity,
  contextDefinitionKey,
  normalizeContextFileName,
  suggestSymbolsIdentity,
} from '@shared/tabContext'
import { defaultColorForKind, defaultIconForKind } from '@shared/tabContextAppearance'
import { PROJECT_DIR } from '@shared/projectDir'
import {
  rememberWorkspaceContextBody,
  workspaceContextBody,
  workspaceContextUpsertPayload,
} from '@shared/orgWorkspaceContent'
import { useT } from '@i18n/useT'
import { Button } from '../components/ui'
import { TerminalModal } from '../components/TerminalModal'
import { TabContextsEditor, type PreviewState } from './TabContextsEditor'
import { getCovenantApi, hasCovenantWorkspaceContentApi } from '../covenantApi'

export type TabContextFormMode = 'create' | 'edit'

interface Props {
  open: boolean
  mode: TabContextFormMode
  /** Contexto a editar; en create se ignora. */
  context: TabContext | null
  contexts: TabContext[]
  cwd: string
  /** Si está, persiste vía API de workspace org en lugar del disco. */
  orgWorkspace?: { slug: string; workspaceId: string }
  onRefresh: () => void
  onClose: () => void
}

function emptyContext(kind: TabContextKind = 'folderTree'): TabContext {
  return applyCanonicalContextIdentity({
    id: '',
    name: '',
    fileName: '',
    kind,
    icon: defaultIconForKind(kind),
    color: defaultColorForKind(kind),
    ...(kind === 'symbols' ? { symbolKinds: ['class', 'method'] as const } : {}),
  })
}

function comparable(value: string): string {
  return value.trim().normalize('NFKC').toLocaleLowerCase()
}

function contextDefinition(context: TabContext): string | null {
  return contextDefinitionKey(context)
}

export const TabContextFormModal: React.FC<Props> = ({
  open,
  mode,
  context,
  contexts,
  cwd,
  orgWorkspace,
  onRefresh,
  onClose,
}) => {
  const { t } = useT()
  const [draft, setDraft] = useState<TabContext | null>(null)
  const [preview, setPreview] = useState<PreviewState>({ status: 'idle' })
  const [notesContent, setNotesContent] = useState('')
  const [resolvedCwdLabel, setResolvedCwdLabel] = useState('')
  // Refs para dismiss/backdrop: evita estado stale en el handler async.
  const draftRef = useRef(draft)
  const notesContentRef = useRef(notesContent)
  const modeRef = useRef(mode)
  const contextRef = useRef(context)
  const contextsRef = useRef(contexts)
  // handleDismiss corre en el handler de Esc/backdrop, fuera del render, así
  // que no puede leer `isDirty` (variable del closure, quedaría stale); se
  // asigna a este ref justo después de calcularla más abajo.
  const isDirtyRef = useRef(false)
  // Valor del cuerpo de la nota cuando se cargó (o '' en `create`), para
  // detectar ediciones del textarea: el cuerpo de `notes` no vive en `draft`.
  const notesInitialContentRef = useRef('')
  draftRef.current = draft
  notesContentRef.current = notesContent
  modeRef.current = mode
  contextRef.current = context
  contextsRef.current = contexts

  const resolveCwd = async (): Promise<string> => {
    const resolved = (cwd ?? '').trim()
    setResolvedCwdLabel(resolved)
    return resolved
  }

  const loadHostOwnedContent = async (target: TabContext): Promise<void> => {
    if (target.kind !== 'notes' && target.kind !== 'changelog' && target.kind !== 'agentResult') {
      return
    }
    if (orgWorkspace && target.kind === 'notes') {
      const body = workspaceContextBody(target.id)
      setNotesContent(body)
      notesInitialContentRef.current = body
      return
    }
    const workingCwd = await resolveCwd()
    if (!workingCwd) return
    try {
      const result = await window.api.previewTabContext({ context: target, cwd: workingCwd })
      if (target.kind === 'notes' && result.ok) {
        const body = result.notesContent ?? result.content
        setNotesContent(body)
        notesInitialContentRef.current = body
        return
      }
      if (!result.ok) {
        setPreview({ status: 'error', message: result.error ?? t('tabContexts.previewError') })
        return
      }
      setPreview(result.content.trim()
        ? {
            status: 'success',
            content: result.content,
            filePath: result.filePath
              ?? (target.kind === 'agentResult'
                ? `${PROJECT_DIR}/${target.fileName}`
                : `${PROJECT_DIR}/changelog.md`),
          }
        : { status: 'empty', filePath: result.filePath })
    } catch (error) {
      if (target.kind === 'changelog' || target.kind === 'agentResult') {
        setPreview({
          status: 'error',
          message: error instanceof Error ? error.message : t('tabContexts.previewError'),
        })
      }
    }
  }

  useEffect(() => {
    if (!open) {
      setDraft(null)
      setPreview({ status: 'idle' })
      setNotesContent('')
      notesInitialContentRef.current = ''
      setResolvedCwdLabel('')
      return
    }
    const initial = mode === 'edit' && context ? { ...context } : emptyContext()
    setDraft(initial)
    setPreview(
      initial.kind === 'changelog' || initial.kind === 'agentResult'
        ? { status: 'loading' }
        : { status: 'idle' },
    )
    setNotesContent('')
    notesInitialContentRef.current = ''
    void loadHostOwnedContent(initial)
    // Seed once per open session; avoid re-seeding on every contexts refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, context?.id])

  const update = (patch: Partial<TabContext>): void => {
    setDraft(current => {
      if (!current) return current
      let next: TabContext = { ...current, ...patch }
      if (
        current.kind === 'symbols'
        && Object.prototype.hasOwnProperty.call(patch, 'rootPath')
        && patch.rootPath !== current.rootPath
      ) {
        const suggested = suggestSymbolsIdentity(patch.rootPath)
        const currentDerived = normalizeContextFileName(current.name || 'context')
        const shouldRename = !current.name.trim()
          || /^classes(\s|·|-)/i.test(current.name.trim())
          || current.fileName === 'context.md'
          || current.fileName === currentDerived
        if (shouldRename) {
          next = {
            ...next,
            name: suggested.name,
            fileName: normalizeContextFileName(suggested.name || suggested.fileStem),
          }
        }
      }
      return next
    })
    // No se invalida la vista previa aquí: con el panel permanente, tocar
    // cualquier campo (color, symbolKind, etc.) borraría un contenido bueno
    // para mostrar "Escribe un nombre..." hasta que llegue el debounce. El
    // propio debounce se encarga de reemplazarla cuando corresponda.
  }

  const readOnlyChangelog = draft?.kind === 'changelog' &&
    contexts.some(item => item.id === draft.id)
  const readOnlyAgentResult = draft?.kind === 'agentResult'

  // Comparación por valor contra el contexto de partida. En `create` cualquier
  // nombre escrito ya cuenta como cambio pendiente. Para `notes` el cuerpo no
  // vive en `draft` sino en `notesContent`; se compara contra el valor con el
  // que se abrió el modal (o '' en `create`) en vez de solo "no está vacío",
  // para no dejar sin aviso la edición del cuerpo de una nota ya existente.
  // Los contextos de solo lectura (changelog ya guardado, agentResult) nunca
  // están "sucios": no hay nada en ellos que se pueda guardar desde aquí.
  const initial = mode === 'edit' && context ? context : null
  const isDirty = Boolean(draft) && !readOnlyChangelog && !readOnlyAgentResult && (
    (initial
      ? JSON.stringify(draft) !== JSON.stringify(initial)
      : Boolean((draft?.name ?? '').trim()))
    || (draft?.kind === 'notes' && notesContent.trim() !== notesInitialContentRef.current.trim())
  )
  isDirtyRef.current = isDirty

  const duplicateMessage = (() => {
    if (!draft) return ''
    const others = contexts.filter(item => item.id !== draft.id)
    const fileName = normalizeContextFileName(
      draft.name || draft.fileName,
      draft.kind === 'changelog' ? 'changelog' : 'context',
    )
    if (others.some(item => comparable(item.name ?? '') === comparable(draft.name ?? ''))) {
      return t('tabContexts.nameDuplicate')
    }
    if (others.some(item =>
      normalizeContextFileName(item.fileName || item.name, item.id).toLowerCase() === fileName.toLowerCase()
    )) {
      return t('tabContexts.fileNameDuplicate')
    }
    const definition = contextDefinition(draft)
    if (definition && others.some(item => contextDefinition(item) === definition)) {
      return t('tabContexts.fileNameDuplicate')
    }
    return ''
  })()

  const normalizeDraft = (current: TabContext): TabContext => applyCanonicalContextIdentity({
    ...current,
    name: (current.name ?? '').trim() || (current.kind === 'changelog' ? 'AI Changelog' : current.name),
    ...(current.rootPath?.trim()
      ? { rootPath: current.rootPath.trim() === '.' ? undefined : current.rootPath.trim() }
      : { rootPath: undefined }),
    ...(current.paths
      ? { paths: current.paths.map(path => (path ?? '').trim()).filter(Boolean) }
      : { paths: undefined }),
  })

  const computeDuplicateMessage = (current: TabContext): string => {
    const others = contextsRef.current.filter(item => item.id !== current.id)
    const fileName = normalizeContextFileName(
      current.name || current.fileName,
      current.kind === 'changelog' ? 'changelog' : 'context',
    )
    if (others.some(item => comparable(item.name ?? '') === comparable(current.name ?? ''))) {
      return t('tabContexts.nameDuplicate')
    }
    if (others.some(item =>
      normalizeContextFileName(item.fileName || item.name, item.id).toLowerCase() === fileName.toLowerCase()
    )) {
      return t('tabContexts.fileNameDuplicate')
    }
    const definition = contextDefinition(current)
    if (definition && others.some(item => contextDefinition(item) === definition)) {
      return t('tabContexts.fileNameDuplicate')
    }
    return ''
  }

  /** Persiste el draft actual. En éxito llama onClose; en fallo deja el modal abierto con error. */
  const save = async (): Promise<boolean> => {
    const current = draftRef.current
    if (!current) return false
    if (current.kind !== 'changelog' && !(current.name ?? '').trim()) return false
    const dup = computeDuplicateMessage(current)
    if (dup) {
      // El duplicado ya lo muestra el panel izquierdo (duplicateMessage); no
      // lo dupliquemos en el panel de salida, que es para errores de
      // materialización de verdad.
      return false
    }
    const normalized = normalizeDraft(current)

    if (orgWorkspace) {
      const covenant = getCovenantApi()
      if (!covenant || !hasCovenantWorkspaceContentApi(covenant)) {
        setPreview({ status: 'error', message: t('tabContexts.previewError') })
        return false
      }
      const body = normalized.kind === 'notes' ? (notesContentRef.current ?? '') : ''
      try {
        const result = await covenant.workspaceContextUpsert(
          orgWorkspace.slug,
          orgWorkspace.workspaceId,
          normalized.id,
          workspaceContextUpsertPayload(normalized, body),
        )
        if (!result.ok) {
          setPreview({
            status: 'error',
            message: result.error || t('tabContexts.previewError'),
          })
          return false
        }
        rememberWorkspaceContextBody(normalized.id, body)
        onRefresh()
        onClose()
        return true
      } catch (error) {
        setPreview({
          status: 'error',
          message: error instanceof Error ? error.message : t('tabContexts.previewError'),
        })
        return false
      }
    }

    const workingCwd = await resolveCwd()
    if (!workingCwd) {
      setPreview({ status: 'error', message: t('tabContexts.missingCwd') })
      return false
    }
    const editContext = contextRef.current
    const previousFileName = modeRef.current === 'edit' && editContext?.fileName
      && normalizeContextFileName(editContext.fileName) !== normalized.fileName
      ? editContext.fileName
      : undefined
    try {
      const result = await window.api.materializeTabContext({
        context: normalized,
        cwd: workingCwd,
        ...(normalized.kind === 'notes' ? { content: notesContentRef.current ?? '' } : {}),
        ...(previousFileName ? { previousFileName } : {}),
      })
      if (!result.ok) {
        setPreview({ status: 'error', message: result.error ?? t('tabContexts.previewError') })
        return false
      }
      onRefresh()
      onClose()
      return true
    } catch (error) {
      setPreview({
        status: 'error',
        message: error instanceof Error ? error.message : t('tabContexts.previewError'),
      })
      return false
    }
  }

  /**
   * Esc y clic fuera cierran solo si no hay nada que perder. Antes esto llamaba
   * a save(), un guardado que ningún botón anunciaba; y descartar en silencio
   * sería peor. Con cambios pendientes el modal se queda y el pie lo explica.
   */
  const handleDismiss = (): void => {
    if (!draftRef.current) {
      onClose()
      return
    }
    if (isDirtyRef.current) return
    onClose()
  }

  const loadPreview = async (): Promise<void> => {
    if (!draft) return
    // Si ya hay una vista previa buena en pantalla, no la tapemos con
    // "Generando…": mejor contenido momentáneamente desactualizado que un
    // parpadeo en cada tecla. Forma funcional para no leer un `preview`
    // obsoleto capturado por el closure del setTimeout del debounce.
    setPreview(current => (current.status === 'success' ? current : { status: 'loading' }))
    try {
      const workingCwd = await resolveCwd()
      if (!workingCwd) {
        setPreview({ status: 'error', message: t('tabContexts.missingCwd') })
        return
      }
      const result = await window.api.previewTabContext({
        context: draft,
        cwd: workingCwd,
        ...(draft.kind === 'notes' ? { content: notesContent ?? '' } : {}),
      })
      if (!result.ok) {
        setPreview({ status: 'error', message: result.error ?? t('tabContexts.previewError') })
        return
      }
      const content = (result.content ?? '').trim()
      if (!content) {
        setPreview({ status: 'empty', filePath: result.filePath })
        return
      }
      setPreview({
        status: 'success',
        content: result.content,
        filePath: result.filePath ?? `${PROJECT_DIR}/${normalizeContextFileName(draft.fileName || draft.name, draft.id)}`,
      })
    } catch (error) {
      setPreview({
        status: 'error',
        message: error instanceof Error ? error.message : t('tabContexts.previewError'),
      })
    }
  }

  // La vista previa ya no es un botón: se recalcula sola. El debounce evita
  // materializar `symbols` sobre un repo grande en cada tecla; por debajo,
  // materializationSignature ya devuelve el resultado memorizado si el mtime
  // no cambió.
  useEffect(() => {
    if (!open || !draft) return
    const timer = setTimeout(() => { void loadPreview() }, 400)
    return () => clearTimeout(timer)
    // loadPreview se redefine en cada render; dependemos del contenido, no de él.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draft, notesContent])

  const selectKind = (kind: TabContextKind): void => {
    if (!draft) return
    if (draft.kind === kind) return
    if (kind === 'changelog') {
      setDraft(emptyContext('changelog'))
    } else {
      const keepName = draft.kind === 'changelog' ? '' : draft.name
      const keepRoot = draft.rootPath
      const base = emptyContext(kind)
      if (kind === 'symbols') {
        const suggested = suggestSymbolsIdentity(keepRoot)
        setDraft(applyCanonicalContextIdentity({
          ...base,
          name: keepName.trim() || suggested.name,
          rootPath: keepRoot,
          symbolKinds: ['class', 'method'],
        }))
      } else if (kind === 'notes') {
        setDraft(applyCanonicalContextIdentity({
          ...base,
          name: keepName || 'Notes',
          fileName: normalizeContextFileName(keepName || 'notes', 'notes'),
        }))
      } else {
        setDraft(applyCanonicalContextIdentity({
          ...base,
          name: keepName,
          rootPath: keepRoot,
        }))
      }
    }
    setNotesContent('')
    notesInitialContentRef.current = ''
    setPreview({ status: 'idle' })
  }

  if (!open || !draft) return null

  return (
    <TerminalModal
      open={open}
      onClose={handleDismiss}
      closeOnBackdrop
      title={mode === 'edit' ? t('tabContexts.editTitle') : t('tabContexts.createTitle')}
      titleId="tab-context-form-title"
      size="xl"
      bodyLayout="flush"
      zIndex={920}
      footer={(
        <>
          {isDirty && <small className="tab-contexts__dirty">{t('tabContexts.unsavedHint')}</small>}
          <Button variant="secondary" onClick={onClose}>
            {t('tabContexts.discard')}
          </Button>
          {draft.kind !== 'agentResult' && (
            <Button
              disabled={
                Boolean(duplicateMessage)
                || (draft.kind === 'changelog'
                  ? false
                  : !(draft.name ?? '').trim() || !(draft.fileName ?? '').trim())
              }
              onClick={() => { void save() }}
            >
              {t('tabContexts.saveContext')}
            </Button>
          )}
        </>
      )}
    >
      <div className="tab-contexts tab-contexts--form">
        <TabContextsEditor
          draft={draft}
          contexts={contexts}
          preview={preview}
          notesContent={notesContent}
          resolvedCwdLabel={resolvedCwdLabel}
          projectCwd={cwd}
          duplicateMessage={duplicateMessage}
          readOnlyChangelog={Boolean(readOnlyChangelog)}
          readOnlyAgentResult={Boolean(readOnlyAgentResult)}
          onUpdate={update}
          onSelectKind={selectKind}
          onNotesContentChange={setNotesContent}
          onPreviewReset={() => setPreview(current => (current.status === 'success' ? current : { status: 'idle' }))}
          onPickRootError={message => setPreview({ status: 'error', message })}
        />
      </div>
    </TerminalModal>
  )
}
