import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { ClipboardEvent } from 'react'
import type { AgentCliImageAttachment } from '@shared/agentCliTypes'
import { hasPlaneContextDrag, readPlaneContextDragData } from './planeContextDrag'
import type { PlaneContextPoolItem } from './PlaneContextPool'
import type { GitListedRepo } from '@shared/gitSessionTypes'
import type { IssueMentionPicked } from '@shared/issueMention'
import { githubIssueDraftFromRef } from '@shared/githubIssueDraft'
import { jiraDraftFromKey } from '../agent/TabContextFormModal'
import { useIssueMention } from './useIssueMention'
import { useT } from '@i18n/useT'
import { Icon } from '../components/ui/Icon'
import { Tooltip } from '../components/ui/Tooltip'
import {
  extensionForMime,
  imagesFromClipboard,
  materializeClipboardImage,
  MAX_PENDING_IMAGES,
  pendingImageFromBlob,
  pendingImagesToAttachments,
  type ComposerPendingImage,
} from '../agent/composerImages'
import { QueuedTurnEditModal } from '../agent/QueuedTurnEditModal'
import { formatQueuedTurnPreviewText } from '../agent/QueuedTurnPreviewLabel'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import { resolveQueuedTurnPreview } from '@shared/queuedTurnPreview'
import { PlaneChatComposerAgents } from './PlaneChatComposerAgents'
import { PlaneChatQueueEditButton } from './PlaneChatQueueEditButton'
import { PlaneChatRemoveChipButton } from './PlaneChatRemoveChipButton'
import { PendingImageThumb } from '../components/PendingImageThumb'
import { PastedTextAttachment } from '../components/PastedTextAttachment'
import { PlaneChatComposerShell } from './PlaneChatComposerShell'
import { PlaneComposerAurora } from './PlaneComposerAurora'
import { PlaneQueueFullNotice } from './PlaneQueueFullNotice'
import { PlaneSketchButton } from './PlaneSketchButton'
import { SketchModal } from './SketchModal'
import { usePushToTalkSpeech, classifyDictationError } from '../pushToTalkSpeech'
import { DictationListeningOverlay } from '../components/DictationListeningOverlay'
import { shouldShowComposerStop } from '../agent/agentInputGuards'
import { recallStep, rememberComposerEntry } from '@shared/composerHistory'
import {
  MAX_PENDING_PASTED_TEXTS,
  composeTextWithPastes,
  createPastedText,
  createQuotedReference,
  shouldCapturePastedText,
  type ComposerPastedText,
} from '@shared/composerPastedText'
import './PlaneChatComposer.css'

/** Lo que el composer guarda por hilo al cambiar de conversación. */
interface ComposerDraft {
  text: string
  images: ComposerPendingImage[]
  contextIds: string[]
  pastes: ComposerPastedText[]
}

/** Clave de borrador en memoria: un entry por par pane + hilo activo. */
export function composerDraftStorageKey(
  paneId: string | null | undefined,
  threadId?: string | null,
): string | null {
  if (!paneId) return null
  return `${paneId}:${threadId ?? ''}`
}

export interface PlaneChatAgentOption {
  paneId: string
  title: string
  busy: boolean
  /** Cualquier hilo en ejecución — solo ilumina el dot del badge. */
  workActive?: boolean
  /** El orquestador espera resultados y solo permite detener el batch. */
  awaitingDelegations?: boolean
  /** Este agente es destino de una delegación pendiente. */
  delegationWorkActive?: boolean
  /** El orquestador está ocupado y no acepta cola humana. */
  orchestratorBusy?: boolean
  /** turbo: placeholder distinto mientras awaiting y no busy. */
  orchestrationWorkStyle?: 'linear' | 'turbo'
}

export interface PlaneChatQueuedTurn {
  id: string
  text: string
  images: Array<{ id: string; previewUrl: string; name: string }>
  /** Follow-up de orquestación: no participa en el merge. */
  orchestrationFollowUp?: boolean
  /** Subtarea delegada: no participa en el merge. */
  delegation?: { id: string; fromPaneId: string; toAgentId: string }
}

export interface PlaneChatQueueFullNotice {
  paneId: string
  text: string
  at: number
}

export interface PlaneChatComposerProps {
  agents: PlaneChatAgentOption[]
  /** Catálogo del pool: resuelve el id que llega en el drop a nombre/ícono. */
  contexts?: PlaneContextPoolItem[]
  selectedAgentId: string | null
  /** Hilo activo del chat: cada conversación conserva su borrador aparte. */
  activeThreadId?: string | null
  placeholder: string
  emptyAgentsHint: string
  sendLabel: string
  queuedTurns?: PlaneChatQueuedTurn[]
  agentCatalog?: ProjectAgentDefinition[]
  /** Cola humana llena: devuelve el texto al input y muestra aviso inline. */
  queueFullNotice?: PlaneChatQueueFullNotice | null
  onQueueFullNoticeDismiss?: () => void
  onSelectAgent: (paneId: string) => void
  onStop: (paneId: string) => void
  onSend: (
    paneId: string,
    text: string,
    images: AgentCliImageAttachment[],
    contextIds: string[],
  ) => void
  onRemoveQueuedTurn?: (paneId: string, id: string) => void
  onUpdateQueuedTurn?: (paneId: string, id: string, text: string) => void
  onMergeQueuedTurns?: (paneId: string) => void
  /** Repos git del root folder del tab, listados bajo el input. */
  gitRepos?: GitListedRepo[]
  /** Clic en un repo de la lista → abre su modal git. */
  onOpenRepoGit?: (path: string) => void
  /** Revalida la lista contra el disco (repos borrados/clonados fuera de la app). */
  onRefreshRepos?: () => void
  /** Sonido de inicio de dictado; default true. */
  systemSoundsEnabled?: boolean
  /**
   * Carpeta del proyecto: sin esto no hay `jiraStatus`/`jiraSearch` posibles.
   * `''` (valor por defecto) desactiva la mención — así los tests que no
   * pasan `cwd` no necesitan mockear `window.api`.
   */
  cwd?: string
  /**
   * Un contexto nuevo (mención de Jira) se materializó en disco. Mismo nombre
   * y mismo propósito que el `onContextSaved` que ya usan `TabContextsModal`
   * y `BrainstormRoom`: refrescar el catálogo del proyecto en el padre.
   */
  onContextSaved?: () => void
  /**
   * Carga el historial ↑/↓ del hilo activo desde el transcript persistido.
   * Vacío si no hay hilo o falla la lectura: el composer no debe romperse.
   */
  onLoadPromptHistory?: (paneId: string, threadId: string | null) => Promise<string[]>
}

export interface PlaneChatComposerHandle {
  attachReference: (content: string) => void
}

export const PlaneChatComposer = forwardRef<PlaneChatComposerHandle, PlaneChatComposerProps>(
  function PlaneChatComposer({
    agents,
    contexts = [],
    selectedAgentId,
    activeThreadId = '',
    placeholder,
    emptyAgentsHint,
    sendLabel,
    queuedTurns = [],
    agentCatalog = [],
    queueFullNotice = null,
    onQueueFullNoticeDismiss,
    onSelectAgent,
    onStop,
    onSend,
    onRemoveQueuedTurn,
    onUpdateQueuedTurn,
    onMergeQueuedTurns,
    gitRepos = [],
    onOpenRepoGit,
    onRefreshRepos,
    systemSoundsEnabled = true,
    cwd = '',
    onContextSaved,
    onLoadPromptHistory,
  }, ref) {
  const { t, i18n } = useT()
  const [draft, setDraft] = useState('')
  const [pendingImages, setPendingImages] = useState<ComposerPendingImage[]>([])
  const [pendingPastes, setPendingPastes] = useState<ComposerPastedText[]>([])
  const [dictationError, setDictationError] = useState('')
  /**
   * Contextos adjuntos a ESTE turno. No tocan el catálogo del agente: se envían
   * con el mensaje y se limpian, igual que las imágenes pegadas.
   */
  const [pendingContextIds, setPendingContextIds] = useState<string[]>([])
  const [dropActive, setDropActive] = useState(false)
  const [editingQueuedId, setEditingQueuedId] = useState<string | null>(null)
  const [sketchOpen, setSketchOpen] = useState(false)
  const composerInputRef = useRef<HTMLTextAreaElement>(null)
  const pendingImagesRef = useRef(pendingImages)
  pendingImagesRef.current = pendingImages
  /**
   * Historial ↑/↓ del chat. Vive en un ref por conversación: al cambiar de
   * agente/hilo se vacía y se siembra del transcript persistido (CT-129).
   * Enviar un mensaje sigue añadiendo con `rememberComposerEntry`.
   * `historyIndex === null` es idle: las flechas siguen siendo del textarea.
   */
  const historyRef = useRef<string[]>([])
  const stashRef = useRef('')
  const [historyIndex, setHistoryIndex] = useState<number | null>(null)
  /**
   * Borradores por hilo (texto + imágenes + contextos + pastes del turno):
   * cambiar de conversación y volver no debe perder lo preparado. Solo en memoria.
   */
  const draftsRef = useRef<Record<string, ComposerDraft>>({})
  const draftRef = useRef<ComposerDraft>({
    text: draft,
    images: pendingImages,
    contextIds: pendingContextIds,
    pastes: pendingPastes,
  })
  draftRef.current = {
    text: draft,
    images: pendingImages,
    contextIds: pendingContextIds,
    pastes: pendingPastes,
  }

  const selected = agents.find(agent => agent.paneId === selectedAgentId) ?? null
  const noAgentSelected = agents.length > 0 && !selected
  const busy = Boolean(selected?.busy)
  const awaitingDelegations = Boolean(selected?.awaitingDelegations)
  const delegationWorkActive = Boolean(selected?.delegationWorkActive)
  const orchestratorBusy = Boolean(selected?.orchestratorBusy)
  // Turbo con ola abierta y orquestador libre: placeholder específico; si además
  // está busy, manda el genérico de cola (el hilo activo sí bloquea).
  const turboAwaitingOpen = selected?.orchestrationWorkStyle === 'turbo'
    && awaitingDelegations
    && !busy
  const canSend = Boolean(
    selected && (draft.trim() || pendingImages.length > 0 || pendingPastes.length > 0),
  )
  const showStop = Boolean(selected && shouldShowComposerStop({
    busy,
    awaitingDelegations,
    delegationWorkActive,
  }))
  const buttonIsStop = Boolean(showStop && !canSend)
  const editingQueuedText = editingQueuedId
    ? (queuedTurns.find(item => item.id === editingQueuedId)?.text ?? '')
    : ''
  const editingQueuedImages = editingQueuedId
    ? (queuedTurns.find(item => item.id === editingQueuedId)?.images ?? [])
    : []

  // Al desmontar se van los objectURL: los del chat abierto y los guardados.
  useEffect(() => {
    return () => {
      const stashed = Object.values(draftsRef.current).flatMap(entry => entry.images)
      const all = [...pendingImagesRef.current, ...stashed]
      all.forEach(image => URL.revokeObjectURL(image.previewUrl))
    }
  }, [])

  // Al cambiar agente o hilo, el input recupera el borrador de ESA conversación.
  useEffect(() => {
    const key = composerDraftStorageKey(selectedAgentId, activeThreadId)
    const saved = key ? draftsRef.current[key] : undefined
    setDraft(saved?.text ?? '')
    setPendingImages(saved?.images ?? [])
    setPendingContextIds(saved?.contextIds ?? [])
    setPendingPastes(saved?.pastes ?? [])
    setEditingQueuedId(null)
    setSketchOpen(false)
    mention.close()
    historyRef.current = []
    stashRef.current = ''
    setHistoryIndex(null)
    const el = composerInputRef.current
    if (el) {
      el.style.height = 'auto'
    }
    let cancelled = false
    if (onLoadPromptHistory && selectedAgentId) {
      const threadId = activeThreadId || null
      void onLoadPromptHistory(selectedAgentId, threadId).then(entries => {
        if (cancelled) return
        historyRef.current = entries
      })
    }
    return () => {
      cancelled = true
      if (key) draftsRef.current[key] = draftRef.current
    }
  }, [selectedAgentId, activeThreadId, onLoadPromptHistory])

  // Si el turno editado ya no está en la cola (p. ej. tras merge), cerrar el modal.
  useEffect(() => {
    if (editingQueuedId !== null && !queuedTurns.some(item => item.id === editingQueuedId)) {
      setEditingQueuedId(null)
    }
  }, [queuedTurns, editingQueuedId])

  // Cola humana llena: recuperar el texto del envío rechazado.
  useEffect(() => {
    if (!queueFullNotice) return
    setDraft(current => {
      const rejected = queueFullNotice.text
      if (!current.trim()) return rejected
      if (current.includes(rejected)) return current
      return `${current}\n${rejected}`
    })
  }, [queueFullNotice])

  useEffect(() => {
    if (!queueFullNotice) return
    const timeoutId = window.setTimeout(() => {
      onQueueFullNoticeDismiss?.()
    }, 6000)
    return () => window.clearTimeout(timeoutId)
  }, [queueFullNotice, onQueueFullNoticeDismiss])

  const dismissQueueFullNotice = useCallback((): void => {
    if (queueFullNotice) onQueueFullNoticeDismiss?.()
  }, [queueFullNotice, onQueueFullNoticeDismiss])

  /**
   * Issue elegido en el picker → contexto `jira` real en disco y adjunto a
   * ESTE turno, exactamente por la vía que ya usa soltar un chip del pool
   * (`pendingContextIds`). `materializeTabContext` es la misma llamada que
   * hace `TabContextFormModal.save()`: sin ella el contexto nunca llega a
   * existir en `.gravity/jira/` y la mención "funcionaría" sin entregar nada
   * (el bug de la Tarea 9, con otro disfraz). También reemplaza el token
   * escrito (`GRAV-4`, o `@algo`) por la clave canónica del issue: si no, el
   * prompt se queda con el texto truncado mientras el chip adjunto apunta a
   * otra cosa, y ese token sobreviviente reabre el picker en la próxima tecla.
   */
  const attachIssueMention = useCallback((picked: IssueMentionPicked): void => {
    const context = picked.source === 'jira'
      ? jiraDraftFromKey(picked.issue.key)
      : githubIssueDraftFromRef(picked.issue)
    if (!context || !cwd.trim()) return
    void window.api.materializeTabContext({ context, cwd }).then(result => {
      if (!result.ok) return
      onContextSaved?.()
      setPendingContextIds(previous => (
        previous.includes(context.id) ? previous : [...previous, context.id]
      ))
    }).catch(() => {
      // Sin `.md` en disco, no hay nada real que adjuntar: no lo intentamos.
    })
  }, [cwd, onContextSaved])

  const mention = useIssueMention({
    cwd,
    value: draft,
    onValueChange: setDraft,
    inputRef: composerInputRef,
    onPicked: attachIssueMention,
  })

  const appendPendingImages = useCallback((images: ComposerPendingImage[]): void => {
    if (!images.length) return
    setPendingImages(previous => {
      const room = Math.max(0, MAX_PENDING_IMAGES - previous.length)
      if (!room) {
        images.forEach(image => URL.revokeObjectURL(image.previewUrl))
        return previous
      }
      const accepted = images.slice(0, room)
      images.slice(room).forEach(image => URL.revokeObjectURL(image.previewUrl))
      return [...previous, ...accepted]
    })
  }, [])

  const removePendingImage = useCallback((id: string): void => {
    setPendingImages(previous => {
      const target = previous.find(image => image.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return previous.filter(image => image.id !== id)
    })
  }, [])

  const handlePaste = useCallback((event: ClipboardEvent<HTMLTextAreaElement>): void => {
    const files = imagesFromClipboard(event.clipboardData)
    if (files.length) {
      event.preventDefault()
      const jobs = files.map((file, index) =>
        materializeClipboardImage(
          file,
          `paste-${index + 1}${extensionForMime(file.type || 'image/png')}`,
        ),
      )
      void Promise.all(jobs).then(results => {
        appendPendingImages(results.filter((image): image is ComposerPendingImage => image != null))
      })
      return
    }
    const text = event.clipboardData.getData('text/plain')
    if (!shouldCapturePastedText(text)) return
    event.preventDefault()
    setPendingPastes(previous => {
      if (previous.length >= MAX_PENDING_PASTED_TEXTS) return previous
      return [...previous, createPastedText(text)]
    })
  }, [appendPendingImages])

  const removePendingPaste = useCallback((id: string): void => {
    setPendingPastes(previous => previous.filter(paste => paste.id !== id))
  }, [])

  const attachReference = useCallback((content: string): void => {
    setPendingPastes(previous =>
      previous.length >= MAX_PENDING_PASTED_TEXTS
        ? previous
        : [...previous, createQuotedReference(content)],
    )
  }, [])

  useImperativeHandle(ref, () => ({ attachReference }), [attachReference])

  const handleSketchAttach = useCallback((blob: Blob): void => {
    void pendingImageFromBlob(blob, `sketch-${Date.now()}.png`).then(image => {
      if (image) appendPendingImages([image])
    })
  }, [appendPendingImages])

  const pendingContexts = useMemo(
    () => pendingContextIds
      .map(id => contexts.find(context => context.id === id))
      .filter((context): context is PlaneContextPoolItem => context != null),
    [contexts, pendingContextIds],
  )

  const removePendingContext = useCallback((id: string): void => {
    setPendingContextIds(previous => previous.filter(contextId => contextId !== id))
  }, [])

  /**
   * Sin `preventDefault` el navegador pega el `text/plain` del arrastre (el id
   * crudo) dentro del textarea. Hay que interceptarlo aunque el id no se
   * reconozca, o el default gana.
   */
  const handleDragOver = useCallback((event: React.DragEvent): void => {
    if (!hasPlaneContextDrag(event.dataTransfer)) return
    if (noAgentSelected) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setDropActive(true)
  }, [noAgentSelected])

  const handleDragLeave = useCallback((event: React.DragEvent): void => {
    // Solo al salir del composer entero, no al cruzar entre sus hijos.
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setDropActive(false)
  }, [])

  const handleDrop = useCallback((event: React.DragEvent): void => {
    if (!hasPlaneContextDrag(event.dataTransfer)) return
    if (noAgentSelected) return
    event.preventDefault()
    setDropActive(false)
    const id = readPlaneContextDragData(event.dataTransfer)
    if (!id || !contexts.some(context => context.id === id)) return
    setPendingContextIds(previous => (
      previous.includes(id) ? previous : [...previous, id]
    ))
  }, [contexts, noAgentSelected])

  const submit = useCallback((overrideText?: string): void => {
    const typed = (overrideText ?? draft).trim()
    if (!selected || (!typed && pendingImages.length === 0 && pendingPastes.length === 0)) return
    const imagesSnapshot = pendingImages
    const pastesSnapshot = pendingPastes
    const contextIdsSnapshot = pendingContextIds
    const composed = composeTextWithPastes(typed, pastesSnapshot)
    historyRef.current = rememberComposerEntry(historyRef.current, typed)
    stashRef.current = ''
    setHistoryIndex(null)
    setDraft('')
    setPendingImages([])
    setPendingPastes([])
    setPendingContextIds([])
    const draftKey = composerDraftStorageKey(selected.paneId, activeThreadId)
    if (draftKey) {
      draftsRef.current[draftKey] = { text: '', images: [], contextIds: [], pastes: [] }
    }
    mention.close()
    void pendingImagesToAttachments(imagesSnapshot).then(attachments => {
      imagesSnapshot.forEach(image => URL.revokeObjectURL(image.previewUrl))
      onSend(selected.paneId, composed, attachments, contextIdsSnapshot)
    })
  }, [
    activeThreadId,
    draft,
    onSend,
    pendingContextIds,
    pendingImages,
    pendingPastes,
    selected,
  ])

  const mapDictationError = useCallback((code: string): string => {
    const kind = classifyDictationError(code)
    if (kind === 'unsupported') return t('agentPane.dictationUnsupported')
    if (kind === 'helperMissing') return t('agentPane.dictationHelperMissing')
    if (kind === 'startFailed') return t('agentPane.dictationStartFailed')
    if (kind === 'permission') return t('agentPane.dictationPermissionDenied')
    if (kind === 'electronUnavailable') return t('agentPane.dictationUnavailableElectron')
    if (kind === 'noSpeech') return t('agentPane.dictationNoSpeech')
    if (kind === 'tooShort') return t('agentPane.dictationTooShort')
    if (kind === 'noAudio') return t('agentPane.dictationNoAudio')
    return t('agentPane.dictationError')
  }, [t])

  const speechLang = i18n.language?.toLowerCase().startsWith('es') ? 'es-ES' : 'en-US'
  const { listening, interim, level, bands, start: startDictation, stop: stopDictation } =
    usePushToTalkSpeech({
      lang: speechLang,
      systemSoundsEnabled,
      onTranscript: text => {
        submit(text)
      },
      onError: code => {
        setDictationError(mapDictationError(code))
        window.setTimeout(() => setDictationError(''), 5000)
      },
    })

  /**
   * Aplica un texto recuperado: cursor al final (se recupera para reenviar o
   * retocar el final) y un swap de un frame para que el cambio no aparezca de
   * golpe. La clase se quita antes de volver a ponerla o la animación no se
   * reinicia.
   */
  const applyRecall = useCallback((text: string): void => {
    setDraft(text)
    const el = composerInputRef.current
    if (!el) return
    el.classList.remove('plane-chat-composer__input--swap')
    void el.offsetWidth
    el.classList.add('plane-chat-composer__input--swap')
    requestAnimationFrame(() => el.setSelectionRange(text.length, text.length))
  }, [])

  const handleHistoryKey = useCallback((
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ): boolean => {
    const el = event.currentTarget
    const step = recallStep(historyRef.current, historyIndex, event.key, {
      draft,
      stash: stashRef.current,
      atFirstLine: el.selectionStart === el.selectionEnd
        && !el.value.slice(0, el.selectionStart).includes('\n'),
    })
    if (!step) return false
    event.preventDefault()
    stashRef.current = step.stash
    setHistoryIndex(step.index)
    applyRecall(step.text)
    return true
  }, [applyRecall, draft, historyIndex])

  const handleSendClick = (): void => {
    if (buttonIsStop && selected) {
      onStop(selected.paneId)
      return
    }
    if (canSend) submit()
  }

  const micMode = Boolean(
    selected
    && !buttonIsStop
    && !draft.trim()
    && pendingImages.length === 0
    && pendingPastes.length === 0,
  )

  const composerWorking = Boolean(busy || awaitingDelegations || delegationWorkActive)

  return (
    <div
      className={[
        'plane-chat-composer',
        composerWorking
          ? 'plane-chat-composer--working'
          : '',
        listening ? 'plane-chat-composer--dictating' : '',
        dropActive ? 'plane-chat-composer--drop' : '',
      ].filter(Boolean).join(' ')}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <PlaneComposerAurora />
      <div className="plane-chat-composer__body">
        <DictationListeningOverlay
          active={listening}
          level={level}
          scope="chat-dock"
          text={interim.trim() || t('agentPane.dictationLive')}
          streaming={Boolean(interim.trim())}
        />
        {queuedTurns.length > 0 && (
          <div className="plane-chat-composer__pending-row">
            <div
              className="plane-chat-composer__queue"
              aria-label={t('agentPane.queueLabel', { n: queuedTurns.length })}
            >
              {onMergeQueuedTurns
                && selectedAgentId
                && queuedTurns.filter(item => !item.delegation).length >= 2 && (
                <button
                  type="button"
                  className="plane-chat-composer__queue-merge"
                  aria-label={t('agentPane.queueMerge')}
                  onClick={() => onMergeQueuedTurns(selectedAgentId)}
                >
                  {t('agentPane.queueMerge')}
                </button>
              )}
              {queuedTurns.map((item, index) => {
                const preview = resolveQueuedTurnPreview(item, agentCatalog)
                const displayText = preview.kind !== 'human'
                  ? formatQueuedTurnPreviewText(preview, t)
                  : preview.fallbackText
                return (
                <div key={item.id} className="plane-chat-composer__queue-bubble">
                  <PlaneChatQueueEditButton
                    position={index + 1}
                    text={item.text}
                    displayText={displayText}
                    emptyText={t('agentPane.imageOnlyMessage')}
                    images={item.images}
                    title={t('agentPane.queueEditHint')}
                    onClick={() => setEditingQueuedId(item.id)}
                  />
                  {selectedAgentId ? (
                    <PlaneChatRemoveChipButton
                      appearance="queue"
                      label={t('agentPane.queueRemove')}
                      onClick={() => onRemoveQueuedTurn?.(selectedAgentId, item.id)}
                    />
                  ) : null}
                </div>
                )
              })}
            </div>
          </div>
        )}

        {(pendingContexts.length > 0 || dropActive) && (
          <div
            className="plane-chat-composer__turn-contexts"
            aria-label={t('tabs.planeComposerContextsLabel', { n: pendingContexts.length })}
          >
            {pendingContexts.map(context => (
              <span
                key={context.id}
                className={[
                  'plane-chat-composer__context',
                  context.kind === 'agentResult' ? 'plane-chat-composer__context--result' : '',
                ].filter(Boolean).join(' ')}
                style={{ '--context-color': context.color } as React.CSSProperties}
              >
                <Icon name={context.icon} size={12} aria-hidden />
                <span className="plane-chat-composer__context-name">{context.name}</span>
                <span className="plane-chat-composer__context-kind">{context.kindLabel}</span>
                <PlaneChatRemoveChipButton
                  appearance="chip"
                  label={t('tabs.planeComposerContextRemove', { name: context.name })}
                  onClick={() => removePendingContext(context.id)}
                />
              </span>
            ))}
            {dropActive ? (
              <span className="plane-chat-composer__drop-hint">
                {t('tabs.planeComposerContextDropHint')}
              </span>
            ) : null}
          </div>
        )}

        {pendingPastes.length > 0 ? (
          <div
            className="plane-chat-composer__pastes"
            aria-label={t('agentPane.pastedTextAttached', { n: pendingPastes.length })}
          >
            {pendingPastes.map(paste => (
              <PastedTextAttachment
                key={paste.id}
                paste={paste}
                onRemove={() => removePendingPaste(paste.id)}
              />
            ))}
          </div>
        ) : null}

        {queueFullNotice ? <PlaneQueueFullNotice /> : null}

        <PlaneChatComposerShell
          value={draft}
          onChange={next => {
            setDraft(next)
            dismissQueueFullNotice()
            // Editar el texto recuperado es tomar posesión: vuelve a idle.
            if (historyIndex !== null) setHistoryIndex(null)
          }}
          onInputChange={el => mention.handleChange(el)}
          onInputSelect={el => mention.handleSelect(el)}
          placeholder={
            agents.length === 0
              ? emptyAgentsHint
              : noAgentSelected
                ? t('tabs.planeComposerSelectAgent')
                : turboAwaitingOpen
                  ? t('agentPane.turboAwaitingPlaceholder')
                  : busy || awaitingDelegations || delegationWorkActive || orchestratorBusy
                    ? t('agentPane.queuePlaceholder')
                    : placeholder
          }
          inputLabel={sendLabel}
          sendLabel={
            buttonIsStop
              ? t('agentPane.stop')
              : micMode
                ? (listening ? t('agentPane.dictationListening') : t('agentPane.dictationHold'))
                : sendLabel
          }
          sendMode={buttonIsStop ? 'stop' : micMode ? 'mic' : 'send'}
          sendDisabled={!buttonIsStop && !micMode && !canSend}
          listening={listening}
          level={level}
          bands={bands}
          disabled={agents.length === 0 || noAgentSelected}
          disabledHint={noAgentSelected ? t('tabs.planeComposerSelectAgent') : undefined}
          recalling={historyIndex !== null}
          onSendClick={handleSendClick}
          onMicStart={startDictation}
          onMicStop={stopDictation}
          onPaste={handlePaste}
          onExtraKeyDown={event => {
            handleHistoryKey(event)
          }}
          inputRef={composerInputRef}
          fieldHeader={(
            <PlaneChatComposerAgents
              agents={agents}
              selectedAgentId={selectedAgentId}
              emptyAgentsHint={emptyAgentsHint}
              sendLabel={sendLabel}
              onSelectAgent={onSelectAgent}
            />
          )}
          leading={(
            <PlaneSketchButton
              label={t('sketch.open')}
              disabled={agents.length === 0 || noAgentSelected || pendingImages.length >= MAX_PENDING_IMAGES}
              onClick={() => setSketchOpen(true)}
            />
          )}
          inputOverlay={mention.picker}
          shellAside={pendingImages.length > 0 ? (
            <div
              className="plane-chat-composer__attachments"
              aria-label={t('agentPane.imagesAttached', { n: pendingImages.length })}
            >
              {pendingImages.map(image => (
                <PendingImageThumb
                  key={image.id}
                  src={image.previewUrl}
                  name={image.name}
                  onRemove={() => removePendingImage(image.id)}
                />
              ))}
            </div>
          ) : null}
          fieldAside={historyIndex !== null ? (
            <span
              className="plane-chat-composer__history-badge"
              role="status"
              aria-label={t('agentPane.historyPosition', {
                n: historyIndex + 1,
                total: historyRef.current.length,
              })}
            >
              {historyIndex + 1} / {historyRef.current.length}
            </span>
          ) : null}
        />
        {!listening && dictationError ? (
          <p className="plane-chat-composer__dictation-error" role="status">
            {dictationError}
          </p>
        ) : null}

        {gitRepos.length > 0 && (
          <div className="plane-chat-composer__repos">
            {gitRepos.map(repo => (
              <Tooltip key={repo.path} content={t('tabs.planeRepoGitTitle', { name: repo.name })}>
                <button
                  type="button"
                  className="plane-chat-composer__repo-chip"
                  aria-label={t('tabs.planeRepoGitTitle', { name: repo.name })}
                  onClick={() => onOpenRepoGit?.(repo.path)}
                >
                  {repo.name}
                </button>
              </Tooltip>
            ))}
            {onRefreshRepos ? (
              <Tooltip content={t('tabs.planeReposRefresh')}>
                <button
                  type="button"
                  className="plane-chat-composer__repo-chip plane-chat-composer__repo-chip--refresh"
                  aria-label={t('tabs.planeReposRefresh')}
                  onClick={onRefreshRepos}
                >
                  <Icon name="refresh" size={12} />
                </button>
              </Tooltip>
            ) : null}
          </div>
        )}
      </div>

      <SketchModal
        open={sketchOpen}
        onClose={() => setSketchOpen(false)}
        onAttach={handleSketchAttach}
      />

      <QueuedTurnEditModal
        open={Boolean(editingQueuedId)}
        initialText={editingQueuedText}
        images={editingQueuedImages}
        onClose={() => setEditingQueuedId(null)}
        onSave={text => {
          if (editingQueuedId && selectedAgentId) {
            onUpdateQueuedTurn?.(selectedAgentId, editingQueuedId, text)
          }
        }}
      />
      </div>
  )
})
