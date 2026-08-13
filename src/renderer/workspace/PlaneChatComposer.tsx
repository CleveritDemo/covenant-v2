import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ClipboardEvent } from 'react'
import type { AgentCliImageAttachment } from '@shared/agentCliTypes'
import { hasPlaneContextDrag, readPlaneContextDragData } from './planeContextDrag'
import type { PlaneContextPoolItem } from './PlaneContextPool'
import type { GitListedRepo } from '@shared/gitSessionTypes'
import { mentionQueryAt } from '@shared/jiraIssue'
import { jiraDraftFromKey } from '../agent/TabContextFormModal'
import { JiraMentionPicker } from './JiraMentionPicker'
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
import { PlaneAgentBadge } from './PlaneAgentBadge'
import { PlaneChatCloseButton } from './PlaneChatCloseButton'
import { PlaneChatQueueEditButton } from './PlaneChatQueueEditButton'
import { PlaneChatRemoveChipButton } from './PlaneChatRemoveChipButton'
import { PendingImageThumb } from '../components/PendingImageThumb'
import { PlaneChatSendButton } from './PlaneChatSendButton'
import { PlaneComposerAurora } from './PlaneComposerAurora'
import { PlaneSketchButton } from './PlaneSketchButton'
import { SketchModal } from './SketchModal'
import { usePushToTalkSpeech, classifyDictationError } from '../pushToTalkSpeech'
import { DictationListeningOverlay } from '../components/DictationListeningOverlay'
import { shouldShowComposerStop } from '../agent/agentInputGuards'
import { recallStep, rememberComposerEntry } from '@shared/composerHistory'
import './PlaneChatComposer.css'

const MAX_COMPOSER_ROWS = 8

/** Lo que el composer guarda por agente al cambiar de chip. */
interface ComposerDraft {
  text: string
  images: ComposerPendingImage[]
  contextIds: string[]
}

function resizeComposerTextarea(el: HTMLTextAreaElement): void {
  el.style.height = 'auto'
  const styles = getComputedStyle(el)
  const lineHeight = parseFloat(styles.lineHeight) || 18
  const padY = (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0)
  const maxH = lineHeight * MAX_COMPOSER_ROWS + padY
  el.style.height = `${Math.min(el.scrollHeight, maxH)}px`
}

export interface PlaneChatAgentOption {
  paneId: string
  title: string
  /** Réplica temporal del experto: `R2`, `R3`… */
  instanceTag?: string
  /** Experto base: réplicas suyas vivas ahora mismo. */
  replicaCount?: number
  busy: boolean
  /** Loop local o cadena activa: el composer debe poder mostrar Stop. */
  loopActive?: boolean
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

export interface PlaneChatComposerProps {
  agents: PlaneChatAgentOption[]
  /** Catálogo del pool: resuelve el id que llega en el drop a nombre/ícono. */
  contexts?: PlaneContextPoolItem[]
  selectedAgentId: string | null
  placeholder: string
  emptyAgentsHint: string
  sendLabel: string
  queuedTurns?: PlaneChatQueuedTurn[]
  onSelectAgent: (paneId: string) => void
  onCloseChat?: () => void
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
}

export const PlaneChatComposer: React.FC<PlaneChatComposerProps> = ({
  agents,
  contexts = [],
  selectedAgentId,
  placeholder,
  emptyAgentsHint,
  sendLabel,
  queuedTurns = [],
  onSelectAgent,
  onCloseChat,
  onStop,
  onSend,
  onRemoveQueuedTurn,
  onUpdateQueuedTurn,
  onMergeQueuedTurns,
  gitRepos = [],
  onOpenRepoGit,
  onRefreshRepos,
  cwd = '',
  onContextSaved,
}) => {
  const { t, i18n } = useT()
  const [draft, setDraft] = useState('')
  const [pendingImages, setPendingImages] = useState<ComposerPendingImage[]>([])
  const [dictationError, setDictationError] = useState('')
  /**
   * Contextos adjuntos a ESTE turno. No tocan el catálogo del agente: se envían
   * con el mensaje y se limpian, igual que las imágenes pegadas.
   */
  const [pendingContextIds, setPendingContextIds] = useState<string[]>([])
  /** Claves de proyecto Jira conectadas: sin esto `@GRAV-` no abre nada (ver `mentionQueryAt`). */
  const [jiraProjectKeys, setJiraProjectKeys] = useState<string[]>([])
  /** `null` = picker cerrado. `''` = `@` recién tecleado, abre búsqueda libre. */
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [dropActive, setDropActive] = useState(false)
  const [editingQueuedId, setEditingQueuedId] = useState<string | null>(null)
  const [sketchOpen, setSketchOpen] = useState(false)
  const composerInputRef = useRef<HTMLTextAreaElement>(null)
  const pendingImagesRef = useRef(pendingImages)
  pendingImagesRef.current = pendingImages
  /**
   * Historial ↑/↓ del chat. Vive en memoria y por chat: no se persiste en
   * session.json a propósito. `historyIndex === null` es el estado idle, donde
   * las flechas siguen siendo del textarea.
   */
  const historyRef = useRef<string[]>([])
  const stashRef = useRef('')
  const [historyIndex, setHistoryIndex] = useState<number | null>(null)
  /**
   * Borradores por agente (texto + imágenes + contextos del turno): cambiar de
   * chip y volver no debe perder lo preparado. Solo en memoria; si hace falta
   * que sobreviva al reinicio, va a session.json.
   */
  const draftsRef = useRef<Record<string, ComposerDraft>>({})
  const draftRef = useRef<ComposerDraft>({ text: draft, images: pendingImages, contextIds: pendingContextIds })
  draftRef.current = { text: draft, images: pendingImages, contextIds: pendingContextIds }

  const selected = agents.find(agent => agent.paneId === selectedAgentId) ?? null
  const busy = Boolean(selected?.busy)
  const loopActive = Boolean(selected?.loopActive)
  const awaitingDelegations = Boolean(selected?.awaitingDelegations)
  const delegationWorkActive = Boolean(selected?.delegationWorkActive)
  const orchestratorBusy = Boolean(selected?.orchestratorBusy)
  const turboAwaitingOpen = selected?.orchestrationWorkStyle === 'turbo'
    && awaitingDelegations
    && !busy
  // Solo el loop bloquea teclear; busy/delegaciones permiten encolar.
  const composerLocked = loopActive
  const canSend = Boolean(
    selected && !composerLocked && (draft.trim() || pendingImages.length > 0),
  )
  const showStop = Boolean(selected && shouldShowComposerStop({
    loopActive,
    busy,
    awaitingDelegations,
    delegationWorkActive,
  }))
  const buttonIsStop = Boolean(showStop && (loopActive || !canSend))
  const editingQueuedText = editingQueuedId
    ? (queuedTurns.find(item => item.id === editingQueuedId)?.text ?? '')
    : ''

  // Al desmontar se van los objectURL: los del chat abierto y los guardados.
  useEffect(() => {
    return () => {
      const stashed = Object.values(draftsRef.current).flatMap(entry => entry.images)
      const all = [...pendingImagesRef.current, ...stashed]
      all.forEach(image => URL.revokeObjectURL(image.previewUrl))
    }
  }, [])

  // Al cambiar o salir del chat, el input recupera el borrador de ESE agente.
  useEffect(() => {
    const agentId = selectedAgentId
    const saved = agentId ? draftsRef.current[agentId] : undefined
    setDraft(saved?.text ?? '')
    setPendingImages(saved?.images ?? [])
    setPendingContextIds(saved?.contextIds ?? [])
    setEditingQueuedId(null)
    setSketchOpen(false)
    setMentionQuery(null)
    historyRef.current = []
    stashRef.current = ''
    setHistoryIndex(null)
    const el = composerInputRef.current
    if (el) {
      el.style.height = 'auto'
    }
    // El cleanup corre antes del próximo efecto: guarda con el id que salía.
    return () => {
      if (agentId) draftsRef.current[agentId] = draftRef.current
    }
    // ponytail: los borradores de un agente eliminado quedan hasta desmontar el
    // plane (unos strings y sus objectURL); purgar contra `agents` obligaría a
    // meter la lista en las deps y el efecto se comería el borrador en cada cambio.
  }, [selectedAgentId])

  useEffect(() => {
    const el = composerInputRef.current
    if (el) resizeComposerTextarea(el)
  }, [draft])

  // Si el turno editado ya no está en la cola (p. ej. tras merge), cerrar el modal.
  useEffect(() => {
    if (editingQueuedId !== null && !queuedTurns.some(item => item.id === editingQueuedId)) {
      setEditingQueuedId(null)
    }
  }, [queuedTurns, editingQueuedId])

  // Sin cwd no hay proyecto Jira que consultar: la mención se queda desactivada
  // (y ningún test que no pase `cwd` necesita mockear `window.api`).
  useEffect(() => {
    if (!cwd.trim()) {
      setJiraProjectKeys([])
      return
    }
    let cancelled = false
    void window.api.jiraStatus(cwd).then(status => {
      if (!cancelled) setJiraProjectKeys(status.connected ? status.projectKeys : [])
    })
    return () => { cancelled = true }
  }, [cwd])

  /**
   * Clave elegida en el picker → contexto `jira` real en disco y adjunto a
   * ESTE turno, exactamente por la vía que ya usa soltar un chip del pool
   * (`pendingContextIds`). `materializeTabContext` es la misma llamada que
   * hace `TabContextFormModal.save()`: sin ella el contexto nunca llega a
   * existir en `.gravity/jira/` y la mención "funcionaría" sin entregar nada
   * (el bug de la Tarea 9, con otro disfraz).
   */
  const attachJiraMention = useCallback((issueKey: string): void => {
    setMentionQuery(null)
    const context = jiraDraftFromKey(issueKey)
    if (!context || !cwd.trim()) return
    void window.api.materializeTabContext({ context, cwd }).then(result => {
      if (!result.ok) return
      onContextSaved?.()
      setPendingContextIds(previous => (
        previous.includes(context.id) ? previous : [...previous, context.id]
      ))
    })
  }, [cwd, onContextSaved])

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
    if (!files.length) return
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
  }, [appendPendingImages])

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
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setDropActive(true)
  }, [])

  const handleDragLeave = useCallback((event: React.DragEvent): void => {
    // Solo al salir del composer entero, no al cruzar entre sus hijos.
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setDropActive(false)
  }, [])

  const handleDrop = useCallback((event: React.DragEvent): void => {
    if (!hasPlaneContextDrag(event.dataTransfer)) return
    event.preventDefault()
    setDropActive(false)
    const id = readPlaneContextDragData(event.dataTransfer)
    if (!id || !contexts.some(context => context.id === id)) return
    setPendingContextIds(previous => (
      previous.includes(id) ? previous : [...previous, id]
    ))
  }, [contexts])

  const submit = useCallback((overrideText?: string): void => {
    const text = (overrideText ?? draft).trim()
    if (!selected || composerLocked || (!text && pendingImages.length === 0)) return
    const imagesSnapshot = pendingImages
    const contextIdsSnapshot = pendingContextIds
    historyRef.current = rememberComposerEntry(historyRef.current, text)
    stashRef.current = ''
    setHistoryIndex(null)
    setDraft('')
    setPendingImages([])
    setPendingContextIds([])
    setMentionQuery(null)
    void pendingImagesToAttachments(imagesSnapshot).then(attachments => {
      imagesSnapshot.forEach(image => URL.revokeObjectURL(image.previewUrl))
      onSend(selected.paneId, text, attachments, contextIdsSnapshot)
    })
  }, [
    composerLocked,
    draft,
    onSend,
    pendingContextIds,
    pendingImages,
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
  const { listening, interim, level, start: startDictation, stop: stopDictation } =
    usePushToTalkSpeech({
      lang: speechLang,
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
    && !composerLocked
    && !draft.trim()
    && pendingImages.length === 0,
  )

  const composerWorking = Boolean(busy || loopActive || awaitingDelegations || delegationWorkActive)

  return (
    <div
      className={[
        'plane-chat-composer',
        composerWorking
          ? 'plane-chat-composer--working'
          : '',
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
          text={interim.trim() || t('agentPane.dictationLive')}
        />
        {queuedTurns.length > 0 && (
          <div className="plane-chat-composer__pending-row">
            <div
              className="plane-chat-composer__queue"
              aria-label={t('agentPane.queueLabel', { n: queuedTurns.length })}
            >
              {onMergeQueuedTurns
                && selectedAgentId
                && queuedTurns.filter(item => (
                  !item.delegation && !item.orchestrationFollowUp
                )).length >= 2 && (
                <button
                  type="button"
                  className="plane-chat-composer__queue-merge"
                  aria-label={t('agentPane.queueMerge')}
                  onClick={() => onMergeQueuedTurns(selectedAgentId)}
                >
                  {t('agentPane.queueMerge')}
                </button>
              )}
              {queuedTurns.map((item, index) => (
                <div key={item.id} className="plane-chat-composer__queue-bubble">
                  <PlaneChatQueueEditButton
                    position={index + 1}
                    text={item.text}
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
              ))}
            </div>
          </div>
        )}

        <div className="plane-chat-composer__agents" role="listbox" aria-label={sendLabel}>
          {agents.length === 0 ? (
            <span className="plane-chat-composer__empty">{emptyAgentsHint}</span>
          ) : (
            <>
              {agents.map(agent => (
                <PlaneAgentBadge
                  key={agent.paneId}
                  name={agent.title}
                  instanceTag={agent.instanceTag}
                  replicaCount={agent.replicaCount}
                  selected={agent.paneId === selectedAgentId}
                  busy={agent.busy}
                  onSelect={() => onSelectAgent(agent.paneId)}
                />
              ))}
              {selectedAgentId && onCloseChat ? (
                <PlaneChatCloseButton
                  label={t('tabs.planeCloseChat')}
                  onClose={onCloseChat}
                />
              ) : null}
            </>
          )}
        </div>

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

        <div className="plane-chat-composer__row">
          <PlaneSketchButton
            label={t('sketch.open')}
            disabled={agents.length === 0 || composerLocked || pendingImages.length >= MAX_PENDING_IMAGES}
            onClick={() => setSketchOpen(true)}
          />
          <span className="plane-chat-composer__field">
            <div
              className={[
                'plane-chat-composer__input-shell',
                historyIndex !== null ? 'plane-chat-composer__input-shell--recalling' : '',
              ].filter(Boolean).join(' ')}
            >
              <textarea
                ref={composerInputRef}
                className={`plane-chat-composer__input${historyIndex !== null ? ' plane-chat-composer__input--recalling' : ''}`}
                value={draft}
                disabled={agents.length === 0 || composerLocked}
                placeholder={
                  agents.length === 0
                    ? emptyAgentsHint
                    : loopActive
                      ? t('agentPane.loopPlaceholder')
                      : turboAwaitingOpen
                        ? t('agentPane.turboAwaitingPlaceholder')
                        : busy || awaitingDelegations || delegationWorkActive || orchestratorBusy
                          ? t('agentPane.queuePlaceholder')
                          : placeholder
                }
                rows={1}
                onChange={event => {
                  const value = event.target.value
                  setDraft(value)
                  // Editar el texto recuperado es tomar posesión: vuelve a idle.
                  if (historyIndex !== null) setHistoryIndex(null)
                  setMentionQuery(
                    mentionQueryAt(value, event.target.selectionStart ?? value.length, jiraProjectKeys),
                  )
                }}
                onPaste={handlePaste}
                onKeyDown={event => {
                  // Con la mención abierta, estas teclas son del picker (ver
                  // JiraMentionPicker): no enviar, no navegar historial, no
                  // dejar que el Enter mueva el cursor con un salto de línea.
                  if (
                    mentionQuery !== null
                    && (event.key === 'ArrowUp' || event.key === 'ArrowDown'
                      || event.key === 'Enter' || event.key === 'Escape')
                  ) {
                    event.preventDefault()
                    return
                  }
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    handleSendClick()
                    return
                  }
                  handleHistoryKey(event)
                }}
              />
              {mentionQuery !== null ? (
                <JiraMentionPicker
                  cwd={cwd}
                  query={mentionQuery}
                  onPick={issue => attachJiraMention(issue.key)}
                  onDismiss={() => setMentionQuery(null)}
                />
              ) : null}
              {pendingImages.length > 0 ? (
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
            </div>
            {historyIndex !== null ? (
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
          </span>
          <PlaneChatSendButton
            mode={buttonIsStop ? 'stop' : micMode ? 'mic' : 'send'}
            label={
              buttonIsStop
                ? t('agentPane.stop')
                : micMode
                  ? (listening ? t('agentPane.dictationListening') : t('agentPane.dictationHold'))
                  : sendLabel
            }
            listening={listening}
            disabled={!buttonIsStop && !micMode && !canSend}
            onClick={handleSendClick}
            onMicStart={startDictation}
            onMicStop={stopDictation}
          />
        </div>
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
        onClose={() => setEditingQueuedId(null)}
        onSave={text => {
          if (editingQueuedId && selectedAgentId) {
            onUpdateQueuedTurn?.(selectedAgentId, editingQueuedId, text)
          }
        }}
      />
      </div>
  )
}
