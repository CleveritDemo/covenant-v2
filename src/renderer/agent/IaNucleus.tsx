import React from 'react'
import './IaNucleus.css'

export type IaNucleusSize = 'compact' | 'solo' | 'hero'
/** orbit = volumen sombreado; flat = mismos movimientos, colores planos. */
export type IaNucleusVariant = 'orbit' | 'flat'

export interface IaNucleusProps {
  /** compact = bloque inline; solo = burbuja; hero = plano. */
  size?: IaNucleusSize
  variant?: IaNucleusVariant
}

const PARTICLE_COUNT = 11

/**
 * Núcleo con partículas que convergen al centro.
 * Variante flat: misma intención, sin iluminación/volumen 3D.
 */
export const IaNucleus: React.FC<IaNucleusProps> = ({
  size = 'solo',
  variant = 'orbit',
}) => (
  <div
    className={[
      'ia-nucleus',
      `ia-nucleus--${size}`,
      variant === 'flat' ? 'ia-nucleus--flat' : 'ia-nucleus--orbit',
    ].join(' ')}
    aria-hidden="true"
  >
    <span className="ia-nucleus__core" />
    {Array.from({ length: PARTICLE_COUNT }, (_, index) => (
      <span
        key={index}
        className={[
          'ia-nucleus__particle',
          `ia-nucleus__particle--${index + 1}`,
        ].join(' ')}
      />
    ))}
  </div>
)
