import React from 'react'
import type { OrchestrationWorkStyle } from '@shared/agentOrchestration'
import './OrchestrationWorkStyleBadge.css'

export interface OrchestrationWorkStyleBadgeProps {
  workStyle: OrchestrationWorkStyle
  label: string
}

/** Chip de modo de orquestación: lineal o turbo. */
export const OrchestrationWorkStyleBadge: React.FC<OrchestrationWorkStyleBadgeProps> = ({
  workStyle,
  label,
}) => (
  <span
    className={[
      'orchestration-work-style-badge',
      `orchestration-work-style-badge--${workStyle}`,
    ].join(' ')}
    aria-label={label}
  >
    {label}
  </span>
)
