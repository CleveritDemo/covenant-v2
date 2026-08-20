import React from 'react'
import { Icon, type IconName } from '../components/ui/Icon'
import './AgentPane.css'

export interface TabContextKindCardProps {
  label: string
  icon: IconName
  selected: boolean
  disabled?: boolean
  /** Ancla del coach mark (`data-onboarding`); sin className ni style. */
  dataOnboarding?: string
  onSelect: () => void
}

/** Tarjeta de tipo de contexto (rules / files / …). */
export const TabContextKindCard: React.FC<TabContextKindCardProps> = ({
  label,
  icon,
  selected,
  disabled = false,
  dataOnboarding,
  onSelect,
}) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    aria-label={label}
    disabled={disabled}
    className={[
      'tab-contexts__kind-card',
      selected ? 'tab-contexts__kind-card--active' : '',
    ].filter(Boolean).join(' ')}
    {...(dataOnboarding ? { 'data-onboarding': dataOnboarding } : {})}
    onClick={onSelect}
  >
    <Icon name={icon} size={16} />
    <span>{label}</span>
  </button>
)
