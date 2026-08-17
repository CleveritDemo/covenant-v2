import React from 'react'
import { Icon } from '../components/ui/Icon'
import { Tooltip } from '../components/ui/Tooltip'
import './PlaneLoopsButton.css'

export interface PlanePromoteButtonProps {
  label: string
  busy: boolean
  onClick: () => void
}

export const PlanePromoteButton: React.FC<PlanePromoteButtonProps> = ({
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
      <Icon name="rocket" size={12} />
    </button>
  </Tooltip>
)
