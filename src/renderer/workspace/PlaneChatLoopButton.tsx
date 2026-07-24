import React from 'react'
import { Icon } from '../components/ui/Icon'
import './PlaneChatComposer.css'

export interface PlaneChatLoopButtonProps {
  pressed: boolean
  active?: boolean
  disabled?: boolean
  label: string
  ariaLabel: string
  title: string
  onClick: () => void
}

/** Control de loop en la barra encima del chat. */
export const PlaneChatLoopButton: React.FC<PlaneChatLoopButtonProps> = ({
  pressed,
  active = false,
  disabled = false,
  label,
  ariaLabel,
  title,
  onClick,
}) => (
  <button
    type="button"
    className={[
      'plane-chat-composer__loop',
      pressed ? 'plane-chat-composer__loop--on' : '',
      active ? 'plane-chat-composer__loop--active' : '',
    ].filter(Boolean).join(' ')}
    title={title}
    aria-label={ariaLabel}
    aria-pressed={pressed}
    disabled={disabled}
    onClick={onClick}
  >
    <Icon name="repeat" size={13} />
    <span className="plane-chat-composer__loop-label">{label}</span>
  </button>
)
