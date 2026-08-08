import React from 'react'
import { Icon } from '../components/ui/Icon'
import './PlaneChatComposer.css'

export interface PlaneChatContextsTriggerProps {
  label: string
  ariaLabel: string
  count: number
  open: boolean
  disabled?: boolean
  onClick: () => void
}

/** Disparador del picker de contextos encima del chat. */
export const PlaneChatContextsTrigger: React.FC<PlaneChatContextsTriggerProps> = ({
  label,
  ariaLabel,
  count,
  open,
  disabled = false,
  onClick,
}) => (
  <button
    type="button"
    className={[
      'plane-chat-composer__chip',
      'plane-chat-composer__contexts-trigger',
      // Encendido si hay contextos elegidos o el menú está abierto.
      count > 0 || open ? 'plane-chat-composer__chip--on' : '',
    ].filter(Boolean).join(' ')}
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-label={ariaLabel}
    disabled={disabled}
    onClick={onClick}
  >
    <Icon name="files" size={13} />
    <span className="plane-chat-composer__contexts-label">{label}</span>
    {count > 0 && (
      <span className="plane-chat-composer__contexts-count" aria-hidden="true">
        {count}
      </span>
    )}
    <Icon name="chevron-down" size={11} />
  </button>
)
