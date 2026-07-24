import React from 'react'
import { Icon } from '../components/ui/Icon'
import './PlaneChatComposer.css'

export interface PlaneChatAutoImproveToggleProps {
  checked: boolean
  disabled?: boolean
  label: string
  hint: string
  onChange: (checked: boolean) => void
}

/** Switch de auto-improve con icono + texto visible en la barra del chat. */
export const PlaneChatAutoImproveToggle: React.FC<PlaneChatAutoImproveToggleProps> = ({
  checked,
  disabled = false,
  label,
  hint,
  onChange,
}) => (
  <button
    type="button"
    role="switch"
    className={[
      'plane-chat-composer__auto-improve',
      checked ? 'plane-chat-composer__auto-improve--on' : '',
    ].filter(Boolean).join(' ')}
    aria-checked={checked}
    aria-label={label}
    title={hint}
    disabled={disabled}
    onClick={() => onChange(!checked)}
  >
    <Icon name="sparkles" size={13} />
    <span className="plane-chat-composer__auto-improve-label">{label}</span>
    <span className="plane-chat-composer__auto-improve-switch" aria-hidden="true">
      <span className="plane-chat-composer__auto-improve-knob" />
    </span>
  </button>
)
