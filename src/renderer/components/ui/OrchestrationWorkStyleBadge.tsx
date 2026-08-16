import React from 'react'
import type { OrchestrationWorkStyle } from '@shared/agentOrchestration'
import { Icon, type IconName } from './Icon'
import './OrchestrationWorkStyleBadge.css'

export interface OrchestrationWorkStyleBadgeProps {
  workStyle: OrchestrationWorkStyle
  label: string
  variant?: 'chip' | 'inline'
  iconSize?: number
}

const WORK_STYLE_ICON: Record<OrchestrationWorkStyle, IconName> = {
  linear: 'arrow',
  turbo: 'zap',
}

/** Badge de modo de orquestación: lineal o turbo. */
export const OrchestrationWorkStyleBadge: React.FC<OrchestrationWorkStyleBadgeProps> = ({
  workStyle,
  label,
  variant = 'chip',
  iconSize = 7,
}) => (
  <span
    className={[
      'orchestration-work-style-badge',
      `orchestration-work-style-badge--${workStyle}`,
      `orchestration-work-style-badge--${variant}`,
    ].join(' ')}
    aria-label={label}
    role="img"
  >
    <Icon name={WORK_STYLE_ICON[workStyle]} size={iconSize} aria-hidden />
  </span>
)
