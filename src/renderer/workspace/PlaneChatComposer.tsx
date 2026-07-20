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
import { PlaneAgentBadge } from './PlaneAgentBadge'
import type { PlaneChatContextOption } from './PlaneChatContextsBar'
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

export interface PlaneChatComposerProps {
  agents: PlaneChatAgentOption[]
  selectedAgentId: string | null
  placeholder: string
  emptyAgentsHint: string
  sendLabel: string
  onSelectAgent: (paneId: string) => void
  onStop: (paneId: string) => void
  onSend: (paneId: string, text: string, images: AgentCliImageAttachment[]) => void
}

export const PlaneChatComposer: React.FC<PlaneChatComposerProps> = ({
  agents,
  selectedAgentId,
  placeholder,
  emptyAgentsHint,
  sendLabel,
  onSelectAgent,
  onStop,
  onSend,
}) => {
  const { t } = useT()
  const [draft, setDraft] = useState('')
  const [pendingImages, setPendingImages] = useState<ComposerPendingImage[]>([])
  const composerInputRef = useRef<HTMLTextAreaElement>(null)
  const pendingImagesRef = useRef(pendingImages)
  pendingImagesRef.current = pendingImages

  const selected = agents.find(agent => agent.paneId === selectedAgentId) ?? null
  const busy = Boolean(selected?.busy)
  const showStop = busy
  const canSend = Boolean(selected && (draft.trim() || pendingImages.length > 0))

  useEffect(() => {
    return () => {
      pendingImagesRef.current.forEach(image => URL.revokeObjectURL(image.previewUrl))
    }
  }, [])

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
    if (showStop && selected) {
      onStop(selected.paneId)
      return
    }
    submit()
  }

  const accent = selected?.color ?? 'var(--accent)'

  return (
    <div
      className={[
        'plane-chat-composer',
        busy ? 'plane-chat-composer--working' : '',
      ].filter(Boolean).join(' ')}
      style={{ '--plane-composer-accent': accent } as React.CSSProperties}
    >
      <div className="plane-chat-composer__aurora" aria-hidden="true" />
      <div className="plane-chat-composer__body">
        <div className="plane-chat-composer__agents" role="listbox" aria-label={sendLabel}>
          {agents.length === 0 ? (
            <span className="plane-chat-composer__empty">{emptyAgentsHint}</span>
          ) : (
            agents.map(agent => (
              <PlaneAgentBadge
                key={agent.paneId}
                name={agent.title}
                color={agent.color}
                selected={agent.paneId === selectedAgentId}
                busy={agent.busy}
                onSelect={() => onSelectAgent(agent.paneId)}
              />
            ))
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
              showStop ? 'plane-chat-composer__send--stop' : '',
            ].filter(Boolean).join(' ')}
            disabled={!showStop && !canSend}
            title={showStop ? t('agentPane.stop') : sendLabel}
            aria-label={showStop ? t('agentPane.stop') : sendLabel}
            onClick={handleSendClick}
          >
            <Icon name={showStop ? 'stop' : 'send'} size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
