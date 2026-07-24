import React from 'react'
import './Gravity.css'

export type GravitySize = 'compact' | 'solo' | 'hero'

export interface GravityProps {
  /** compact = bloque inline; solo = burbuja / idle; hero = plano grande. */
  size?: GravitySize
}

const PARTICLE_COUNT = 11

/**
 * Masa central con materia en caída libre hacia el pozo (loading / “pensando”).
 */
export const Gravity: React.FC<GravityProps> = ({
  size = 'solo',
}) => (
  <div
    className={['gravity', `gravity--${size}`].join(' ')}
    aria-hidden="true"
  >
    <span className="gravity__core" />
    {Array.from({ length: PARTICLE_COUNT }, (_, index) => (
      <span
        key={index}
        className={[
          'gravity__particle',
          `gravity__particle--${index + 1}`,
        ].join(' ')}
      />
    ))}
  </div>
)
