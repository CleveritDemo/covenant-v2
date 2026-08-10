import React, { useEffect, useRef, useState } from 'react'
import type { TabContext, TabContextKind } from '@shared/tabContext'
import {
  applyCanonicalContextIdentity,
  canonicalContextName,
  contextDefinitionKey,
  CREATABLE_CONTEXT_KINDS,
  normalizeContextFileName,
} from '@shared/tabContext'
import { defaultColorForKind, defaultIconForKind } from '@shared/tabContextAppearance'
import { isContextDraftDirty } from '@shared/contextDraftDirty'
import { PROJECT_DIR } from '@shared/projectDir'
import {
  orgWorkspacePersistContext,
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

/**
 * Borrador en blanco. El nombre se deja **vacío** a propósito: como
 * `applyCanonicalContextIdentity` lo rellena con el nombre canónico del kind
 * (`folders` para `folderTree`), un contexto nuevo nacía con la identidad de
 * uno que suele existir ya, disparaba el error de duplicado y dejaba Guardar
 * deshabilitado antes de que el usuario escribiera nada. El id y el archivo
 * canónicos sí se conservan: se recalculan al guardar desde el nombre real.
 */
function emptyContext(kind: TabContextKind = 'folderTree'): TabContext {
  return {
    ...applyCanonicalContextIdentity({
      id: '',
      name: '',
      fileName: '',
      kind,
      icon: defaultIconForKind(kind),
      color: defaultColorForKind(kind),
      ...(kind === 'symbols' ? { symbolKinds: ['class', 'method'] as const } : {}),
    }),
    name: '',
  }
}

function comparable(value: string): string {
  return value.trim().normalize('NFKC').toLocaleLowerCase()
}

function contextDefinition(context: TabContext): string | null {
  return contextDefinitionKey(context)
}

/**
 * Nombre sugerido al cambiar kind o rootPath. Respeta un nombre que el usuario
 * escribió a mano; si estaba vacío o era el canónico del kind anterior (o el
 * patrón histórico de symbols), usa `canonicalContextName` del kind destino.
 * `prevRootPath` detecta autogenerado; `nextRootPath` calcula la sugerencia.
 */
function suggestNameForKind(
  nextKind: TabContextKind,
  prevRootPath: string | undefined,
  nextRootPath: string | undefined,
  currentName: string,
  currentKind: TabContextKind,
): string {
  const keepName = currentName.trim()
  const prevAuto = canonicalContextName(currentKind, { rootPath: prevRootPath }).trim()
  const userTyped = Boolean(keepName)
    && keepName !== prevAuto
    && !/^classes(\s|·|-)/i.test(keepName)
  if (userTyped) return keepName
  return canonicalContextName(nextKind, { rootPath: nextRootPath })
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
  // Canal aparte del de la vista previa: revelar el .md o elegir carpeta son
  // acciones del panel izquierdo, y su fallo no debe borrar la vista previa ni
  // el medidor. Antes iban a `preview` y, como el debounce solo se redispara
  // con `draft`/`notesContent`, el panel derecho se quedaba en error para
  // siempre. `''` = sin aviso.
  const [actionMessage, setActionMessage] = useState('')
  const [notesContent, setNotesContent] = useState('')
  const [resolvedCwdLabel, setResolvedCwdLabel] = useState('')
  // Refs para dismiss/backdrop: evita estado stale en el handler async.
  const draftRef = useRef(draft)
  const notesContentRef = useRef(notesContent)
  const modeRef = useRef(mode)
  const contextRef = useRef(context)
  const contextsRef = useRef(contexts)
  // Valor del cuerpo de la nota cuando se cargó (o '' en `create`), para
  // detectar ediciones del textarea: el cuerpo de `notes` no vive en `draft`.
  const notesInitialContentRef = useRef('')
  // Contador de peticiones de vista previa: solo la última en pedirse puede
  // escribir el resultado (ver `loadPreview`).
  const previewSeqRef = useRef(0)
  // Frozen at edit open: org upsert must keep this API id on rename.
  const originalIdRef = useRef('')
  const originalFileNameRef = useRef('')
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
      // Forma funcional: si el usuario ya escribió algo mientras esto resolvía
      // (el textarea puede tener foco antes de que llegue el body real), no se
      // lo pisamos, y tampoco se toca el baseline de `isDirty` en ese caso —
      // el usuario ya está, legítimamente, en un estado sucio.
      setNotesContent(current => {
        if (current !== '') return current
        notesInitialContentRef.current = body
        return body
      })
      return
    }
    const workingCwd = await resolveCwd()
    if (!workingCwd) return
    try {
      const result = await window.api.previewTabContext({ context: target, cwd: workingCwd })
      if (target.kind === 'notes' && result.ok) {
        const body = result.notesContent ?? result.content
        // Misma protección que en la rama de workspace org: no pisar lo que
        // el usuario ya haya tecleado en la ventana entre abrir el modal y
        // que resuelva el IPC.
        setNotesContent(current => {
          if (current !== '') return current
          notesInitialContentRef.current = body
          return body
        })
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
      setActionMessage('')
      setNotesContent('')
      notesInitialContentRef.current = ''
      originalIdRef.current = ''
      originalFileNameRef.current = ''
      setResolvedCwdLabel('')
      return
    }
    const initial = mode === 'edit' && context ? { ...context } : emptyContext()
    // Freeze identity for the open session (do not follow draft renames).
    originalIdRef.current = mode === 'edit' && context ? context.id : ''
    originalFileNameRef.current = mode === 'edit' && context ? context.fileName : ''
    setDraft(initial)
    setActionMessage('')
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
      // Los cambios de kind van por selectKind(); aquí solo rootPath.
      const rootPathChanged = Object.prototype.hasOwnProperty.call(patch, 'rootPath')
        && patch.rootPath !== current.rootPath
      if (
        rootPathChanged
        && (CREATABLE_CONTEXT_KINDS as readonly string[]).includes(next.kind)
      ) {
        const name = suggestNameForKind(
          next.kind,
          current.rootPath,
          next.rootPath,
          current.name,
          current.kind,
        )
        next = {
          ...next,
          name,
          fileName: normalizeContextFileName(name),
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

  // El cálculo vive en shared/ (función pura, testeada allí) porque es la
  // lógica con más riesgo de pérdida de datos del modal: handleDismiss lo lee
  // por un ref (corre fuera del render, en el handler de Esc/backdrop) y el
  // pie lo usa directamente para el aviso.
  const initial = mode === 'edit' && context ? context : null
  const isDirty = isContextDraftDirty({
    draft,
    initial,
    notesContent,
    initialNotesContent: notesInitialContentRef.current,
    // Solo `agentResult` cuenta como solo lectura: el pie le oculta el botón
    // Guardar, así que cerrar no pierde nada. En un `changelog` el nombre sí se
    // edita y se guarda (el Input se renderiza y el botón está ahí), y darlo
    // por limpio hacía que Esc tirara el cambio en silencio.
    readOnly: readOnlyAgentResult,
  })

  const editExcludeId = (): string =>
    mode === 'edit' && originalIdRef.current ? originalIdRef.current : (draft?.id ?? '')

  const duplicateMessage = (() => {
    if (!draft) return ''
    const excludeId = editExcludeId()
    const others = contexts.filter(item => item.id !== excludeId)
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
    const excludeId = modeRef.current === 'edit' && originalIdRef.current
      ? originalIdRef.current
      : current.id
    const others = contextsRef.current.filter(item => item.id !== excludeId)
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
      // Prefer stable org API id on rename (PUT same contextId). Fallback:
      // workspaceContextRename = PUT(newId)+DELETE(old) when ids diverge.
      const previousId = modeRef.current === 'edit' ? (originalIdRef.current ?? '').trim() : ''
      const { persistId, context: persistContext } = orgWorkspacePersistContext({
        mode: modeRef.current,
        originalId: previousId,
        normalized,
      })
      const payload = workspaceContextUpsertPayload(persistContext, body)
      try {
        const result = previousId && previousId !== persistId && typeof covenant.workspaceContextRename === 'function'
          ? await covenant.workspaceContextRename(
            orgWorkspace.slug,
            orgWorkspace.workspaceId,
            previousId,
            persistId,
            payload,
          )
          : await covenant.workspaceContextUpsert(
            orgWorkspace.slug,
            orgWorkspace.workspaceId,
            persistId,
            payload,
          )
        if (!result.ok) {
          setPreview({
            status: 'error',
            message: result.error || t('tabContexts.previewError'),
          })
          return false
        }
        rememberWorkspaceContextBody(persistId, body)
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
    const previousFileName = modeRef.current === 'edit' && originalFileNameRef.current
      && normalizeContextFileName(originalFileNameRef.current) !== normalized.fileName
      ? originalFileNameRef.current
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

  const loadPreview = async (): Promise<void> => {
    if (!draft) return
    // Token de secuencia: el debounce de 400 ms solo evita el solapamiento
    // cuando materializar tarda menos que eso, y `symbols` sobre un repo
    // grande no lo cumple. Sin esto, una petición lenta A seguida de una
    // rápida B resuelve B y luego A, y el panel —con su medidor derivado—
    // se queda mostrando cifras superadas como si fueran las actuales.
    const seq = previewSeqRef.current + 1
    previewSeqRef.current = seq
    const stale = (): boolean => seq !== previewSeqRef.current
    // Si ya hay una vista previa buena en pantalla, no la tapemos con
    // "Generando…": mejor contenido momentáneamente desactualizado que un
    // parpadeo en cada tecla. Forma funcional para no leer un `preview`
    // obsoleto capturado por el closure del setTimeout del debounce.
    setPreview(current => (current.status === 'success' ? current : { status: 'loading' }))
    try {
      const workingCwd = await resolveCwd()
      if (stale()) return
      if (!workingCwd) {
        setPreview({ status: 'error', message: t('tabContexts.missingCwd') })
        return
      }
      const result = await window.api.previewTabContext({
        context: draft,
        cwd: workingCwd,
        ...(draft.kind === 'notes' ? { content: notesContent ?? '' } : {}),
      })
      if (stale()) return
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
      if (stale()) return
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
      const name = suggestNameForKind(kind, keepRoot, keepRoot, keepName, draft.kind)
      const fileName = normalizeContextFileName(name, kind === 'notes' ? 'notes' : 'context')
      setDraft(applyCanonicalContextIdentity({
        ...base,
        name,
        fileName,
        ...(kind !== 'notes' ? { rootPath: keepRoot } : {}),
        ...(kind === 'symbols' ? { symbolKinds: ['class', 'method'] as const } : {}),
      }))
    }
    // No se borra `notesContent` aquí: es un cambio de tipo, no una razón para
    // tirar lo escrito. Si el usuario vuelve a `notes`, su texto sigue ahí; y
    // para cualquier otro kind el contenido queda inerte (`save()`/`loadPreview()`
    // solo lo envían cuando `kind === 'notes'`).
    setPreview({ status: 'idle' })
  }

  if (!open || !draft) return null

  return (
    <TerminalModal
      open={open}
      onClose={onClose}
      closeOnBackdrop
      title={mode === 'edit' ? t('tabContexts.editTitle') : t('tabContexts.createTitle')}
      titleId="tab-context-form-title"
      size="xxl"
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
          actionMessage={actionMessage}
          readOnlyChangelog={Boolean(readOnlyChangelog)}
          readOnlyAgentResult={Boolean(readOnlyAgentResult)}
          onUpdate={update}
          onSelectKind={selectKind}
          onNotesContentChange={setNotesContent}
          onPreviewReset={() => setPreview(current => (current.status === 'success' ? current : { status: 'idle' }))}
          onActionError={setActionMessage}
        />
      </div>
    </TerminalModal>
  )
}
