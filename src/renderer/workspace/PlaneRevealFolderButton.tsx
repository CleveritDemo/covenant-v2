import React from 'react'
import { Icon } from '../components/ui/Icon'
import { Tooltip } from '../components/ui/Tooltip'
import { shortenHome } from '@shared/shortenHome'
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
  // `~/...` en vez del home entero: la ruta completa no aporta y ensancha tanto
  // la burbuja que se despega del ícono al recortarse contra el borde.
  const shortPath = shortenHome(path)
  return (
    <Tooltip content={label} hint={shortPath || undefined}>
      <button
        type="button"
        className="plane-loops-button plane-loops-button--icon-only"
        aria-label={shortPath || label}
        onClick={onReveal}
      >
        <Icon name="folder" size={12} />
      </button>
    </Tooltip>
  )
}
