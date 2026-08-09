import React from 'react'
import './PlaneChatComposer.css'

export interface PlaneChatRemoveChipButtonProps {
  label: string
  onClick: () => void
  /**
   * `attachment` es el círculo oscuro que va ENCIMA de una miniatura; sobre un
   * chip de texto se lee como un borrón. Para esos está `chip`.
   */
  appearance?: 'queue' | 'attachment' | 'chip'
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
        : appearance === 'chip'
          ? 'plane-chat-composer__chip-remove'
          : 'plane-chat-composer__queue-remove'
    }
    aria-label={label}
    onClick={onClick}
  >
    ×
  </button>
)
