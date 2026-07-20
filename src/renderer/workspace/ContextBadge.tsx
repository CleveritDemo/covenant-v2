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
}

/** Badge del pool: ícono coloreado + tooltip con nombre. */
export const ContextBadge: React.FC<ContextBadgeProps> = ({
  name,
  kindLabel,
  icon,
  color,
  shared = false,
  sharedLabel,
}) => {
  const tooltip = shared && sharedLabel
    ? `${name} · ${kindLabel} · ${sharedLabel}`
    : `${name} · ${kindLabel}`

  return (
    <Tooltip content={tooltip}>
      <span
        className={[
          'context-badge',
          shared ? 'context-badge--shared' : '',
        ].filter(Boolean).join(' ')}
        style={{ color }}
        aria-label={tooltip}
      >
        <Icon name={icon} size={14} aria-hidden />
      </span>
    </Tooltip>
  )
}
