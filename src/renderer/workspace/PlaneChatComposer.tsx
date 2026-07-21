import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { ClipboardEvent } from 'react'
import type { AgentCliImageAttachment } from '@shared/agentCliTypes'
import { Icon } from '../components/ui/Icon'
import { useT } from '@i18n/useT'
import {
  extensionForMime,
  imagesFromClipboard,
  materializeClipboardImage,
  MAX_PENDING_IMAGES,
  pendingImagesToAttachments,
  type ComposerPendingImage,
} from '../agent/composerImages'
import { QueuedTurnEditModal } from '../agent/QueuedTurnEditModal'
import { PlaneAgentBadge } from './PlaneAgentBadge'
import { PlaneChatCloseButton } from './PlaneChatCloseButton'
import type { PlaneChatContextOption } from './PlaneChatContextsBar'
import { PlaneComposerAurora } from './PlaneComposerAurora'
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
  color: string
}

export interface PlaneChatQueuedTurn {
  id: string
  text: string
  images: Array<{ id: string; previewUrl: string; name: string }>
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
}) => {
  const { t } = useT()
  const [draft, setDraft] = useState('')
  const [pendingImages, setPendingImages] = useState<ComposerPendingImage[]>([])
  const [editingQueuedId, setEditingQueuedId] = useState<string | null>(null)
  const composerInputRef = useRef<HTMLTextAreaElement>(null)
  const pendingImagesRef = useRef(pendingImages)
  pendingImagesRef.current = pendingImages

  const selected = agents.find(agent => agent.paneId === selectedAgentId) ?? null
  const busy = Boolean(selected?.busy)
  const canSend = Boolean(selected && (draft.trim() || pendingImages.length > 0))
  const buttonIsStop = Boolean(busy && selected && !canSend)
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
    const el = composerInputRef.current
    if (el) {
      el.style.height = 'auto'
    }
  }, [selectedAgentId])

  useEffect(() => {
    const el = composerInputRef.current
    if (el) resizeComposerTextarea(el)
  }, [draft])

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

  const submit = (): void => {
    const text = draft.trim()
    if (!selected || (!text && pendingImages.length === 0)) return
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
          busy ? 'plane-chat-composer--working' : '',
        ].filter(Boolean).join(' ')}
        aria-hidden="true"
      >
        <PlaneComposerAurora />
      </div>
      <div
        className={[
          'plane-chat-composer',
          busy ? 'plane-chat-composer--working' : '',
        ].filter(Boolean).join(' ')}
      >
      <div className="plane-chat-composer__body">
        {queuedTurns.length > 0 && selectedAgentId && (
          <div
            className="plane-chat-composer__queue"
            aria-label={t('agentPane.queueLabel', { n: queuedTurns.length })}
          >
            {queuedTurns.map((item, index) => (
              <div key={item.id} className="plane-chat-composer__queue-bubble">
                <button
                  type="button"
                  className="plane-chat-composer__queue-open"
                  title={t('agentPane.queueEditHint')}
                  aria-label={t('agentPane.queueEditHint')}
                  onClick={() => setEditingQueuedId(item.id)}
                >
                  <span className="plane-chat-composer__queue-pos" aria-hidden="true">
                    {index + 1}
                  </span>
                  {item.images.length > 0 && (
                    <span className="plane-chat-composer__queue-images">
                      {item.images.map(image => (
                        <img
                          key={image.id}
                          className="plane-chat-composer__queue-image"
                          src={image.previewUrl}
                          alt={image.name}
                        />
                      ))}
                    </span>
                  )}
                  {(item.text || item.images.length === 0) && (
                    <span className="plane-chat-composer__queue-text">
                      {item.text || t('agentPane.imageOnlyMessage')}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className="plane-chat-composer__queue-remove"
                  title={t('agentPane.queueRemove')}
                  aria-label={t('agentPane.queueRemove')}
                  onClick={() => onRemoveQueuedTurn?.(selectedAgentId, item.id)}
                >
                  ×
                </button>
              </div>
            ))}
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
                  color={agent.color}
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
                <button
                  type="button"
                  className="plane-chat-composer__attachment-remove"
                  onClick={() => removePendingImage(image.id)}
                  title={t('agentPane.removeImage')}
                  aria-label={t('agentPane.removeImage')}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="plane-chat-composer__row">
          <textarea
            ref={composerInputRef}
            className="plane-chat-composer__input"
            value={draft}
            disabled={agents.length === 0}
            placeholder={
              agents.length === 0
                ? emptyAgentsHint
                : busy
                  ? t('agentPane.queuePlaceholder')
                  : placeholder
            }
            rows={1}
            onChange={event => setDraft(event.target.value)}
            onPaste={handlePaste}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                submit()
              }
            }}
          />
          <button
            type="button"
            className={[
              'plane-chat-composer__send',
              buttonIsStop ? 'plane-chat-composer__send--stop' : '',
            ].filter(Boolean).join(' ')}
            disabled={!buttonIsStop && !canSend}
            title={buttonIsStop ? t('agentPane.stop') : sendLabel}
            aria-label={buttonIsStop ? t('agentPane.stop') : sendLabel}
            onClick={handleSendClick}
          >
            <Icon name={buttonIsStop ? 'stop' : 'send'} size={14} />
          </button>
        </div>
      </div>

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
