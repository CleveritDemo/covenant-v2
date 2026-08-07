import React from 'react'
import { Icon } from '../components/ui/Icon'
import './PlaneChatComposer.css'

export interface PlaneChatSendButtonProps {
  mode: 'send' | 'stop'
  label: string
  disabled?: boolean
  onClick: () => void
}

/** Enviar / stop del composer del plano. */
export const PlaneChatSendButton: React.FC<PlaneChatSendButtonProps> = ({
  mode,
  label,
  disabled = false,
  onClick,
}) => (
  <button
    type="button"
    className={[
      'plane-chat-composer__send',
      mode === 'stop' ? 'plane-chat-composer__send--stop' : '',
    ].filter(Boolean).join(' ')}
    disabled={disabled}
    aria-label={label}
    onClick={onClick}
  >
    <Icon name={mode === 'stop' ? 'stop' : 'send'} size={14} />
  </button>
)
