/**
 * Eventos del ciclo de vida de un turno que afectan a "el último turno falló".
 * `close` es el importante: el cierre NO limpia el fallo, porque quien lo lee
 * (la reconciliación idle de una delegación) mira el pane ya parado.
 */
export type TurnLifecycleEvent = 'start' | 'retry' | 'cli-error' | 'close' | 'stop'

/**
 * Estado del flag tras un evento del turno. Describe el turno *anterior*, así
 * que sobrevive al cierre y solo lo limpia el arranque del siguiente o un stop
 * del usuario. Si `close` volviera a limpiarlo, una delegación muerta por error
 * de CLI se cerraría como correcta y el orquestador la repetiría en bucle.
 */
export function turnFailedAfter(event: TurnLifecycleEvent, previous: boolean): boolean {
  switch (event) {
    case 'cli-error':
      return true
    case 'close':
      return previous
    case 'start':
    case 'retry':
    case 'stop':
      return false
  }
}

/** Un error tardío del CLI no debe remarcar busy si el turno ya se cerró (p. ej. stop). */
export function shouldMarkBusyOnCliError(turnClosed: boolean): boolean {
  return !turnClosed
}
