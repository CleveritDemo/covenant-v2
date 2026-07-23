import React from 'react'
import type { AgentCliProvider } from '@shared/tabSession'
import { Icon } from '../components/ui/Icon'
import { PlaneMiniFace } from './PlaneMiniFace'
import './PlaneLoopAgentCard.css'

export interface PlaneLoopAgentCardProps {
  title: string
  provider?: AgentCliProvider
  busy: boolean
  loopActive: boolean
  statusLabel: string
  selected?: boolean
  /** Paso activo de la cadena en ejecución. */
  current?: boolean
  /** Interacción del paso; se muestra dentro de la misma card. */
  objective?: string
  createLoopLabel?: string
  onCreateLoop?: () => void
  onSelect?: () => void
}

/** Card de agente para el modal de loops (misma face que el plano). */
export const PlaneLoopAgentCard: React.FC<PlaneLoopAgentCardProps> = ({
  title,
  provider = 'claude',
  busy,
  loopActive,
  statusLabel,
  selected = false,
  current = false,
  objective,
  createLoopLabel,
  onCreateLoop,
  onSelect,
}) => {
  const interactive = Boolean(onSelect)
  const trimmedObjective = objective?.trim() ?? ''
  const showAction = Boolean(onCreateLoop && createLoopLabel && !loopActive)
  const footer = trimmedObjective || showAction ? (
    <>
      {trimmedObjective ? (
        <p className="plane-loop-agent-card__objective">{trimmedObjective}</p>
      ) : null}
      {showAction ? (
        <button
          type="button"
          className="plane-loop-agent-card__action"
          title={createLoopLabel}
          aria-label={createLoopLabel}
          onClick={event => {
            event.stopPropagation()
            onCreateLoop?.()
          }}
          onPointerDown={event => event.stopPropagation()}
        >
          <Icon name="play" size={11} />
          <span>{createLoopLabel}</span>
        </button>
      ) : null}
    </>
  ) : undefined

  return (
    <div
      className={[
        'plane-loop-agent-card',
        busy || loopActive ? 'plane-loop-agent-card--busy' : '',
        selected ? 'plane-loop-agent-card--selected' : '',
        current ? 'plane-loop-agent-card--current' : '',
        interactive ? 'plane-loop-agent-card--selectable' : '',
      ].filter(Boolean).join(' ')}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={event => {
        if (!onSelect) return
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onSelect()
      }}
    >
      <PlaneMiniFace
        name={title}
        busy={busy || loopActive}
        provider={provider}
        statusLabel={statusLabel}
        density="compact"
      >
        {footer}
      </PlaneMiniFace>
    </div>
  )
}
