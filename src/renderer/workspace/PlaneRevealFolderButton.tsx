import React from 'react'
import { Icon } from '../components/ui/Icon'
import { Tooltip } from '../components/ui/Tooltip'
import './PlaneLoopsButton.css'

export interface PlaneRevealFolderButtonProps {
  folderPath: string
  label: string
  onReveal: () => void
}

/** Botón icon-only para revelar la carpeta del proyecto en el Finder. */
export const PlaneRevealFolderButton: React.FC<PlaneRevealFolderButtonProps> = ({
  folderPath,
  label,
  onReveal,
}) => {
  const path = folderPath.trim()
  return (
    <Tooltip content={label} hint={path || undefined}>
      <button
        type="button"
        className="plane-loops-button plane-loops-button--icon-only"
        aria-label={path || label}
        onClick={onReveal}
      >
        <Icon name="folder" size={12} />
      </button>
    </Tooltip>
  )
}
