import React from 'react'
import './PlaneBusyDot.css'

export type PlaneBusyDotPlacement = 'inline' | 'corner'
export type PlaneBusyDotSize = 'sm' | 'md'
export type PlaneBusyDotVariant = 'busy' | 'delegating' | 'deferred' | 'done'

export interface PlaneBusyDotProps {
  /** `inline` en flujo; `corner` anclado a la esquina superior derecha del padre relative. */
  placement?: PlaneBusyDotPlacement
  /** `md` = 9px (default); `sm` = 7px para filas compactas. */
  size?: PlaneBusyDotSize
  /** `delegating` = orquestador en ola; paleta magenta con giro + pulso de brillo. */
  variant?: PlaneBusyDotVariant
}

/** Indicador de actividad: disco con colores del tema. */
export const PlaneBusyDot: React.FC<PlaneBusyDotProps> = ({
  placement = 'inline',
  size = 'md',
  variant = 'busy',
}) => {
  return (
    <span
      className={[
        'plane-busy-dot',
        size === 'sm' ? 'plane-busy-dot--sm' : '',
        placement === 'corner' ? 'plane-busy-dot--corner' : '',
        variant === 'delegating' ? 'plane-busy-dot--delegating' : '',
        variant === 'deferred' ? 'plane-busy-dot--deferred' : '',
        variant === 'done' ? 'plane-busy-dot--done' : '',
      ].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      <span className="plane-busy-dot__core" />
    </span>
  )
}
