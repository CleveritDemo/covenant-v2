import React from 'react'
import { Icon } from '../components/ui/Icon'
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
  const title = folderPath.trim() || label
  return (
    <button
      type="button"
      className="plane-loops-button plane-loops-button--icon-only"
      title={title}
      aria-label={title}
      onClick={onReveal}
    >
      <Icon name="folder-reveal" size={13} />
    </button>
  )
}
