import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { ClipboardEvent } from 'react'
import type { AgentCliImageAttachment } from '@shared/agentCliTypes'
import type { GitListedRepo } from '@shared/gitSessionTypes'
import { useT } from '@i18n/useT'
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
import type { PlaneChatContextOption } from './PlaneChatContextsBar'
import { PlaneChatQueueEditButton } from './PlaneChatQueueEditButton'
import { PlaneChatRemoveChipButton } from './PlaneChatRemoveChipButton'
import { PlaneChatSendButton } from './PlaneChatSendButton'
import { PlaneComposerAurora } from './PlaneComposerAurora'
import { PlaneSketchButton } from './PlaneSketchButton'
import { SketchModal } from './SketchModal'
import './PlaneChatComposer.css'

export type { PlaneChatContextOption }

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
  selectedAgentId: string | null
  placeholder: string
  emptyAgentsHint: string
  sendLabel: string
  queuedTurns?: PlaneChatQueuedTurn[]
  onSelectAgent: (paneId: string) => void
  onCloseChat?: () => void
  onStop: (paneId: string) => void
  onSend: (paneId: string, text: string, images: AgentCliImageAttachment[]) => void
  onRemoveQueuedTurn?: (paneId: string, id: string) => void
  onUpdateQueuedTurn?: (paneId: string, id: string, text: string) => void
  onMergeQueuedTurns?: (paneId: string) => void
  /** Repos git del root folder del tab, listados bajo el input. */
  gitRepos?: GitListedRepo[]
  /** Clic en un repo de la lista → abre su modal git. */
  onOpenRepoGit?: (path: string) => void
}

export const PlaneChatComposer: React.FC<PlaneChatComposerProps> = ({
  agents,
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
}) => {
  const { t } = useT()
  const [draft, setDraft] = useState('')
  const [pendingImages, setPendingImages] = useState<ComposerPendingImage[]>([])
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
  // Solo el loop bloquea teclear; busy/delegaciones permiten encolar.
  const composerLocked = loopActive
  const canSend = Boolean(
    selected && !composerLocked && (draft.trim() || pendingImages.length > 0),
  )
  const showStop = Boolean(selected && (loopActive || busy || awaitingDelegations))
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

  const submit = (): void => {
    const text = draft.trim()
    if (!selected || composerLocked || (!text && pendingImages.length === 0)) return
    const imagesSnapshot = pendingImages
    setDraft('')
    setPendingImages([])
    void pendingImagesToAttachments(imagesSnapshot).then(attachments => {
      imagesSnapshot.forEach(image => URL.revokeObjectURL(image.previewUrl))
      onSend(selected.paneId, text, attachments)
    })
  }

  const handleSendClick = (): void => {
    if (buttonIsStop && selected) {
      onStop(selected.paneId)
      return
    }
    if (canSend) submit()
  }

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
        ].filter(Boolean).join(' ')}
      >
      <div className="plane-chat-composer__body">
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
            mode={buttonIsStop ? 'stop' : 'send'}
            label={buttonIsStop ? t('agentPane.stop') : sendLabel}
            disabled={!buttonIsStop && !canSend}
            onClick={handleSendClick}
          />        </div>

        {gitRepos.length > 0 && (
          <div className="plane-chat-composer__repos">
            {gitRepos.map(repo => (
              <button
                key={repo.path}
                type="button"
                className="plane-chat-composer__repo-chip"
                title={t('tabs.planeRepoGitTitle', { name: repo.name })}
                onClick={() => onOpenRepoGit?.(repo.path)}
              >
                {repo.name}
              </button>
            ))}
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
