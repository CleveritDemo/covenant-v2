import React, { useMemo, useRef } from 'react'
import type { TabContextKind } from '@shared/tabContext'
import { isProjectContext } from '@shared/tabContext'
import type { IconName } from '../components/ui/Icon'
import { Icon } from '../components/ui/Icon'
import { ContextBadge } from './ContextBadge'
import { setPlaneContextDragData } from './planeContextDrag'
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
  createLabel: string
  /** Hint del chip (segunda línea del tooltip + aria): clic edita, arrastrar asigna. */
  chipActionHint?: string
  contexts: PlaneContextPoolItem[]
  onConfigure: () => void
  /** Abre el modal de contextos directo en el formulario de creación. */
  onCreate: () => void
  /** Click on chip (not after a drag) opens that context for edit. */
  onOpenContext?: (contextId: string) => void
}

export const PlaneContextPool: React.FC<PlaneContextPoolProps> = ({
  title,
  configureLabel,
  createLabel,
  chipActionHint,
  contexts,
  onConfigure,
  onCreate,
  onOpenContext,
}) => {
  const dragOccurredRef = useRef(false)
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
        aria-label={configureLabel}
        title={configureLabel}
        onClick={onConfigure}
      >
        <Icon name="settings" size={12} />
      </button>

      <button
        type="button"
        className="plane-context-pool__configure"
        aria-label={createLabel}
        title={createLabel}
        onClick={onCreate}
      >
        <Icon name="plus" size={12} />
      </button>

      {visibleContexts.length > 0 ? (
        <div className="plane-context-pool__icons" role="list">
          {visibleContexts.map(ctx => {
            const label = chipActionHint
              ? `${ctx.name} — ${ctx.kindLabel}. ${chipActionHint}`
              : `${ctx.name} — ${ctx.kindLabel}`
            return (
              <div key={ctx.id} role="listitem">
                <button
                  type="button"
                  className="plane-context-pool__drag"
                  draggable
                  aria-label={label}
                  onClick={event => {
                    event.preventDefault()
                    event.stopPropagation()
                    if (dragOccurredRef.current) {
                      dragOccurredRef.current = false
                      return
                    }
                    onOpenContext?.(ctx.id)
                  }}
                  onPointerDown={event => {
                    event.stopPropagation()
                  }}
                  onDragStart={event => {
                    event.stopPropagation()
                    dragOccurredRef.current = true
                    setPlaneContextDragData(event.dataTransfer, ctx.id)
                  }}
                  onDragEnd={event => {
                    event.stopPropagation()
                    window.setTimeout(() => {
                      dragOccurredRef.current = false
                    }, 50)
                  }}
                >
                  <ContextBadge
                    name={ctx.name}
                    kindLabel={ctx.kindLabel}
                    icon={ctx.icon}
                    color={ctx.color}
                    hint={chipActionHint}
                    iconSize={11}
                  />
                </button>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
