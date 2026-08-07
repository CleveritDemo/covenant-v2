import React from 'react'
import './PlaneChatComposer.css'

export interface PlaneChatRemoveChipButtonProps {
  label: string
  onClick: () => void
  appearance?: 'queue' | 'attachment'
}

/** Chip de quitar (cola o adjunto) en el composer. */
export const PlaneChatRemoveChipButton: React.FC<PlaneChatRemoveChipButtonProps> = ({
  label,
  onClick,
  appearance = 'queue',
}) => (
  <button
    type="button"
    className={
      appearance === 'attachment'
        ? 'plane-chat-composer__attachment-remove'
        : 'plane-chat-composer__queue-remove'
    }
    aria-label={label}
    onClick={onClick}
  >
    ×
  </button>
)
