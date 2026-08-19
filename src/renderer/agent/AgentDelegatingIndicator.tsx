import React from 'react'
import { Tooltip } from '../components/ui/Tooltip'
import { Icon } from '../components/ui/Icon'
import { Gravity } from './Gravity'
import { PlaneBusyDot } from '../components/ui/PlaneBusyDot'
import './AgentDelegatingIndicator.css'

export interface AgentDelegatingListItem {
  id: string
  label: string
  /** Texto ya traducido: running | queued | done. */
  statusLabel: string
  /** `deferred` = aceptada pero sin arrancar; el punto no debe pulsar. */
  status: 'running' | 'deferred' | 'done'
  worktreeHint?: string
}

export interface AgentDelegatingListGroup {
  id: string
  title: string
  items: readonly AgentDelegatingListItem[]
}

export interface AgentDelegatingIndicatorProps {
  label: string
  sublabel?: string
  items?: readonly AgentDelegatingListItem[]
  /** Cabeceras de pedido; con menos de 2 grupos la lista sigue plana. */
  groups?: readonly AgentDelegatingListGroup[]
  /** Aria/title del Stop por fila (solo running). */
  stopItemLabel?: string
  /** Cancela solo esa delegación; no es el Stop del composer. */
  onStopItem?: (delegationId: string) => void
}

function renderDelegatingRow(
  item: AgentDelegatingListItem,
  stopItemLabel: string | undefined,
  onStopItem: ((delegationId: string) => void) | undefined,
): React.ReactElement {
  const row = (
    <span
      className={[
        'agent-delegating__item',
        `agent-delegating__item--${item.status}`,
      ].join(' ')}
    >
      {item.status === 'running' ? (
        <PlaneBusyDot size="sm" variant="delegating" />
      ) : (
        <PlaneBusyDot
          size="sm"
          variant={item.status === 'done' ? 'done' : 'deferred'}
        />
      )}
      <span className="agent-delegating__agent">{item.label}</span>
      <span className="agent-delegating__status">{item.statusLabel}</span>
    </span>
  )
  const stop = item.status === 'running' && onStopItem && stopItemLabel ? (
    <Tooltip content={stopItemLabel}>
      <button
        type="button"
        className="agent-delegating__stop"
        aria-label={stopItemLabel}
        onClick={event => {
          event.preventDefault()
          event.stopPropagation()
          onStopItem(item.id)
        }}
      >
        <Icon name="stop" size={10} aria-hidden />
      </button>
    </Tooltip>
  ) : null
  return (
    <li key={item.id} className="agent-delegating__row">
      {item.worktreeHint ? (
        <Tooltip content={item.worktreeHint}>{row}</Tooltip>
      ) : (
        row
      )}
      {stop}
    </li>
  )
}

function renderDelegatingList(
  items: readonly AgentDelegatingListItem[],
  stopItemLabel: string | undefined,
  onStopItem: ((delegationId: string) => void) | undefined,
): React.ReactElement {
  return (
    <ul className="agent-delegating__list">
      {items.map(item => renderDelegatingRow(item, stopItemLabel, onStopItem))}
    </ul>
  )
}

/**
 * Estado de orquestación: el agente emitió delegaciones y espera a especialistas.
 * Flush en el stream (sin card); acento solo en estado running/done.
 */
export const AgentDelegatingIndicator: React.FC<AgentDelegatingIndicatorProps> = ({
  label,
  sublabel,
  items = [],
  groups,
  stopItemLabel,
  onStopItem,
}) => {
  const grouped = groups && groups.length >= 2 ? groups : null
  return (
    <div className="agent-delegating" role="status" aria-live="polite">
      <div className="agent-delegating__logo" aria-hidden="true">
        <Gravity size="compact" />
      </div>
      <div className="agent-delegating__copy">
        <p className="agent-delegating__label">{label}</p>
        {sublabel ? (
          <p className="agent-delegating__sublabel">{sublabel}</p>
        ) : null}
        {grouped ? (
          <ul className="agent-delegating__groups">
            {grouped.map(group => (
              <li key={group.id} className="agent-delegating__group">
                <span className="agent-delegating__group-title">{group.title}</span>
                {renderDelegatingList(group.items, stopItemLabel, onStopItem)}
              </li>
            ))}
          </ul>
        ) : items.length > 0 ? (
          renderDelegatingList(items, stopItemLabel, onStopItem)
        ) : null}
      </div>
    </div>
  )
}
