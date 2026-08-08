import React from 'react'
import { Icon } from '../components/ui/Icon'
import { Tooltip } from '../components/ui/Tooltip'
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
  <Tooltip content={label}>
    <button
      type="button"
      className={[
        'plane-loops-button',
        'plane-loops-button--icon-only',
        pressed ? 'plane-loops-button--pressed' : '',
      ].filter(Boolean).join(' ')}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
    >
      <Icon name="repeat" size={13} />
    </button>
  </Tooltip>
)
