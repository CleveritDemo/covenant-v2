/**
 * Mesa de brainstorm: la lista ordenada de invitados que se arma arrastrando
 * agentes del plano. Pura — la UI solo dibuja el resultado.
 *
 * El orden del array ES el orden de habla; no hay más estado que este.
 */

import {
  dedupeAgentIdsPreservingOrder,
  isBrainstormInvitableAgent,
} from './brainstormRoom'

/** Mínimo para que una sala tenga conversación. */
export const BRAINSTORM_TABLE_MIN_SEATS = 2

function clampIndex(index: number | undefined, length: number): number {
  if (index === undefined || !Number.isFinite(index)) return length
  return Math.min(Math.max(Math.trunc(index), 0), length)
}

/**
 * Sienta a un agente. Sin `index`, al final; si ya estaba sentado, se mueve
 * (arrastrar un asiento dentro de la mesa es reordenar, no duplicar).
 */
export function seatAgent(
  seated: readonly string[],
  agentId: string,
  index?: number,
): string[] {
  const id = agentId.trim()
  if (!id) return [...seated]
  const rest = dedupeAgentIdsPreservingOrder(seated).filter(item => item !== id)
  const at = clampIndex(index, rest.length)
  rest.splice(at, 0, id)
  return rest
}

export function unseatAgent(seated: readonly string[], agentId: string): string[] {
  const id = agentId.trim()
  return dedupeAgentIdsPreservingOrder(seated).filter(item => item !== id)
}

/**
 * Mueve un asiento `delta` posiciones (teclado). Fuera de rango no hace nada:
 * el primero no sube y el último no baja.
 */
export function moveSeat(
  seated: readonly string[],
  agentId: string,
  delta: number,
): string[] {
  const ids = dedupeAgentIdsPreservingOrder(seated)
  const from = ids.indexOf(agentId.trim())
  if (from < 0) return ids
  const to = from + Math.trunc(delta)
  if (to < 0 || to >= ids.length) return ids
  const next = [...ids]
  next.splice(from, 1)
  next.splice(to, 0, ids[from]!)
  return next
}

/**
 * Quién puede sentarse: agentes del catálogo del plano. Las réplicas del turbo
 * quedan fuera — son capacidad temporal de un experto, no un invitado, y el
 * sanitizador de la sala las descartaría igualmente al arrancar.
 *
 * Se miran las dos señales porque no siempre están las dos: `localOnly` vive en
 * el binding de sesión y no sobrevive al catálogo en disco, mientras que
 * `instanceTag` (`R2`) lo calcula el plano a partir de los ids vivos.
 */
export function filterSeatableAgents<T extends {
  agentId?: string
  localOnly?: boolean
  instanceTag?: string
}>(agents: readonly T[]): T[] {
  return agents.filter(agent => (
    Boolean(agent.agentId?.trim())
    && !agent.instanceTag
    && isBrainstormInvitableAgent(agent)
  ))
}

/** Agentes del plano que todavía no tienen asiento, en su orden del plano. */
export function availableSeatCandidates<T extends { agentId?: string }>(
  agents: readonly T[],
  seated: readonly string[],
): T[] {
  const taken = new Set(seated)
  return agents.filter(agent => agent.agentId && !taken.has(agent.agentId))
}

export function canStartBrainstormTable(seated: readonly string[]): boolean {
  return dedupeAgentIdsPreservingOrder(seated).length >= BRAINSTORM_TABLE_MIN_SEATS
}
