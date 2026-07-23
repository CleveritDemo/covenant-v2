import React from 'react'
import './IaNucleus.css'

export type IaNucleusSize = 'compact' | 'solo' | 'hero'

export interface IaNucleusProps {
  /** compact = bloque inline; solo = burbuja / idle; hero = plano grande. */
  size?: IaNucleusSize
}

const PARTICLE_COUNT = 11

/**
 * Núcleo con partículas que convergen al centro (animación de “pensando”).
 */
export const IaNucleus: React.FC<IaNucleusProps> = ({
  size = 'solo',
}) => (
  <div
    className={['ia-nucleus', `ia-nucleus--${size}`].join(' ')}
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
