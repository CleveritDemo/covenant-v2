import React from 'react'
import './ThinkingOrbits.css'

export type ThinkingOrbitsSize = 'inline' | 'solo' | 'hero'

export interface ThinkingOrbitsProps {
  /** inline = chip; solo = burbuja thinking del chat; hero = centro del plano. */
  size?: ThinkingOrbitsSize
  className?: string
}

/** Tres neuronas en órbita — diseño original del chat (77b7b00). */
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
