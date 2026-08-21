import React from 'react'
import { Icon } from '../components/ui/Icon'
import { Tooltip } from '../components/ui/Tooltip'
import './PlaneLoopsButton.css'

export interface PlaneRefreshPermissionsButtonProps {
  label: string
  hint?: string
  busy: boolean
  onClick: () => void
}

export const PlaneRefreshPermissionsButton: React.FC<PlaneRefreshPermissionsButtonProps> = ({
  label,
  hint,
  busy,
  onClick,
}) => (
  <Tooltip content={label} hint={hint}>
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
      <Icon name="key" size={12} />
    </button>
  </Tooltip>
)
