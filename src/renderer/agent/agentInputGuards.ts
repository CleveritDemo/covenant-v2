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
  /**
   * turbo: drena humanos aunque awaitingDelegations (especialistas en vuelo).
   * linear / omitido: espera el cierre de la ola.
   */
  orchestrationWorkStyle?: 'linear' | 'turbo'
}

/**
 * La cola humana solo drena cuando el pane está libre y no hay trabajo de sistema primero.
 * Orden: loop → orchestrationFifo/preferSend → queuedTurns humanas.
 * Cabeza delegación: permite drenar aunque delegationWorkActive (defensa post-deadlock).
 * Turbo: ignora awaitingDelegations para turnos humanos.
 */
export function canDrainAgentQueue(state: AgentQueueDrainGuard): boolean {
  const delegationHoldOk = state.headIsDelegation === true || !state.delegationWorkActive
  const awaitingOk = state.orchestrationWorkStyle === 'turbo' || !state.awaitingDelegations
  return state.loaded
    && !state.busy
    && !state.loopActive
    && awaitingOk
    && delegationHoldOk
    && !state.systemFollowUpsPending
}

/**
 * Stop rojo del composer: solo turno propio (busy / loop).
 * awaitingDelegations NO cuenta — cada especialista se cancela en Waiting.
 */
export function shouldShowComposerStop(state: {
  loopActive: boolean
  busy: boolean
  awaitingDelegations?: boolean
}): boolean {
  return Boolean(state.loopActive || state.busy)
}
