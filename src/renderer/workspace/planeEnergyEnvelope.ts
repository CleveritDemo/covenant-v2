/**
 * Energía del plano: cuánto se enciende el fondo según agentes trabajando.
 * Puro y sin React — el rAF de la grilla y el de las partículas lo comparten.
 */

/** Ataque por frame a 60fps (subida rápida al aparecer trabajo). */
export const PLANE_ENERGY_ATTACK = 0.045
/** Release por frame a 60fps (bajada lenta al quedar todo idle). */
export const PLANE_ENERGY_RELEASE = 0.017

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

/** Objetivo de energía por conteo de agentes busy: escala 0 → 0.4 → 0.7 → 1. */
export function planeEnergyTargetForBusyCount(count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0
  if (count === 1) return 0.4
  if (count === 2) return 0.7
  return 1
}

/**
 * Aproximación exponencial hacia `target`, independiente del framerate.
 * Mismo patrón que el pulso visual de PlaneMapGridParticles.
 */
export function stepPlaneEnergy(
  current: number,
  target: number,
  dtSeconds: number,
): number {
  const from = clamp01(current)
  const to = clamp01(target)
  if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) return from
  const rate = to > from ? PLANE_ENERGY_ATTACK : PLANE_ENERGY_RELEASE
  const blend = 1 - Math.pow(1 - rate, dtSeconds * 60)
  return clamp01(from + (to - from) * blend)
}
