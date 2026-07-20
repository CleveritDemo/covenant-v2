import React from 'react'
import './ThinkingOrbits.css'

export type ThinkingOrbitsSize = 'inline' | 'solo' | 'hero'

export interface ThinkingOrbitsProps {
  /** inline = chip junto al texto; solo = burbuja thinking; hero = centro del plano. */
  size?: ThinkingOrbitsSize
  className?: string
}

/** Tres neuronas en órbita — misma animación en chat y plano idle. */
export const ThinkingOrbits: React.FC<ThinkingOrbitsProps> = ({
  size = 'inline',
  className,
}) => (
  <span
    className={[
      'thinking-orbits',
      `thinking-orbits--${size}`,
      className,
    ].filter(Boolean).join(' ')}
    aria-hidden="true"
  >
    <span />
    <span />
    <span />
  </span>
)
