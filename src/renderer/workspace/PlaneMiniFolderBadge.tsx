import React from 'react'
import './PlaneMiniFolderBadge.css'

export interface PlaneMiniFolderBadgeProps {
  /** Basename de la carpeta actual (no el path completo). */
  folder: string
  /** Path completo solo para tooltip / accesibilidad. */
  title?: string
  /** El label es el nombre puesto a mano, no la carpeta (destaca más). */
  named?: boolean
}

/** Badge compacto con la carpeta (o el nombre) de un mini de terminal. */
export const PlaneMiniFolderBadge: React.FC<PlaneMiniFolderBadgeProps> = ({
  folder,
  title,
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
      title={title?.trim() || label}
      aria-label={label}
    >
      {label}
    </span>
  )
}
