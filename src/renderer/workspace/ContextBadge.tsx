import React from 'react'
import type { IconName } from '../components/ui/Icon'
import { Icon } from '../components/ui/Icon'
import { Tooltip } from '../components/ui/Tooltip'
import './ContextBadge.css'

export interface ContextBadgeProps {
  name: string
  kindLabel: string
  icon: IconName
  color: string
  shared?: boolean
  sharedLabel?: string
  /** Segunda línea del tooltip: qué hace el clic / el arrastre. */
  hint?: string
  /** Tamaño del ícono en px. */
  iconSize?: number
}

/** Badge del pool: ícono coloreado + tooltip con nombre. */
export const ContextBadge: React.FC<ContextBadgeProps> = ({
  name,
  kindLabel,
  icon,
  color,
  shared = false,
  sharedLabel,
  hint,
  iconSize = 14,
}) => {
  const tooltip = shared && sharedLabel
    ? `${name} · ${kindLabel} · ${sharedLabel}`
    : `${name} · ${kindLabel}`

  return (
    <Tooltip content={tooltip} hint={hint}>
      <span
        className={[
          'context-badge',
          shared ? 'context-badge--shared' : '',
        ].filter(Boolean).join(' ')}
        style={{ color }}
        aria-label={hint ? `${tooltip}. ${hint}` : tooltip}
      >
        <Icon name={icon} size={iconSize} aria-hidden />
      </span>
    </Tooltip>
  )
}
