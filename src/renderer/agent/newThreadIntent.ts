/**
 * Pura: decide si una petición de nueva conversación tiene que quedar en
 * espera en lugar de aplicarse inmediatamente. Se difiere mientras el pane
 * está trabajando (busy) o mantiene una delegación viva; en ambos casos
 * aplicarla ahora abortaría el turno o la delegación al pasar por
 * `resetLiveState`.
 */
export interface NewThreadRuntimeState {
  busy: boolean
  hasActiveDelegation: boolean
}

export function shouldDeferNewThread(state: NewThreadRuntimeState): boolean {
  return state.busy || state.hasActiveDelegation
}

/**
 * Pura: decide si una petición de nueva conversación diferida puede
 * aplicarse. Espera a que el turno cierre, la ola de subtareas asiente y la
 * animación de settle termine, así el commit del catálogo no cambia el
 * `activeThreadId` mientras aún hay stream escribiendo.
 */
export interface DeferredNewThreadState {
  busy: boolean
  settling: boolean
  awaitingDelegations: boolean
  hasActiveDelegation: boolean
}

export function canApplyDeferredNewThread(state: DeferredNewThreadState): boolean {
  return !state.busy
    && !state.settling
    && !state.awaitingDelegations
    && !state.hasActiveDelegation
}
