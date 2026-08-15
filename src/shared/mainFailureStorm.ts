/** Fallos seguidos que se consideran una tormenta (la app ya no es fiable). */
export const FATAL_STORM_THRESHOLD = 10
/** Ventana para contar esa tormenta. */
export const FATAL_STORM_WINDOW_MS = 60_000

export interface FatalStormState {
  timestamps: number[]
  reported: boolean
}

/**
 * Registra un fallo fatal en main y decide si mostrar el aviso de tormenta.
 *
 * El reset de `reported` ocurre cuando la ventana queda vacía tras filtrar
 * timestamps viejos (60 s sin fallos), no cuando el conteo baja del umbral:
 * si reseteara al bajar de 10, cada fallo nuevo tras envejecer uno volvería a
 * disparar el diálogo en bucle.
 */
export function noteFatalFailure(
  state: FatalStormState,
  now: number,
): { state: FatalStormState; shouldWarn: boolean } {
  const timestamps = state.timestamps.filter(ts => now - ts < FATAL_STORM_WINDOW_MS)
  const reported = timestamps.length === 0 ? false : state.reported
  const nextTimestamps = [...timestamps, now]
  const shouldWarn = nextTimestamps.length >= FATAL_STORM_THRESHOLD && !reported
  return {
    state: {
      timestamps: nextTimestamps,
      reported: shouldWarn ? true : reported,
    },
    shouldWarn,
  }
}
