import React from 'react'
import { Icon, type IconName } from '../components/ui/Icon'

export type PlaneFabKind = 'agent' | 'terminal'

export interface PlaneFabProps {
  kind: PlaneFabKind
  label: string
  disabled?: boolean
  onClick: () => void
}

const FAB_ICONS: Record<PlaneFabKind, IconName> = {
  agent: 'sparkles',
  terminal: 'terminal',
}

/** FAB circular del plano (agente / terminal). */
export const PlaneFab: React.FC<PlaneFabProps> = ({
  kind,
  label,
  disabled = false,
  onClick,
}) => (
  <button
    type="button"
    className={['plane-fab', `plane-fab--${kind}`].join(' ')}
    disabled={disabled}
    title={label}
    aria-label={label}
    onClick={onClick}
  >
    <Icon name={FAB_ICONS[kind]} size={18} />
  </button>
)
