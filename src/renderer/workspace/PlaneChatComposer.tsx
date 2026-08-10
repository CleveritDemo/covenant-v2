import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ClipboardEvent } from 'react'
import type { AgentCliImageAttachment } from '@shared/agentCliTypes'
import { hasPlaneContextDrag, readPlaneContextDragData } from './planeContextDrag'
import type { PlaneContextPoolItem } from './PlaneContextPool'
import type { GitListedRepo } from '@shared/gitSessionTypes'
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
import { PlaneChatSendButton } from './PlaneChatSendButton'
import { PlaneComposerAurora } from './PlaneComposerAurora'
import { PlaneSketchButton } from './PlaneSketchButton'
import { SketchModal } from './SketchModal'
import { usePushToTalkSpeech, classifyDictationError } from '../pushToTalkSpeech'
import { DictationListeningOverlay } from '../components/DictationListeningOverlay'
import { shouldShowComposerStop } from '../agent/agentInputGuards'
import './PlaneChatComposer.css'

const MAX_COMPOSER_ROWS = 8

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
  const [dropActive, setDropActive] = useState(false)
  const [editingQueuedId, setEditingQueuedId] = useState<string | null>(null)
  const [sketchOpen, setSketchOpen] = useState(false)
  const composerInputRef = useRef<HTMLTextAreaElement>(null)
  const pendingImagesRef = useRef(pendingImages)
  pendingImagesRef.current = pendingImages

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

  useEffect(() => {
    return () => {
      pendingImagesRef.current.forEach(image => URL.revokeObjectURL(image.previewUrl))
    }
  }, [])

  // Al cambiar o salir del chat, el input no debe arrastrar el borrador anterior.
  useEffect(() => {
    setDraft('')
    setPendingImages(previous => {
      previous.forEach(image => URL.revokeObjectURL(image.previewUrl))
      return []
    })
    setEditingQueuedId(null)
    setSketchOpen(false)
    const el = composerInputRef.current
    if (el) {
      el.style.height = 'auto'
    }
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
    setDraft('')
    setPendingImages([])
    setPendingContextIds([])
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

  const mapDictationError = useCallback((
    code: string,
    detail?: { peak?: number },
  ): string => {
    const kind = classifyDictationError(code)
    if (kind === 'unsupported') return t('agentPane.dictationUnsupported')
    if (kind === 'helperMissing') return t('agentPane.dictationHelperMissing')
    if (kind === 'startFailed') return t('agentPane.dictationStartFailed')
    if (kind === 'permission') return t('agentPane.dictationPermissionDenied')
    if (kind === 'electronUnavailable') return t('agentPane.dictationUnavailableElectron')
    if (kind === 'noSpeech') return t('agentPane.dictationNoSpeech')
    if (kind === 'tooShort') return t('agentPane.dictationTooShort')
    if (kind === 'noAudio') {
      // El pico medido separa "micro mudo" de "el tap nunca recibió buffers".
      const peak = typeof detail?.peak === 'number' ? detail.peak : 0
      return t('agentPane.dictationNoAudio', { peak: peak.toFixed(3) })
    }
    return t('agentPane.dictationError')
  }, [t])

  const speechLang = i18n.language?.toLowerCase().startsWith('es') ? 'es-ES' : 'en-US'
  const { listening, interim, level, start: startDictation, stop: stopDictation } =
    usePushToTalkSpeech({
      lang: speechLang,
      onTranscript: text => {
        submit(text)
      },
      onError: (code, detail) => {
        setDictationError(mapDictationError(code, detail))
        window.setTimeout(() => setDictationError(''), 5000)
      },
    })

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

  return (
    <>
      <div
        className={[
          'plane-chat-composer-aurora-host',
          busy || loopActive || awaitingDelegations || delegationWorkActive
            ? 'plane-chat-composer--working'
            : '',
        ].filter(Boolean).join(' ')}
        aria-hidden="true"
      >
        <PlaneComposerAurora />
      </div>
      <div
        className={[
          'plane-chat-composer',
          busy || loopActive || awaitingDelegations || delegationWorkActive
            ? 'plane-chat-composer--working'
            : '',
          dropActive ? 'plane-chat-composer--drop' : '',
        ].filter(Boolean).join(' ')}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
      <div className="plane-chat-composer__body">
        <DictationListeningOverlay
          active={listening}
          level={level}
          text={interim.trim() || t('agentPane.dictationLive')}
        />
        {queuedTurns.length > 0 && selectedAgentId && (
          <div
            className="plane-chat-composer__queue"
            aria-label={t('agentPane.queueLabel', { n: queuedTurns.length })}
          >
            {onMergeQueuedTurns
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
                <PlaneChatRemoveChipButton
                  appearance="queue"
                  label={t('agentPane.queueRemove')}
                  onClick={() => onRemoveQueuedTurn?.(selectedAgentId, item.id)}
                />
              </div>
            ))}          </div>
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

        {pendingImages.length > 0 && (
          <div
            className="plane-chat-composer__attachments"
            aria-label={t('agentPane.imagesAttached', { n: pendingImages.length })}
          >
            {pendingImages.map(image => (
              <div key={image.id} className="plane-chat-composer__attachment">
                <img src={image.previewUrl} alt={image.name} />
                <PlaneChatRemoveChipButton
                  appearance="attachment"
                  label={t('agentPane.removeImage')}
                  onClick={() => removePendingImage(image.id)}
                />
              </div>
            ))}          </div>
        )}

        <div className="plane-chat-composer__row">
          <PlaneSketchButton
            label={t('sketch.open')}
            disabled={agents.length === 0 || composerLocked || pendingImages.length >= MAX_PENDING_IMAGES}
            onClick={() => setSketchOpen(true)}
          />
          <textarea
            ref={composerInputRef}
            className="plane-chat-composer__input"
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
            onChange={event => setDraft(event.target.value)}
            onPaste={handlePaste}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                handleSendClick()
              }
            }}
          />
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
    </>
  )
}
