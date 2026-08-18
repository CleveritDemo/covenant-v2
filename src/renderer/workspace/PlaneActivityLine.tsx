import React, { useEffect, useState } from 'react'
import { PlaneBusyDot } from '../components/ui/PlaneBusyDot'
import { formatElapsed } from '../agent/turnActivityLabel'

export interface PlaneActivityLineProps {
  label: string
  activityKey: string
  startedAtMs: number
}

/**
 * Línea de fase del turno en el chat del plano.
 * El cronómetro tickea aquí: el sello `startedAtMs` es estable y no va al controlKey.
 */
export const PlaneActivityLine: React.FC<PlaneActivityLineProps> = ({
  label,
  activityKey,
  startedAtMs,
}) => {
  const [now, setNow] = useState(() => Date.now())
  const running = startedAtMs > 0 && label !== ''

  useEffect(() => {
    if (!running) return undefined
    setNow(Date.now())
    const id = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => window.clearInterval(id)
  }, [running, startedAtMs])

  const text = label === ''
    ? '\u00A0'
    : running
      ? `${label} · ${formatElapsed(now - startedAtMs)}`
      : label

  return (
    <div
      className={[
        'agent-pane__activity',
        label === '' ? 'agent-pane__activity--idle' : '',
      ].filter(Boolean).join(' ')}
    >
      <PlaneBusyDot size="sm" />
      <span className="agent-pane__activity-text" key={activityKey}>
        {text}
      </span>
    </div>
  )
}
