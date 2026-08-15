import { DEFAULT_THREAD_ID } from '@shared/agentThreads'

export interface ThreadQueuedTurnLike {
  threadId?: string
}

/** Hilo destino de un preferSend: carril de delegación o hilo activo del pane. */
export function resolvePreferSendTargetThreadId(
  delegationThreadId: string | undefined,
  activeThreadId: string,
): string {
  const fromDelegation = delegationThreadId?.trim()
  if (fromDelegation) return fromDelegation
  return activeThreadId
}

/** Cuenta turnos encolados visibles para un hilo (cap por hilo, no por pane). */
export function countQueuedTurnsForThread<T extends ThreadQueuedTurnLike>(
  turns: readonly T[],
  threadId: string,
): number {
  const resolved = threadId.trim() || DEFAULT_THREAD_ID
  return turns.filter(
    turn => (turn.threadId ?? DEFAULT_THREAD_ID) === resolved,
  ).length
}
