/**
 * Resuelve alias `agentId#2` al experto base (delegationLanes) y decide
 * quién finaliza un worktree tras delegación (App).
 */

/**
 * Interpreta toAgentId: `frontend`, `frontend#2`, `frontend-2`.
 * `#n` / `-n` (n≥2) marcan alias explícito al experto base; el base es el prefijo.
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

/** En workspaces org, solo los agentes del catálogo principal se sincronizan al backend. */
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
