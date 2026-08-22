import React, { useEffect, useState } from 'react'
import { useT } from '@i18n/useT'
import { PlaneBusyDot } from '../components/ui/PlaneBusyDot'
import { formatElapsed } from '../agent/turnActivityLabel'

export interface PlaneActivityLineProps {
  label: string
  activityKey: string
  startedAtMs: number
  /** Sello del último evento del CLI; 0 o ausente = desconocido. */
  lastEventAtMs?: number
  /** Habilita el aviso de inactividad tras staleAfterMs sin eventos. */
  canGoStale?: boolean
  staleAfterMs?: number
}

/**
 * Línea de fase del turno en el chat del plano.
 * El cronómetro tickea aquí: el sello `startedAtMs` es estable y no va al controlKey.
 */
export const PlaneActivityLine: React.FC<PlaneActivityLineProps> = ({
  label,
  activityKey,
  startedAtMs,
  lastEventAtMs = 0,
  canGoStale = false,
  staleAfterMs = 40_000,
}) => {
  const { t } = useT()
  const [now, setNow] = useState(() => Date.now())
  const running = startedAtMs > 0 && label !== ''
  const showStale = running
    && canGoStale
    && lastEventAtMs > 0
    && now - lastEventAtMs >= staleAfterMs

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
      {showStale ? (
        <span className="agent-pane__activity-stale">
          {' · '}
          {t('agentPane.activityStale', { since: formatElapsed(now - lastEventAtMs) })}
        </span>
      ) : null}
    </div>
  )
}
