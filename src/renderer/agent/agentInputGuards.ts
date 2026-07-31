export interface AgentHumanInputGuard {
  loopActive: boolean
}

/**
 * Bloquea solo el composer humano cuando el loop local está activo.
 * Busy / delegaciones permiten encolar; no usan este guard.
 */
export function isAgentHumanInputBlocked(state: AgentHumanInputGuard): boolean {
  return state.loopActive
}

export interface AgentQueueDrainGuard {
  loaded: boolean
  busy: boolean
  loopActive: boolean
  awaitingDelegations: boolean
  delegationWorkActive: boolean
  /** FIFO/preferSend de orquestación pendiente en App para este pane. */
  systemFollowUpsPending: boolean
  /**
   * Si la cabeza de cola es una subtarea, no exigir !delegationWorkActive
   * (el hold del target no debe bloquear drenar esa misma delegación encolada).
   */
  headIsDelegation?: boolean
}

/**
 * La cola humana solo drena cuando el pane está libre y no hay trabajo de sistema primero.
 * Orden: loop → orchestrationFifo/preferSend → queuedTurns humanas.
 * Cabeza delegación: permite drenar aunque delegationWorkActive (defensa post-deadlock).
 */
export function canDrainAgentQueue(state: AgentQueueDrainGuard): boolean {
  const delegationHoldOk = state.headIsDelegation === true || !state.delegationWorkActive
  return state.loaded
    && !state.busy
    && !state.loopActive
    && !state.awaitingDelegations
    && delegationHoldOk
    && !state.systemFollowUpsPending
}
