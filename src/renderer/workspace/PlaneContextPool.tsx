import React from 'react'
import type { IconName } from '../components/ui/Icon'
import { Icon } from '../components/ui/Icon'
import { ContextBadge } from './ContextBadge'
import './PlaneContextPool.css'

export interface PlaneContextPoolItem {
  id: string
  name: string
  kindLabel: string
  icon: IconName
  color: string
}

export interface PlaneContextPoolProps {
  title: string
  configureLabel: string
  contexts: PlaneContextPoolItem[]
  onConfigure: () => void
}

export const PlaneContextPool: React.FC<PlaneContextPoolProps> = ({
  title,
  configureLabel,
  contexts,
  onConfigure,
}) => (
  <div
    className={[
      'plane-context-pool',
      contexts.length === 0 ? 'plane-context-pool--empty' : '',
    ].filter(Boolean).join(' ')}
    role="toolbar"
    aria-label={title}
    onMouseDown={event => event.stopPropagation()}
  >
    <button
      type="button"
      className="plane-context-pool__configure"
      title={configureLabel}
      aria-label={configureLabel}
      onClick={onConfigure}
    >
      <Icon name="settings" size={14} />
    </button>

    {contexts.length > 0 ? (
      <div className="plane-context-pool__icons" role="list">
        {contexts.map(ctx => (
          <div key={ctx.id} role="listitem">
            <ContextBadge
              name={ctx.name}
              kindLabel={ctx.kindLabel}
              icon={ctx.icon}
              color={ctx.color}
            />
          </div>
        ))}
      </div>
    ) : null}
  </div>
)
