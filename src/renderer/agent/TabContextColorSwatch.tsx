import React from 'react'
import './AgentPane.css'

export interface TabContextColorSwatchProps {
  color: string
  selected: boolean
  onSelect: () => void
}

/** Swatch de color; el fill dinámico va por CSS var interna. */
export const TabContextColorSwatch: React.FC<TabContextColorSwatchProps> = ({
  color,
  selected,
  onSelect,
}) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    title={color}
    className={[
      'tab-contexts__color-swatch',
      selected ? 'tab-contexts__color-swatch--active' : '',
    ].filter(Boolean).join(' ')}
    style={{ '--swatch-bg': color } as React.CSSProperties}
    onClick={onSelect}
  />
)
