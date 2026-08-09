import React from 'react'
import { Icon } from '../components/ui/Icon'
import { Tooltip } from '../components/ui/Tooltip'
import './PlaneChatComposer.css'

export interface PlaneChatAutoImproveToggleProps {
  checked: boolean
  disabled?: boolean
  label: string
  /** Explica qué hace (y, si está deshabilitado, qué falta). */
  hint?: string
  onChange: (checked: boolean) => void
}

/** Chip de autoactualización de contextos en la barra del chat. */
export const PlaneChatAutoImproveToggle: React.FC<PlaneChatAutoImproveToggleProps> = ({
  checked,
  disabled = false,
  label,
  hint,
  onChange,
}) => (
  <Tooltip content={hint ?? ''}>
    <button
      type="button"
      className={[
        'plane-chat-composer__chip',
        'plane-chat-composer__auto-improve',
        checked ? 'plane-chat-composer__chip--on' : '',
      ].filter(Boolean).join(' ')}
      aria-pressed={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <Icon name="sparkles" size={13} />
      <span className="plane-chat-composer__auto-improve-label">{label}</span>
    </button>
  </Tooltip>
)
