import React from 'react'
import { Icon } from './Icon'
import './JumpToLatestButton.css'

export type JumpToLatestButtonShape = 'icon' | 'pill'

export interface JumpToLatestButtonProps {
  label: string
  shape?: JumpToLatestButtonShape
  onClick: () => void
}

/** Vuelve al último mensaje: círculo (pane) o píldora con texto (acta). */
export const JumpToLatestButton: React.FC<JumpToLatestButtonProps> = ({
  label,
  shape = 'icon',
  onClick,
}) => (
  <button
    type="button"
    className={`jump-to-latest jump-to-latest--${shape}`}
    aria-label={shape === 'icon' ? label : undefined}
    onClick={onClick}
  >
    <Icon name="chevron-down" size={16} />
    {shape === 'pill' ? label : null}
  </button>
)
