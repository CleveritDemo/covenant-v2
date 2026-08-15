import React from 'react'
import type { AgentCoordination } from '@shared/agentOrchestration'
import { Icon, type IconName } from './Icon'
import './CoordinationBadge.css'

export interface CoordinationBadgeProps {
  coordination: AgentCoordination
  label: string
  variant?: 'chip' | 'inline'
}

export const COORDINATION_ICON: Record<AgentCoordination, IconName> = {
  orchestrator: 'orchestrator',
  productOwner: 'flag',
  none: 'code',
}

/** Badge de coordinación: orquestador, product owner o especialista. */
export const CoordinationBadge: React.FC<CoordinationBadgeProps> = ({
  coordination,
  label,
  variant = 'chip',
}) => (
  <span
    className={`coordination-badge coordination-badge--${variant}`}
    aria-label={label}
    role="img"
  >
    <Icon name={COORDINATION_ICON[coordination]} size={9} aria-hidden />
  </span>
)
