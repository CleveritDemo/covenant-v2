import React from 'react'
import { Gravity } from '../agent/Gravity'
import { PlaneBootstrapAgentsButton } from './PlaneBootstrapAgentsButton'
import './PlaneIdleGravity.css'

export interface PlaneIdleGravityProps {
  /** Hint bajo el logo cuando el plano no tiene paneles. */
  emptyHint?: string
  bootstrapAgentsLabel?: string
  bootstrapAgentsTitle?: string
  bootstrapAgentsDisabledTitle?: string
  showBootstrapAgents?: boolean
  canBootstrapAgents?: boolean
  onBootstrapAgents?: () => void
}

/** Gravity en el centro del plano; hint + CTA de equipo debajo si aplica. */
export const PlaneIdleGravity: React.FC<PlaneIdleGravityProps> = ({
  emptyHint,
  bootstrapAgentsLabel,
  bootstrapAgentsTitle,
  bootstrapAgentsDisabledTitle,
  showBootstrapAgents = false,
  canBootstrapAgents = false,
  onBootstrapAgents,
}) => {
  const showCta = Boolean(
    showBootstrapAgents && bootstrapAgentsLabel && onBootstrapAgents,
  )
  const showHint = Boolean(emptyHint?.trim())
  const interactive = showCta

  return (
    <div
      className="plane-idle-gravity"
      aria-hidden={interactive ? undefined : true}
    >
      <div className="plane-idle-gravity__stack">
        <Gravity size="solo" />
        {showHint ? (
          <p className="plane-idle-gravity__hint">{emptyHint}</p>
        ) : null}
        {showCta ? (
          <div className="plane-idle-gravity__cta">
            <PlaneBootstrapAgentsButton
              label={bootstrapAgentsLabel!}
              title={bootstrapAgentsTitle}
              disabled={!canBootstrapAgents}
              disabledTitle={bootstrapAgentsDisabledTitle}
              onClick={onBootstrapAgents!}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
