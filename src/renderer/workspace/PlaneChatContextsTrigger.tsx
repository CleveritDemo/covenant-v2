import React from 'react'
import { Icon } from '../components/ui/Icon'
import './PlaneChatComposer.css'

export interface PlaneChatContextsTriggerProps {
  label: string
  ariaLabel: string
  title: string
  count: number
  open: boolean
  disabled?: boolean
  onClick: () => void
}

/** Disparador del picker de contextos encima del chat. */
export const PlaneChatContextsTrigger: React.FC<PlaneChatContextsTriggerProps> = ({
  label,
  ariaLabel,
  title,
  count,
  open,
  disabled = false,
  onClick,
}) => (
  <button
    type="button"
    className="plane-chat-composer__contexts-trigger"
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-label={ariaLabel}
    disabled={disabled}
    title={title}
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
