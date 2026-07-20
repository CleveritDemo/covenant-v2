import React from 'react'
import { ThinkingOrbits } from '../agent/ThinkingOrbits'
import './PlaneIdleThinking.css'

/** Misma animación de thinking del chat, a escala hero en el centro del plano. */
export const PlaneIdleThinking: React.FC = () => (
  <div className="plane-idle-thinking" aria-hidden="true">
    <ThinkingOrbits size="hero" />
  </div>
)
