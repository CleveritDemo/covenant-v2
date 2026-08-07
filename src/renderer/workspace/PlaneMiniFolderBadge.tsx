import React from 'react'
import './PlaneMiniFolderBadge.css'

export interface PlaneMiniFolderBadgeProps {
  /** Basename de la carpeta actual (no el path completo). */
  folder: string
  /** El label es el nombre puesto a mano, no la carpeta (destaca más). */
  named?: boolean
}

/** Badge compacto con la carpeta (o el nombre) de un mini de terminal. */
export const PlaneMiniFolderBadge: React.FC<PlaneMiniFolderBadgeProps> = ({
  folder,
  named = false,
}) => {
  const label = folder.trim()
  if (!label || label === '—') return null
  return (
    <span
      className={[
        'plane-mini-folder-badge',
        named ? 'plane-mini-folder-badge--named' : '',
      ].filter(Boolean).join(' ')}
      aria-label={label}
    >
      {label}
    </span>
  )
}
