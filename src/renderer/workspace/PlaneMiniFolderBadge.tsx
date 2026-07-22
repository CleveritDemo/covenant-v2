import React from 'react'
import './PlaneMiniFolderBadge.css'

export interface PlaneMiniFolderBadgeProps {
  /** Basename de la carpeta actual (no el path completo). */
  folder: string
  /** Path completo solo para tooltip / accesibilidad. */
  title?: string
}

/** Badge compacto con la carpeta actual de un mini de terminal. */
export const PlaneMiniFolderBadge: React.FC<PlaneMiniFolderBadgeProps> = ({
  folder,
  title,
}) => {
  const label = folder.trim()
  if (!label || label === '—') return null
  return (
    <span
      className="plane-mini-folder-badge"
      title={title?.trim() || label}
      aria-label={label}
    >
      {label}
    </span>
  )
}
