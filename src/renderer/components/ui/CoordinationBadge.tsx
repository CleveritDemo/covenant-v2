import React from 'react'
import type { AgentCoordination } from '@shared/agentOrchestration'
import { Icon, type IconName } from './Icon'
import './CoordinationBadge.css'

export interface CoordinationBadgeProps {
  coordination: AgentCoordination
  label: string
  variant?: 'chip' | 'inline'
  iconSize?: number
}

export const COORDINATION_ICON: Record<Exclude<AgentCoordination, 'none'>, IconName> = {
  orchestrator: 'users',
  productOwner: 'flag',
}

/** Badge de coordinación: orquestador, product owner o especialista. */
export const CoordinationBadge: React.FC<CoordinationBadgeProps> = ({
  coordination,
  label,
  variant = 'chip',
  iconSize = 9,
}) => {
  if (coordination === 'none') return null
  return (
    <span
      className={`coordination-badge coordination-badge--${variant}`}
      aria-label={label}
      role="img"
    >
      <Icon name={COORDINATION_ICON[coordination]} size={iconSize} aria-hidden />
    </span>
  )
}
