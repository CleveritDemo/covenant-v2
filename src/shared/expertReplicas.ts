/**
 * Resolución pura de destinos con réplicas de expertos (allowExpertReplicas).
 * Sin React/electron: App.tsx spawnea; este módulo solo decide reuse vs spawn.
 */

import {
  allocateAgentSlug,
  cloneProjectAgentDefinition,
  parseProjectAgentDefinition,
  type ProjectAgentDefinition,
} from './projectAgentCatalog'
import type { OrchestrationAgentRef } from './agentOrchestration'

/** Pane/agent ocupado por una delegación pendiente o ya asignada en el batch. */
export function isDelegationTargetOccupied(
  paneId: string,
  occupiedPaneIds: ReadonlySet<string>,
): boolean {
  return occupiedPaneIds.has(paneId)
}

/** Un pane con turno/loop vivo o un + pendiente no se reusa. Chat abierto o hilos extra no cuentan: la delegación ya abre su propio thread. */
export function isPaneGuardedFromDelegationReuse(input: {
  busy: boolean
  loopActive: boolean
  newThreadPending: boolean
}): boolean {
  return input.busy || input.loopActive || input.newThreadPending
}

/**
 * Interpreta toAgentId: `frontend`, `frontend#2`, `frontend-2`.
 * `#n` / `-n` (n≥2) marcan réplica explícita; el base es el prefijo.
 */
export function parseExpertReplicaRequest(toAgentId: string): {
  requestedId: string
  baseId: string
  explicitReplica: boolean
} {
  const requestedId = String(toAgentId ?? '').trim()
  const hash = requestedId.match(/^(.+?)#(\d+)$/i)
  if (hash?.[1]) {
    return {
      requestedId,
      baseId: hash[1].trim(),
      explicitReplica: true,
    }
  }
  const dash = requestedId.match(/^(.+)-(\d+)$/i)
  if (dash?.[1] && Number(dash[2]) >= 2) {
    return {
      requestedId,
      baseId: dash[1].trim(),
      explicitReplica: true,
    }
  }
  return {
    requestedId,
    baseId: requestedId,
    explicitReplica: false,
  }
}

/**
 * Nomenclatura de instancias: `frontend-2` → `R2`. El número sale del id que
 * `allocateAgentSlug` ya reservó (empieza en 2 porque el experto original es la
 * instancia 1), así que la tarjeta, el log y el worktree dicen lo mismo.
 */
export function agentInstanceTag(agentId: string): string | null {
  const parsed = parseExpertReplicaRequest(agentId)
  if (!parsed.explicitReplica) return null
  const n = parsed.requestedId.match(/(\d+)$/)?.[1]
  return n ? `R${n}` : null
}

export interface AgentInstanceBadge {
  /** Réplica: `R2`, `R3`… */
  instanceTag?: string
  /** Experto base: cuántas réplicas suyas siguen vivas. */
  replicaCount?: number
}

/**
 * Badges de instancia para un conjunto de agentes vivos (los panes del plano).
 * Solo etiqueta como réplica al id cuyo base está presente: un agente que se
 * llame `sprint-2` por su cuenta se queda sin tag.
 */
export function resolveAgentInstanceBadges(
  agentIds: readonly string[],
): Record<string, AgentInstanceBadge> {
  const ids = agentIds.map(id => String(id ?? '').trim()).filter(Boolean)
  const present = new Set(ids)
  const badges: Record<string, AgentInstanceBadge> = {}
  for (const id of ids) {
    const parsed = parseExpertReplicaRequest(id)
    if (!parsed.explicitReplica || !present.has(parsed.baseId)) continue
    const tag = agentInstanceTag(id)
    if (!tag) continue
    badges[id] = { instanceTag: tag }
    const base = badges[parsed.baseId]
    badges[parsed.baseId] = { replicaCount: (base?.replicaCount ?? 0) + 1 }
  }
  return badges
}

export type ExpertDelegationDecision =
  | { kind: 'reuse'; paneId: string; agentId: string }
  | {
    kind: 'spawn'
    baseAgentId: string
    preferredSlug: string
  }
  /** Flag OFF + pane ocupado: no pisar worktree; App serializa FIFO. */
  | { kind: 'defer'; paneId: string; agentId: string }
  | { kind: 'fail'; reason: 'not_found' }

function findTargetByAgentId(
  targets: readonly OrchestrationAgentRef[],
  agentId: string,
): OrchestrationAgentRef | undefined {
  const wanted = agentId.trim().toLowerCase()
  if (!wanted) return undefined
  return targets.find(item => item.agentId.trim().toLowerCase() === wanted)
}

/**
 * Decide reuse / spawn / defer / fail.
 * `allowExpertReplicas` solo controla spawn; no afecta worktrees.
 * Flag OFF + occupied → `defer` (nunca reuse paralelo: un pane = un worktree activo).
 */
export function resolveExpertDelegationTarget(input: {
  toAgentId: string
  allowExpertReplicas: boolean
  targets: readonly OrchestrationAgentRef[]
  occupiedPaneIds: ReadonlySet<string>
  existingAgentIds: ReadonlySet<string>
}): ExpertDelegationDecision {
  const parsed = parseExpertReplicaRequest(input.toAgentId)
  if (!parsed.requestedId) return { kind: 'fail', reason: 'not_found' }

  const exact = findTargetByAgentId(input.targets, parsed.requestedId)
  if (exact) {
    if (!isDelegationTargetOccupied(exact.paneId, input.occupiedPaneIds)) {
      return { kind: 'reuse', paneId: exact.paneId, agentId: exact.agentId }
    }
    if (!input.allowExpertReplicas) {
      return { kind: 'defer', paneId: exact.paneId, agentId: exact.agentId }
    }
    return {
      kind: 'spawn',
      baseAgentId: exact.agentId,
      preferredSlug: allocateAgentSlug(exact.agentId, input.existingAgentIds),
    }
  }

  // Sin match exacto: réplica explícita o id desconocido.
  const base = findTargetByAgentId(input.targets, parsed.baseId)
  if (!base) return { kind: 'fail', reason: 'not_found' }

  if (!input.allowExpertReplicas) {
    if (isDelegationTargetOccupied(base.paneId, input.occupiedPaneIds)) {
      return { kind: 'defer', paneId: base.paneId, agentId: base.agentId }
    }
    return { kind: 'reuse', paneId: base.paneId, agentId: base.agentId }
  }

  if (parsed.explicitReplica || isDelegationTargetOccupied(base.paneId, input.occupiedPaneIds)) {
    const preferred = parsed.explicitReplica
      ? allocateAgentSlug(
        parsed.requestedId.includes('#')
          ? `${parsed.baseId}-${parsed.requestedId.split('#').pop() || '2'}`
          : parsed.requestedId,
        input.existingAgentIds,
      )
      : allocateAgentSlug(base.agentId, input.existingAgentIds)
    return {
      kind: 'spawn',
      baseAgentId: base.agentId,
      preferredSlug: preferred,
    }
  }

  return { kind: 'reuse', paneId: base.paneId, agentId: base.agentId }
}

/**
 * Un pane solo puede tener una delegación con worktree activa a la vez.
 * Usado por tests/contrato: 2ª en el mismo pane debe diferirse si flag OFF.
 */
export function shouldDeferOccupiedPaneWithoutReplicas(input: {
  allowExpertReplicas: boolean
  paneOccupied: boolean
}): boolean {
  return !input.allowExpertReplicas && input.paneOccupied
}

/**
 * Mientras queden pending o diferidas, el orquestador no debe despertar.
 */
export function shouldHoldWakeForSerializedDelegations(input: {
  pendingRemaining: number
  deferredRemaining: number
}): boolean {
  return input.pendingRemaining > 0 || input.deferredRemaining > 0
}

/**
 * Contrato worktree-first: a lo sumo un worktreePath activo por paneId.
 */
export function hasSingleActiveWorktreePerPane(
  active: ReadonlyArray<{ paneId: string; worktreePath: string }>,
): boolean {
  const byPane = new Map<string, string>()
  for (const item of active) {
    const prev = byPane.get(item.paneId)
    if (prev !== undefined && prev !== item.worktreePath) return false
    byPane.set(item.paneId, item.worktreePath)
  }
  return true
}

/**
 * Definición de réplica temporal: clon del experto base, acceptDelegations on,
 * nunca orquestador. El catálogo base no se borra.
 *
 * El nombre NO se decora: una réplica de Frontend se llama Frontend, y la UI la
 * distingue con el tag de instancia (`R2`) que sale de su id. Un sufijo en el
 * nombre daba dos copias llamadas igual y perdía el número que el id ya tiene.
 */
export function buildExpertReplicaDefinition(
  base: ProjectAgentDefinition,
  newId: string,
): ProjectAgentDefinition {
  const cloned = cloneProjectAgentDefinition(base)
  const parsed = parseProjectAgentDefinition({
    ...cloned,
    id: newId,
    // Réplicas: especialistas que aceptan trabajo; sin rol de coordinación.
    coordination: undefined,
    orchestrationMaxRounds: undefined,
    delegateTo: undefined,
    allowExpertReplicas: undefined,
    acceptDelegations: undefined,
  }, newId)
  return parsed ?? {
    id: newId,
    provider: base.provider,
    permissionMode: base.permissionMode,
    emitResults: true,
    ...(cloned.name ? { name: cloned.name } : {}),
    ...(cloned.role ? { role: cloned.role } : {}),
    ...(cloned.objective ? { objective: cloned.objective } : {}),
    ...(cloned.rules?.length ? { rules: cloned.rules } : {}),
    ...(cloned.model ? { model: cloned.model } : {}),
    ...(cloned.monogram ? { monogram: cloned.monogram } : {}),
    ...(cloned.contextIds?.length ? { contextIds: cloned.contextIds } : {}),
    ...(cloned.nativeSkills ? { nativeSkills: cloned.nativeSkills } : {}),
    ...(cloned.mcpsAllowed ? { mcpsAllowed: cloned.mcpsAllowed } : {}),
  }
}

/** En workspaces org, solo los agentes originales se sincronizan al backend. */
export function shouldSyncOrgWorkspaceAgentDefinition(input: {
  expertReplica: boolean
}): boolean {
  return !input.expertReplica
}

/**
 * Finalize de worktree solo desde el orquestador dueño (fromPaneId), nunca ad-hoc
 * desde el especialista.
 */
export function shouldFinalizeWorktreeFromOrchestrator(input: {
  orchestratorPaneId: string | null | undefined
  worktreeOwnerPaneId: string
}): boolean {
  const orch = input.orchestratorPaneId?.trim()
  if (!orch) return false
  return orch === input.worktreeOwnerPaneId.trim()
}
