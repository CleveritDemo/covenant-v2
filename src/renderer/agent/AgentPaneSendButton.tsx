import React from 'react'
import { Icon } from '../components/ui/Icon'
import './AgentPane.css'

export type AgentPaneSendMode = 'send' | 'stop' | 'play'

export interface AgentPaneSendButtonProps {
  mode: AgentPaneSendMode
  label: string
  disabled?: boolean
  onClick: () => void
}

/** Send / stop / play del composer del AgentPane. */
export const AgentPaneSendButton: React.FC<AgentPaneSendButtonProps> = ({
  mode,
  label,
  disabled = false,
  onClick,
}) => (
  <button
    type="button"
    className={[
      'agent-pane__send',
      mode === 'stop' ? 'agent-pane__send--stop' : '',
      mode === 'play' ? 'agent-pane__send--play' : '',
    ].filter(Boolean).join(' ')}
    disabled={disabled}
    aria-label={label}
    onClick={onClick}
    onMouseDown={event => event.stopPropagation()}
  >
    <Icon name={mode === 'stop' ? 'stop' : mode === 'play' ? 'play' : 'send'} size={14} />
  </button>
)
