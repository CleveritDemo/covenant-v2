import React from 'react'
import './AgentProviderCard.css'

export interface AgentProviderCardProps {
  icon?: React.ReactNode
  name: string
  state: string
  stateMissing?: boolean
  badge?: string
  cardRole?: 'primary' | 'fallback'
  disabled?: boolean
  onPick: () => void
  modelControl?: React.ReactNode
}

/** Tarjeta de motor: pick en un button; el Select del modelo va al lado, no anidado. */
export const AgentProviderCard: React.FC<AgentProviderCardProps> = ({
  icon,
  name,
  state,
  stateMissing = false,
  badge,
  cardRole,
  disabled = false,
  onPick,
  modelControl,
}) => {
  const roleClass = cardRole ? ` agent-provider-card--${cardRole}` : ''
  return (
    <div className={`agent-provider-card${roleClass}`}>
      <button
        type="button"
        className="agent-provider-card__pick"
        aria-pressed={Boolean(cardRole)}
        disabled={disabled}
        onClick={onPick}
      >
        {icon != null ? (
          <span className="agent-provider-card__icon" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <span className="agent-provider-card__body">
          {badge ? <span className="agent-provider-card__badge">{badge}</span> : null}
          <strong className="agent-provider-card__name">{name}</strong>
          <span
            className={`agent-provider-card__state${stateMissing ? ' agent-provider-card__state--missing' : ''}`}
          >
            {state}
          </span>
        </span>
      </button>
      {modelControl ? <div className="agent-provider-card__model">{modelControl}</div> : null}
    </div>
  )
}
