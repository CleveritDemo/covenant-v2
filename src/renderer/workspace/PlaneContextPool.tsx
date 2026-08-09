import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TabContextKind } from '@shared/tabContext'
import { isProjectContext } from '@shared/tabContext'
import type { IconName } from '../components/ui/Icon'
import { Icon } from '../components/ui/Icon'
import { Tooltip } from '../components/ui/Tooltip'
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

/** Agente del plano al que se le puede asignar un contexto. */
export interface PlaneContextPoolAgent {
  paneId: string
  title: string
  contextIds: string[]
}

/** Cuántos/qué agentes tienen ya asignado cada contexto. */
export function assignedPaneIdsByContext(
  agents: PlaneContextPoolAgent[],
): Record<string, string[]> {
  const byContext: Record<string, string[]> = {}
  for (const agent of agents) {
    for (const contextId of new Set(agent.contextIds)) {
      const paneIds = byContext[contextId] ?? (byContext[contextId] = [])
      paneIds.push(agent.paneId)
    }
  }
  return byContext
}

/**
 * Chromium rasteriza el fantasma del arrastre sobre un fondo opaco cuando el
 * elemento cuelga de un contenedor con `backdrop-filter` (la barra es glass):
 * salen esquinas rectas blancas. Se arrastra un clon colgado del `body`, fuera
 * de ese contexto, para que respete el radio y la transparencia.
 */
function setChipDragImage(event: React.DragEvent<HTMLButtonElement>): void {
  const ghost = event.currentTarget.cloneNode(true) as HTMLElement
  ghost.classList.add('plane-context-pool__chip--ghost')
  const { width, height } = event.currentTarget.getBoundingClientRect()
  document.body.appendChild(ghost)
  event.dataTransfer.setDragImage(ghost, width / 2, height / 2)
  // El fantasma solo hace falta durante el snapshot síncrono del dragstart.
  window.setTimeout(() => ghost.remove(), 0)
}

export interface PlaneContextPoolProps {
  title: string
  configureLabel: string
  createLabel: string
  /** Hint del chip (segunda línea del tooltip + aria): clic asigna, arrastrar también. */
  chipActionHint?: string
  /** Título del popover de asignación (`{{name}}` ya resuelto por el llamador). */
  assignLabel: string
  /** Texto cuando el plano no tiene agentes. */
  assignEmptyHint: string
  /** Aria del contador del chip, ya interpolado. */
  assignedCountLabel: (count: number) => string
  editLabel: string
  contexts: PlaneContextPoolItem[]
  /** Agentes del plano (orden de la columna). */
  agents: PlaneContextPoolAgent[]
  onConfigure: () => void
  /** Abre el modal de contextos directo en el formulario de creación. */
  onCreate: () => void
  /** Abre ese contexto para editarlo (acción del pie del popover). */
  onOpenContext?: (contextId: string) => void
  /** Asigna/desasigna un contexto a un agente. */
  onToggleAssign: (paneId: string, contextId: string) => void
}

export const PlaneContextPool: React.FC<PlaneContextPoolProps> = ({
  title,
  configureLabel,
  createLabel,
  chipActionHint,
  assignLabel,
  assignEmptyHint,
  assignedCountLabel,
  editLabel,
  contexts,
  agents,
  onConfigure,
  onCreate,
  onOpenContext,
  onToggleAssign,
}) => {
  const dragOccurredRef = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const [openContextId, setOpenContextId] = useState<string | null>(null)
  const [rovingIndex, setRovingIndex] = useState(0)

  const visibleContexts = useMemo(
    () => contexts.filter(isProjectContext),
    [contexts],
  )
  const assignedByContext = useMemo(
    () => assignedPaneIdsByContext(agents),
    [agents],
  )
  const openContext = openContextId
    ? visibleContexts.find(ctx => ctx.id === openContextId) ?? null
    : null

  // El contexto abierto puede desaparecer (borrado desde el modal).
  useEffect(() => {
    if (openContextId && !openContext) setOpenContextId(null)
  }, [openContextId, openContext])

  useEffect(() => {
    if (!openContextId) return
    const onPointerDown = (event: MouseEvent): void => {
      const root = rootRef.current
      if (!root || root.contains(event.target as Node)) return
      setOpenContextId(null)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpenContextId(null)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [openContextId])

  /** Roving tabindex: la barra entera es una sola parada de tabulación. */
  const onToolbarKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    const root = rootRef.current
    if (!root) return
    const items = Array.from(root.querySelectorAll<HTMLElement>('[data-pool-item]'))
    const from = items.indexOf(document.activeElement as HTMLElement)
    if (from < 0) return
    event.preventDefault()
    const step = event.key === 'ArrowRight' ? 1 : -1
    const next = (from + step + items.length) % items.length
    setRovingIndex(next)
    items[next].focus()
  }, [])

  const itemProps = (index: number) => ({
    'data-pool-item': true,
    tabIndex: index === rovingIndex ? 0 : -1,
    onFocus: () => setRovingIndex(index),
  })

  return (
    <div
      ref={rootRef}
      className={[
        'plane-context-pool',
        visibleContexts.length === 0 ? 'plane-context-pool--empty' : '',
      ].filter(Boolean).join(' ')}
      role="toolbar"
      aria-label={title}
      onMouseDown={event => event.stopPropagation()}
      onKeyDown={onToolbarKeyDown}
    >
      <Tooltip content={configureLabel}>
        <button
          type="button"
          className="plane-context-pool__configure"
          aria-label={configureLabel}
          onClick={onConfigure}
          {...itemProps(0)}
        >
          <Icon name="settings" size={12} />
        </button>
      </Tooltip>

      <Tooltip content={createLabel}>
        <button
          type="button"
          className="plane-context-pool__configure"
          aria-label={createLabel}
          onClick={onCreate}
          {...itemProps(1)}
        >
          <Icon name="plus" size={12} />
        </button>
      </Tooltip>

      {visibleContexts.length > 0 ? (
        <div className="plane-context-pool__icons" role="list">
          {visibleContexts.map((ctx, index) => {
            const assignedCount = (assignedByContext[ctx.id] ?? []).length
            const open = openContextId === ctx.id
            // Primera línea de la burbuja: qué es y a cuántos se lo diste.
            const summary = [
              `${ctx.name} — ${ctx.kindLabel}`,
              assignedCount > 0 ? assignedCountLabel(assignedCount) : '',
            ].filter(Boolean).join(' · ')
            const label = [summary, chipActionHint ?? ''].filter(Boolean).join('. ')
            return (
              <div key={ctx.id} role="listitem">
                <Tooltip content={summary} hint={chipActionHint}>
                  <button
                    type="button"
                    className={[
                      'plane-context-pool__chip',
                      open ? 'plane-context-pool__chip--open' : '',
                    ].filter(Boolean).join(' ')}
                    draggable
                    aria-haspopup="dialog"
                    aria-expanded={open}
                    aria-label={label}
                    onClick={event => {
                      event.preventDefault()
                      event.stopPropagation()
                      if (dragOccurredRef.current) {
                        dragOccurredRef.current = false
                        return
                      }
                      setOpenContextId(current => (current === ctx.id ? null : ctx.id))
                    }}
                    onPointerDown={event => {
                      event.stopPropagation()
                    }}
                    onDragStart={event => {
                      event.stopPropagation()
                      dragOccurredRef.current = true
                      setOpenContextId(null)
                      setPlaneContextDragData(event.dataTransfer, ctx.id)
                      setChipDragImage(event)
                    }}
                    onDragEnd={event => {
                      event.stopPropagation()
                      window.setTimeout(() => {
                        dragOccurredRef.current = false
                      }, 50)
                    }}
                    {...itemProps(index + 2)}
                  >
                    <span
                      className="plane-context-pool__chip-icon"
                      style={{ color: ctx.color }}
                    >
                      <Icon name={ctx.icon} size={12} aria-hidden />
                    </span>
                    <span className="plane-context-pool__chip-name">{ctx.name}</span>
                    {assignedCount > 0 && (
                      <span className="plane-context-pool__chip-count" aria-hidden="true">
                        {assignedCount}
                      </span>
                    )}
                  </button>
                </Tooltip>
              </div>
            )
          })}
        </div>
      ) : null}

      {openContext && (
        <div
          className="plane-context-pool__pop"
          role="dialog"
          aria-label={assignLabel}
        >
          <div className="plane-context-pool__pop-head">
            <span
              className="plane-context-pool__pop-icon"
              style={{ color: openContext.color }}
            >
              <Icon name={openContext.icon} size={13} aria-hidden />
            </span>
            <span className="plane-context-pool__pop-name">{openContext.name}</span>
            <span className="plane-context-pool__pop-kind">{openContext.kindLabel}</span>
          </div>

          {agents.length > 0 ? (
            <div
              className="plane-context-pool__pop-list"
              role="listbox"
              aria-multiselectable="true"
              aria-label={assignLabel}
            >
              {agents.map(agent => {
                const checked = agent.contextIds.includes(openContext.id)
                return (
                  <label
                    key={agent.paneId}
                    className={[
                      'plane-context-pool__pop-row',
                      checked ? 'plane-context-pool__pop-row--on' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <input
                      type="checkbox"
                      role="option"
                      aria-selected={checked}
                      checked={checked}
                      onChange={() => onToggleAssign(agent.paneId, openContext.id)}
                    />
                    <span className="plane-context-pool__pop-row-name">{agent.title}</span>
                  </label>
                )
              })}
            </div>
          ) : (
            <p className="plane-context-pool__pop-empty">{assignEmptyHint}</p>
          )}

          {onOpenContext ? (
            <div className="plane-context-pool__pop-foot">
              <button
                type="button"
                className="plane-context-pool__pop-action"
                onClick={() => {
                  const contextId = openContext.id
                  setOpenContextId(null)
                  onOpenContext(contextId)
                }}
              >
                <Icon name="pencil" size={12} aria-hidden />
                {editLabel}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
