import React, { useEffect, useState } from 'react'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import { Button } from '../components/ui/Button'
import { PendingImageThumb } from '../components/PendingImageThumb'
import './QueuedTurnEditModal.css'

export interface QueuedTurnEditModalProps {
  open: boolean
  initialText: string
  images?: Array<{ id: string; previewUrl: string; name: string }>
  onSave: (text: string) => void
  onClose: () => void
}

/** Modal para editar el texto de un mensaje en cola. */
export const QueuedTurnEditModal: React.FC<QueuedTurnEditModalProps> = ({
  open,
  initialText,
  images = [],
  onSave,
  onClose,
}) => {
  const { t } = useT()
  const [draft, setDraft] = useState(initialText)

  useEffect(() => {
    if (open) setDraft(initialText)
  }, [open, initialText])

  const trimmed = draft.trim()
  const canSave = trimmed.length > 0 || images.length > 0 || initialText.trim().length === 0

  return (
    <TerminalModal
      open={open}
      onClose={onClose}
      title={t('agentPane.queueEditTitle')}
      size="md"
      closeOnBackdrop
      footer={(
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!canSave}
            onClick={() => {
              onSave(draft.trim())
              onClose()
            }}
          >
            {t('agentPane.queueEditSave')}
          </Button>
        </>
      )}
    >
      <>
        {images.length > 0 ? (
          <div
            className="queued-turn-edit__images"
            aria-label={t('agentPane.imagesAttached', { n: images.length })}
          >
            {images.map(image => (
              <PendingImageThumb
                key={image.id}
                src={image.previewUrl}
                name={image.name}
              />
            ))}
          </div>
        ) : null}
        <label className="queued-turn-edit">
          <span className="queued-turn-edit__label">{t('agentPane.queueEditLabel')}</span>
          <textarea
            className="queued-turn-edit__input"
            value={draft}
            rows={6}
            autoFocus
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && canSave) {
                event.preventDefault()
                onSave(draft.trim())
                onClose()
              }
            }}
          />
        </label>
      </>
    </TerminalModal>
  )
}
