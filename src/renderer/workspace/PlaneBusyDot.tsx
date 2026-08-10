import React from 'react'
import './PlaneBusyDot.css'

export type PlaneBusyDotPlacement = 'inline' | 'corner'

export interface PlaneBusyDotProps {
  /** `inline` en flujo; `corner` anclado a la esquina superior derecha del padre relative. */
  placement?: PlaneBusyDotPlacement
}

/** Indicador de agente trabajando: disco con colores del tema. */
export const PlaneBusyDot: React.FC<PlaneBusyDotProps> = ({
  placement = 'inline',
}) => (
  <span
    className={[
      'plane-busy-dot',
      placement === 'corner' ? 'plane-busy-dot--corner' : '',
    ].filter(Boolean).join(' ')}
    aria-hidden="true"
  />
)
