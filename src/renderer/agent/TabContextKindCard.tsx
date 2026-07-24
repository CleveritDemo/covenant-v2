import React from 'react'
import { Icon, type IconName } from '../components/ui/Icon'
import './AgentPane.css'

export interface TabContextKindCardProps {
  label: string
  icon: IconName
  selected: boolean
  disabled?: boolean
  onSelect: () => void
}

/** Tarjeta de tipo de contexto (rules / files / …). */
export const TabContextKindCard: React.FC<TabContextKindCardProps> = ({
  label,
  icon,
  selected,
  disabled = false,
  onSelect,
}) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    title={label}
    disabled={disabled}
    className={[
      'tab-contexts__kind-card',
      selected ? 'tab-contexts__kind-card--active' : '',
    ].filter(Boolean).join(' ')}
    onClick={onSelect}
  >
    <Icon name={icon} size={16} />
    <span>{label}</span>
  </button>
)
