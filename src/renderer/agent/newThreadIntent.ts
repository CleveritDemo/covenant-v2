/**
 * Pura: decide si una petición de nueva conversación tiene que quedar en
 * espera. Solo se difiere con delegación viva en el hilo activo; si el pane
 * está busy por un turno humano, el caller promueve a carril de fondo.
 */
export interface NewThreadRuntimeState {
  hasActiveDelegation: boolean
}

export function shouldDeferNewThread(state: NewThreadRuntimeState): boolean {
  return state.hasActiveDelegation
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
