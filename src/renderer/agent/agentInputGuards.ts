export interface AgentHumanInputGuard {
  loopActive: boolean
  awaitingDelegations: boolean
  delegationWorkActive: boolean
  orchestratorBusy: boolean
}

/** Bloquea únicamente entradas humanas; preferSend del sistema no usa este guard. */
export function isAgentHumanInputBlocked(state: AgentHumanInputGuard): boolean {
  return state.loopActive
    || state.awaitingDelegations
    || state.delegationWorkActive
    || state.orchestratorBusy
}

export interface AgentQueueDrainGuard {
  loaded: boolean
  busy: boolean
  loopActive: boolean
  awaitingDelegations: boolean
  delegationWorkActive: boolean
}

/** La cola humana solo drena cuando el pane está realmente libre. */
export function canDrainAgentQueue(state: AgentQueueDrainGuard): boolean {
  return state.loaded
    && !state.busy
    && !state.loopActive
    && !state.awaitingDelegations
    && !state.delegationWorkActive
}
