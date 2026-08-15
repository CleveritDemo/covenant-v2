import React from 'react'
import './PlaneToolsRail.css'

export interface PlaneToolsRailProps {
  /** Etiqueta accesible del rail (nav). */
  ariaLabel: string
  /** Sube el z-index cuando un overlay del plano está abierto. */
  elevated?: boolean
  children: React.ReactNode
}

/**
 * Rail vertical de herramientas del plano (explorador, git, loops, etc.).
 * Espejo del pool de contextos: glass compacto, centrado en el eje vertical.
 */
export const PlaneToolsRail: React.FC<PlaneToolsRailProps> = ({
  ariaLabel,
  elevated = false,
  children,
}) => (
  <div
    className={[
      'plane-tools-rail-shell',
      elevated ? 'plane-tools-rail-shell--elevated' : '',
    ].filter(Boolean).join(' ')}
  >
    <nav className="plane-tools-rail" aria-label={ariaLabel}>
      <div className="plane-tools-rail__tools" role="list">
        {children}
      </div>
    </nav>
  </div>
)
