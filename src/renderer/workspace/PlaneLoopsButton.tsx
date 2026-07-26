import React from 'react'
import { Icon } from '../components/ui/Icon'
import './PlaneLoopsButton.css'

export interface PlaneLoopsButtonProps {
  label: string
  pressed: boolean
  onClick: () => void
}

export const PlaneLoopsButton: React.FC<PlaneLoopsButtonProps> = ({
  label,
  pressed,
  onClick,
}) => (
  <button
    type="button"
    className={[
      'plane-loops-button',
      pressed ? 'plane-loops-button--pressed' : '',
    ].filter(Boolean).join(' ')}
    title={label}
    aria-label={label}
    aria-pressed={pressed}
    onClick={onClick}
  >
    <Icon name="repeat" size={13} />
    <span className="plane-loops-button__label">{label}</span>
  </button>
)
