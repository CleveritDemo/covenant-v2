import React, { useMemo } from 'react'
import { resolveThreadChipActivityDot } from '../agent/paneWorkActive'
import { PlaneBusyDot } from './PlaneBusyDot'
import './PlaneChatThreadBusyDots.css'

export interface PlaneChatThreadBusyDotsProps {
  runningThreadIds: readonly string[]
  activeThreadId: string
  awaitingDelegations?: boolean
  awaitingDelegationThreadIds?: readonly string[]
  paneCliBusy?: boolean
  ariaLabel: string
}

/**
 * Fila de dots luminosos: un punto por hilo con turno activo.
 * Vive en la esquina superior izquierda del chat del plano.
 */
export const PlaneChatThreadBusyDots: React.FC<PlaneChatThreadBusyDotsProps> = ({
  runningThreadIds,
  activeThreadId,
  awaitingDelegations = false,
  awaitingDelegationThreadIds,
  paneCliBusy = false,
  ariaLabel,
}) => {
  const dots = useMemo(
    () => runningThreadIds.map(threadId => ({
      threadId,
      variant: resolveThreadChipActivityDot(
        threadId,
        activeThreadId,
        awaitingDelegations,
        runningThreadIds,
        paneCliBusy,
        awaitingDelegationThreadIds,
      ) ?? 'busy',
    })),
    [
      runningThreadIds,
      activeThreadId,
      awaitingDelegations,
      awaitingDelegationThreadIds,
      paneCliBusy,
    ],
  )

  if (dots.length === 0) return null

  return (
    <div
      className="plane-chat-thread-busy-dots"
      role="status"
      aria-label={ariaLabel}
    >
      {dots.map(dot => (
        <PlaneBusyDot key={dot.threadId} size="sm" variant={dot.variant} />
      ))}
    </div>
  )
}
