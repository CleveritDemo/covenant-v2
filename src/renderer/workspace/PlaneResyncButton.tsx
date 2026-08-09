import React from 'react'
import { Icon } from '../components/ui/Icon'
import { Tooltip } from '../components/ui/Tooltip'
import './PlaneLoopsButton.css'

export interface PlaneResyncButtonProps {
  label: string
  busy: boolean
  onClick: () => void
}

export const PlaneResyncButton: React.FC<PlaneResyncButtonProps> = ({
  label,
  busy,
  onClick,
}) => (
  <Tooltip content={label}>
    <button
      type="button"
      className={[
        'plane-loops-button',
        'plane-loops-button--icon-only',
      ].filter(Boolean).join(' ')}
      aria-label={label}
      disabled={busy}
      onClick={onClick}
    >
      <Icon name="refresh" size={12} />
    </button>
  </Tooltip>
)
