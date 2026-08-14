/** Reparto uniforme de la primera oleada de pulsos por nodo (ms). */
export const BOLT_INITIAL_WAVE_MS = 14000
/** Jitter aleatorio añadido al disparo inicial (ms). */
export const BOLT_JITTER_MS = 900
/** Desfase por índice para evitar re-sincronización tras cada disparo (ms). */
export const BOLT_PHASE_SLOT_MS = 140
/** Fondo mínimo entre pulsos por nodo (aleatorio). */
export const BOLT_INTERVAL_MIN_MS = 1600
/** Fondo máximo entre pulsos por nodo (aleatorio). */
export const BOLT_INTERVAL_MAX_MS = 5200
/** Jitter extra aleatorio entre pulsos sin música activa (ms). */
export const BOLT_RANDOM_EXTRA_JITTER_MS = 2800

/**
 * Momento del primer pulso de un nodo: reparto uniforme en la oleada
 * inicial más jitter aleatorio (con música) o slot aleatorio en la ventana
 * (sin música).
 */
export function computeInitialNodeFireAt(
  startMs: number,
  index: number,
  total: number,
  random: () => number,
  musicActive = false,
): number {
  if (!musicActive) {
    return startMs + random() * BOLT_INITIAL_WAVE_MS
  }
  const spread = (index / Math.max(1, total)) * BOLT_INITIAL_WAVE_MS
  return startMs + spread + random() * BOLT_JITTER_MS
}

/**
 * Momento del siguiente pulso de nodo tras completar un ciclo: gap aleatorio
 * entre min/max más desfase por índice (con música) o jitter extra (sin música).
 */
export function computeNextNodeFireAt(
  nowMs: number,
  index: number,
  random: () => number,
  musicActive = false,
): number {
  const gap = BOLT_INTERVAL_MIN_MS
    + random() * (BOLT_INTERVAL_MAX_MS - BOLT_INTERVAL_MIN_MS)
  if (!musicActive) {
    return nowMs + gap + random() * BOLT_RANDOM_EXTRA_JITTER_MS
  }
  return nowMs + gap + (index % 11) * BOLT_PHASE_SLOT_MS
}

/** @deprecated Use computeInitialNodeFireAt */
export const computeInitialBoltFireAt = computeInitialNodeFireAt
/** @deprecated Use computeNextNodeFireAt */
export const computeNextBoltFireAt = computeNextNodeFireAt
