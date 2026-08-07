import React from 'react'
import { Icon } from '../components/ui/Icon'
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
  <button
    type="button"
    className={[
      'plane-loops-button',
      'plane-loops-button--icon-only',
    ].filter(Boolean).join(' ')}
    aria-label={label}
    title={label}
    disabled={busy}
    onClick={onClick}
  >
    <Icon name="refresh" size={13} />
  </button>
)
