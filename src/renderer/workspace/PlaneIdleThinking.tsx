import React from 'react'
import { ThinkingOrbits } from '../agent/ThinkingOrbits'
import './PlaneIdleThinking.css'

export interface PlaneIdleThinkingProps {
  /** Color del agente seleccionado; ausente = acento del tema. */
  color?: string
}

/** Misma animación de thinking del chat, a escala hero en el centro del plano. */
export const PlaneIdleThinking: React.FC<PlaneIdleThinkingProps> = ({ color }) => (
  <div
    className="plane-idle-thinking"
    style={color
      ? ({ '--thinking-orbits-color': color } as React.CSSProperties)
      : undefined}
    aria-hidden="true"
  >
    <ThinkingOrbits size="hero" />
  </div>
)
