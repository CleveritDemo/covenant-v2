/**
 * Bloquea el composer humano. Los loops locales del pane ya no existen; busy /
 * delegaciones permiten encolar y no usan este guard.
 */
export function isAgentHumanInputBlocked(): boolean {
  return false
}

/** FIFO de orquestación o slot preferSend ocupan el pane antes de turnos humanos. */
export function isSystemFollowUpsPendingForPane(
  orchestrationFifoLength: number,
  hasPreferSendSlot: boolean,
): boolean {
  return orchestrationFifoLength > 0 || hasPreferSendSlot
}

/**
 * El slot preferSend cuenta como trabajo de sistema pendiente solo si lleva una
 * delegación o un follow-up de orquestación. Un envío HUMANO en el slot es el
 * propio turno que el pane está por consumir: contarlo bloqueaba
 * `canStartHumanTurnNow` contra sí mismo y todo envío a un pane idle rebotaba
 * a la cola visible en vez de despacharse directo.
 */
export function preferSendSlotIsSystemWork(
  slot: { delegation?: unknown; orchestrationFollowUp?: boolean } | null | undefined,
): boolean {
  if (!slot) return false
  return Boolean(slot.delegation) || slot.orchestrationFollowUp === true
}

/**
 * Baja un flag pane-level (awaiting / delegationWork / busy) al hilo activo.
 * Sin lista de hilos, o con datos legacy sin threadId, cae al flag del pane
 * entero — misma regla que usa AgentPane en sus gates.
 */
export function threadScopedFlag(
  paneFlag: boolean,
  threadIds: readonly string[] | undefined,
  activeThreadId: string,
  legacyFallback = false,
): boolean {
  if (legacyFallback) return paneFlag
  if (!threadIds?.length) return paneFlag
  return paneFlag && threadIds.includes(activeThreadId)
}

export interface AgentQueueDrainGuard {
  loaded: boolean
  busy: boolean
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
 * Orden: orchestrationFifo/preferSend → queuedTurns humanas.
 * Cabeza delegación: permite drenar aunque delegationWorkActive (defensa post-deadlock).
 * Turbo: ignora awaitingDelegations para turnos humanos.
 */
export function canStartHumanTurnNow(state: {
  busy: boolean
  awaitingDelegations: boolean
  delegationWorkActive: boolean
  systemFollowUpsPending: boolean
  orchestrationWorkStyle?: 'linear' | 'turbo'
}): boolean {
  const awaitingBlocksHuman = state.orchestrationWorkStyle !== 'turbo' && state.awaitingDelegations
  return !state.busy && !awaitingBlocksHuman && !state.delegationWorkActive
    && !state.systemFollowUpsPending
}

export function canDrainAgentQueue(state: AgentQueueDrainGuard): boolean {
  const delegationHoldOk = state.headIsDelegation === true || !state.delegationWorkActive
  const awaitingOk = state.orchestrationWorkStyle === 'turbo' || !state.awaitingDelegations
  return state.loaded
    && !state.busy
    && awaitingOk
    && delegationHoldOk
    && !state.systemFollowUpsPending
}

/**
 * Stop rojo del composer: turno propio (busy) o target seleccionado
 * de una delegación en el plano. awaitingDelegations NO cuenta: el
 * orquestador cancela especialistas desde Waiting, fila por fila.
 */
export function shouldShowComposerStop(state: {
  busy: boolean
  awaitingDelegations?: boolean
  delegationWorkActive?: boolean
}): boolean {
  return Boolean(state.busy || state.delegationWorkActive)
}

export interface HumanSendVisibleQueuePromotionStatus {
  busy: boolean
  awaitingDelegations?: boolean
  delegationWorkActive?: boolean
  systemFollowUpsPending?: boolean
}

/**
 * Promueve el chip a la cola visible en onSendChat (sin esperar al drenador FIFO)
 * con la misma regla que preferSendIntake para turnos humanos: busy o no puede
 * arrancar turno ahora.
 */
export function shouldPromoteHumanSendToVisibleQueue(
  status: HumanSendVisibleQueuePromotionStatus | null | undefined,
  orchestrationWorkStyle?: 'linear' | 'turbo',
): boolean {
  if (!status) return false
  const canStart = canStartHumanTurnNow({
    busy: status.busy,
    awaitingDelegations: status.awaitingDelegations ?? false,
    delegationWorkActive: status.delegationWorkActive ?? false,
    systemFollowUpsPending: status.systemFollowUpsPending ?? false,
    orchestrationWorkStyle,
  })
  return status.busy || !canStart
}
