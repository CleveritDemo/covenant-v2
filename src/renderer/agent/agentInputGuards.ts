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
  offline?: boolean
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
 * Offline retiene la cola, no la rechaza.
 */
export function canStartHumanTurnNow(state: {
  busy: boolean
  awaitingDelegations: boolean
  delegationWorkActive: boolean
  systemFollowUpsPending: boolean
  orchestrationWorkStyle?: 'linear' | 'turbo'
  offline?: boolean
}): boolean {
  if (state.offline === true) return false
  const awaitingBlocksHuman = state.orchestrationWorkStyle !== 'turbo' && state.awaitingDelegations
  return !state.busy && !awaitingBlocksHuman && !state.delegationWorkActive
    && !state.systemFollowUpsPending
}

export type AgentQueueDrainBlockReason =
  | 'not_loaded'
  | 'offline'
  | 'busy'
  | 'awaiting_delegations'
  | 'delegation_work_active'
  | 'system_follow_ups_pending'

/**
 * Qué gate frena la cola visible (null = drena). Mismo orden que
 * `canDrainAgentQueue`, que se apoya en esta función para no divergir: cuando
 * un chip se queda encolado con el pane idle, el motivo es lo único que
 * distingue "la ola sigue abierta" de "hay trabajo de sistema atascado".
 * Offline retiene la cola, no la rechaza.
 */
export function describeAgentQueueDrainBlock(
  state: AgentQueueDrainGuard,
): AgentQueueDrainBlockReason | null {
  if (!state.loaded) return 'not_loaded'
  if (state.offline) return 'offline'
  if (state.busy) return 'busy'
  if (state.orchestrationWorkStyle !== 'turbo' && state.awaitingDelegations) {
    return 'awaiting_delegations'
  }
  if (state.headIsDelegation !== true && state.delegationWorkActive) {
    return 'delegation_work_active'
  }
  if (state.systemFollowUpsPending) return 'system_follow_ups_pending'
  return null
}

/** Offline retiene la cola, no la rechaza. */
export function canDrainAgentQueue(state: AgentQueueDrainGuard): boolean {
  return describeAgentQueueDrainBlock(state) === null
}

export type OrchestrationFifoSkipReason =
  | 'prefer_send_slot_busy'
  | 'pane_busy'
  | 'visible_queue_full'

export interface OrchestrationFifoOfferState {
  /** El pane ya tiene un envío ofrecido sin consumir (slot único). */
  hasPreferSendSlot: boolean
  /** Turno del hilo visible en curso. */
  paneBusy: boolean
  visibleQueued: number
  maxVisibleQueued: number
  /**
   * La cabeza de la FIFO es una delegación con hilo propio. Esas no compiten
   * con el turno visible —el pane las arranca en su carril aunque esté busy—,
   * así que ni `paneBusy` ni la cola visible deben retenerlas: hacerlo
   * serializaba las olas detrás del turno abierto del especialista y dejaba las
   * subtareas en "en curso" sin que nadie las ejecutara.
   */
  headIsLaneDelegation: boolean
}

/** Por qué la FIFO de orquestación no se ofrece a este pane (null = se ofrece). */
export function describeOrchestrationFifoSkip(
  state: OrchestrationFifoOfferState,
): OrchestrationFifoSkipReason | null {
  if (state.hasPreferSendSlot) return 'prefer_send_slot_busy'
  if (state.headIsLaneDelegation) return null
  if (state.paneBusy) return 'pane_busy'
  if (state.visibleQueued >= state.maxVisibleQueued) return 'visible_queue_full'
  return null
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
  offline?: boolean
}

/**
 * Promueve el chip a la cola visible en onSendChat (sin esperar al drenador FIFO)
 * con la misma regla que preferSendIntake para turnos humanos: busy o no puede
 * arrancar turno ahora.
 * Offline retiene la cola, no la rechaza.
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
    offline: status.offline ?? false,
    orchestrationWorkStyle,
  })
  return status.busy || !canStart
}
