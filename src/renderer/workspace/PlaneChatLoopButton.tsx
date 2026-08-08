import React from 'react'
import { Icon } from '../components/ui/Icon'
import './PlaneChatComposer.css'

export interface PlaneChatLoopButtonProps {
  pressed: boolean
  active?: boolean
  disabled?: boolean
  label: string
  ariaLabel: string
  onClick: () => void
}

/** Control de loop en la barra encima del chat. */
export const PlaneChatLoopButton: React.FC<PlaneChatLoopButtonProps> = ({
  pressed,
  active = false,
  disabled = false,
  label,
  ariaLabel,
  onClick,
}) => (
  <button
    type="button"
    className={[
      'plane-chat-composer__chip',
      'plane-chat-composer__loop',
      pressed || active ? 'plane-chat-composer__chip--on' : '',
      active ? 'plane-chat-composer__chip--running' : '',
    ].filter(Boolean).join(' ')}
    aria-label={ariaLabel}
    aria-pressed={pressed}
    disabled={disabled}
    onClick={onClick}
  >
    <Icon name="repeat" size={13} />
    <span className="plane-chat-composer__loop-label">{label}</span>
  </button>
)
