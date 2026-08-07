import React from 'react'
import { Icon, type IconName } from '../components/ui/Icon'
import './AgentPane.css'

export interface TabContextIconSwatchProps {
  icon: IconName
  color: string
  title: string
  selected: boolean
  onSelect: () => void
}

/** Swatch de icono; el color dinámico va por CSS var interna. */
export const TabContextIconSwatch: React.FC<TabContextIconSwatchProps> = ({
  icon,
  color,
  title,
  selected,
  onSelect,
}) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    aria-label={title}
    className={[
      'tab-contexts__icon-swatch',
      selected ? 'tab-contexts__icon-swatch--active' : '',
    ].filter(Boolean).join(' ')}
    style={{ '--swatch-fg': color } as React.CSSProperties}
    onClick={onSelect}
  >
    <Icon name={icon} size={15} />
  </button>
)
