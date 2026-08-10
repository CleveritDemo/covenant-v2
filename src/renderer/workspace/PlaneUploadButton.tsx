import React from 'react'
import { Icon } from '../components/ui/Icon'
import { Tooltip } from '../components/ui/Tooltip'
import './PlaneLoopsButton.css'

export interface PlaneUploadButtonProps {
  label: string
  busy: boolean
  onClick: () => void
}

export const PlaneUploadButton: React.FC<PlaneUploadButtonProps> = ({
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
      <Icon name="upload" size={12} />
    </button>
  </Tooltip>
)
