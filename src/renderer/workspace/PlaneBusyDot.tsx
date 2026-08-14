import React from 'react'
import './PlaneBusyDot.css'

export type PlaneBusyDotPlacement = 'inline' | 'corner'
export type PlaneBusyDotSize = 'sm' | 'md'

export interface PlaneBusyDotProps {
  /** `inline` en flujo; `corner` anclado a la esquina superior derecha del padre relative. */
  placement?: PlaneBusyDotPlacement
  /** `md` = 9px (default); `sm` = 7px para filas compactas. */
  size?: PlaneBusyDotSize
}

/** Indicador de agente trabajando: disco con colores del tema. */
export const PlaneBusyDot: React.FC<PlaneBusyDotProps> = ({
  placement = 'inline',
  size = 'md',
}) => (
  <span
    className={[
      'plane-busy-dot',
      size === 'sm' ? 'plane-busy-dot--sm' : '',
      placement === 'corner' ? 'plane-busy-dot--corner' : '',
    ].filter(Boolean).join(' ')}
    aria-hidden="true"
  />
)
