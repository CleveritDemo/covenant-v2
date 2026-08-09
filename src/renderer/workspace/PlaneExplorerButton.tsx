import React, { forwardRef } from 'react'
import { Icon } from '../components/ui/Icon'
import { Tooltip } from '../components/ui/Tooltip'
import './PlaneLoopsButton.css'

export interface PlaneExplorerButtonProps {
  label: string
  pressed: boolean
  onClick: () => void
}

/** Botón icon-only del explorador (misma piel que Loops). */
export const PlaneExplorerButton = forwardRef<HTMLButtonElement, PlaneExplorerButtonProps>(
  function PlaneExplorerButton({ label, pressed, onClick }, ref) {
    return (
      <Tooltip content={label}>
        <button
          ref={ref}
          type="button"
          data-plane-explorer-toggle
          className={[
            'plane-loops-button',
            'plane-loops-button--icon-only',
            pressed ? 'plane-loops-button--pressed' : '',
          ].filter(Boolean).join(' ')}
          aria-label={label}
          aria-pressed={pressed}
          onClick={onClick}
        >
          <Icon name="files" size={12} />
        </button>
      </Tooltip>
    )
  },
)
