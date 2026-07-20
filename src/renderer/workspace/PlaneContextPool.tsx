import React, { useMemo } from 'react'
import type { TabContextKind } from '@shared/tabContext'
import { isProjectContext } from '@shared/tabContext'
import type { IconName } from '../components/ui/Icon'
import { Icon } from '../components/ui/Icon'
import { ContextBadge } from './ContextBadge'
import './PlaneContextPool.css'

export interface PlaneContextPoolItem {
  id: string
  name: string
  kind: TabContextKind
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
}) => {
  const visibleContexts = useMemo(
    () => contexts.filter(isProjectContext),
    [contexts],
  )

  return (
    <div
      className={[
        'plane-context-pool',
        visibleContexts.length === 0 ? 'plane-context-pool--empty' : '',
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

      {visibleContexts.length > 0 ? (
        <div className="plane-context-pool__icons" role="list">
          {visibleContexts.map(ctx => (
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
}
