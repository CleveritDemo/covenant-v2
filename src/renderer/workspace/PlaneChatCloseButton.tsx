import React from 'react'
import { Icon } from '../components/ui/Icon'
import './PlaneChatCloseButton.css'

export interface PlaneChatCloseButtonProps {
  label: string
  onClose: () => void
}

/** Botón circular para cerrar el chat activo del composer. */
export const PlaneChatCloseButton: React.FC<PlaneChatCloseButtonProps> = ({
  label,
  onClose,
}) => (
  <button
    type="button"
    className="plane-chat-close"
    title={label}
    aria-label={label}
    onClick={onClose}
  >
    <Icon name="close" size={11} />
  </button>
)
