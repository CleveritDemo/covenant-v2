/**
 * Evita despachar dos delegaciones vivas al mismo agente con el mismo objetivo.
 */

import { parseExpertReplicaRequest } from './delegationTargets'
import type {
  DelegationRuntimeEntry,
  DelegationRuntimeRegistry,
} from './delegationRuntimeRegistry'

export const DUPLICATE_OBJECTIVE_THRESHOLD = 0.8

const LIVE_STATUSES = new Set(['pending', 'awaiting_merge'])

export function normalizeObjective(raw: string): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function objectiveTokens(raw: string): Set<string> {
  return new Set(normalizeObjective(raw).split(' ').filter(token => token.length > 2))
}

function isPathLikeToken(token: string): boolean {
  return token.includes('/') || /\.\w{1,5}$/.test(token)
}

/** Tokens con forma de ruta o archivo en el objetivo crudo (case-insensitive). */
export function extractObjectivePathTokens(raw: string): Set<string> {
  const tokens = new Set<string>()
  for (const match of String(raw ?? '').matchAll(/\S+/g)) {
    const token = match[0]
    if (isPathLikeToken(token)) tokens.add(token.toLowerCase())
  }
  return tokens
}

/** Tokens de 1–2 caracteres del objetivo normalizado. */
export function extractObjectiveShortTokens(raw: string): Set<string> {
  return new Set(
    normalizeObjective(raw).split(' ').filter(token => token.length >= 1 && token.length <= 2),
  )
}

function sameTokenSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const token of a) {
    if (!b.has(token)) return false
  }
  return true
}

function pathTokensDiffer(rawA: string, rawB: string): boolean {
  const aPaths = extractObjectivePathTokens(rawA)
  const bPaths = extractObjectivePathTokens(rawB)
  return aPaths.size > 0 && bPaths.size > 0 && !sameTokenSet(aPaths, bPaths)
}

function shortTokensDiffer(rawA: string, rawB: string): boolean {
  const aShort = extractObjectiveShortTokens(rawA)
  const bShort = extractObjectiveShortTokens(rawB)
  return !sameTokenSet(aShort, bShort)
}

/** Jaccard 0..1 sobre tokens del objetivo normalizado (descarta ≤2 caracteres). */
export function objectiveSimilarity(a: string, b: string): number {
  const aSet = objectiveTokens(a)
  const bSet = objectiveTokens(b)
  if (aSet.size === 0 || bSet.size === 0) return 0
  let intersection = 0
  for (const token of aSet) {
    if (bSet.has(token)) intersection += 1
  }
  const union = aSet.size + bSet.size - intersection
  return union === 0 ? 0 : intersection / union
}

function canonicalAgentId(agentId: string): string {
  return parseExpertReplicaRequest(agentId).baseId.trim().toLowerCase()
}

export function findDuplicateDelegation(input: {
  toAgentId: string
  objective: string
  registry: DelegationRuntimeRegistry
  threshold?: number
}): DelegationRuntimeEntry | undefined {
  const threshold = input.threshold ?? DUPLICATE_OBJECTIVE_THRESHOLD
  const agentId = canonicalAgentId(input.toAgentId)
  for (const entry of input.registry.values()) {
    if (!LIVE_STATUSES.has(entry.status)) continue
    if (canonicalAgentId(entry.toAgentId) !== agentId) continue
    if (pathTokensDiffer(input.objective, entry.objective)) continue
    if (shortTokensDiffer(input.objective, entry.objective)) continue
    if (objectiveSimilarity(input.objective, entry.objective) >= threshold) return entry
  }
  return undefined
}

export function buildDuplicateDelegationFollowUp(input: {
  toAgentId: string
  duplicate: DelegationRuntimeEntry
  now: number
}): string {
  const minutes = Math.max(0, Math.round((input.now - input.duplicate.registeredAt) / 60_000))
  return [
    '## Delegación duplicada',
    `La delegación a ${input.toAgentId} no se despachó: ya hay un carril vivo con ese objetivo (${input.duplicate.delegationId}, hace ${minutes} min). Espera su resultado o re-emite con un alcance distinto.`,
  ].join('\n')
}

export function buildRepeatedDispatchFollowUp(input: { toAgentId: string }): string {
  return [
    '## Delegación duplicada',
    `La delegación a ${input.toAgentId} no se despachó: ese mismo objetivo ya se despachó antes en este pedido. Espera su resultado o re-emite con un alcance distinto.`,
  ].join('\n')
}
