/**
 * Sync local-first de agentes/contextos en workspaces org.
 * Puro: ids a upsert/borrar y filtros syncable (sin I/O).
 */

import { shouldSyncOrgWorkspaceAgentDefinition } from './expertReplicas'
import type { ProjectAgentDefinition } from './projectAgentCatalog'
import type { TabContext } from './tabContext'

/** Agentes que viajan al backend (excluye réplicas localOnly). */
export function isSyncableOrgWorkspaceAgent(
  agent: Pick<ProjectAgentDefinition, 'localOnly'>,
): boolean {
  return shouldSyncOrgWorkspaceAgentDefinition({
    expertReplica: agent.localOnly === true,
  })
}

/** Contextos que viajan al backend (excluye resultados locales de agente). */
export function isSyncableOrgWorkspaceContext(
  context: Pick<TabContext, 'kind'>,
): boolean {
  return context.kind !== 'agentResult'
}

export function filterSyncableOrgWorkspaceAgents<
  T extends Pick<ProjectAgentDefinition, 'localOnly'>,
>(agents: readonly T[]): T[] {
  return agents.filter(isSyncableOrgWorkspaceAgent)
}

export function filterSyncableOrgWorkspaceContexts<
  T extends Pick<TabContext, 'kind'>,
>(contexts: readonly T[]): T[] {
  return contexts.filter(isSyncableOrgWorkspaceContext)
}

/**
 * Contextos locales a borrar en “Actualizar workspace”.
 * Conserva agentResult (resultados locales).
 */
export function localContextsToWipeOnOrgResync<
  T extends Pick<TabContext, 'kind'>,
>(contexts: readonly T[]): T[] {
  return filterSyncableOrgWorkspaceContexts(contexts)
}

/**
 * Remotos ausentes en el conjunto local syncable → DELETE en upload.
 */
export function orgWorkspaceRemoteIdsToDelete(
  localIds: ReadonlySet<string> | readonly string[],
  remoteIds: readonly string[],
): string[] {
  const local = localIds instanceof Set
    ? localIds
    : new Set(
      [...localIds].map(id => id.trim()).filter(Boolean),
    )
  const out: string[] = []
  for (const raw of remoteIds) {
    const id = raw.trim()
    if (!id) continue
    if (!local.has(id)) out.push(id)
  }
  return out
}

/**
 * Ids locales a upsert hacia el backend (todos los syncables presentes).
 */
export function orgWorkspaceLocalIdsToUpsert(
  localIds: readonly string[],
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of localIds) {
    const id = raw.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/**
 * Orden visual de agentes en el tab (paneIds → agentId).
 * Fuente local canónica; session.json lo persiste igual que en workspaces personales.
 */
export function orderedAgentIdsFromTab(tab: {
  paneIds: readonly string[]
  paneKinds?: Record<string, string>
  agentByPane?: Record<string, { agentId?: string } | undefined>
}): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const paneId of tab.paneIds) {
    if (tab.paneKinds?.[paneId] !== 'agent') continue
    const agentId = tab.agentByPane?.[paneId]?.agentId?.trim() ?? ''
    if (!agentId || seen.has(agentId)) continue
    seen.add(agentId)
    out.push(agentId)
  }
  return out
}

/**
 * Sella `order` 0..n según el plano local antes del upsert remoto.
 * Agentes syncables ausentes en orderedAgentIds van al final (id estable).
 */
export function stampProjectAgentsPlaneOrder(
  agents: readonly ProjectAgentDefinition[],
  orderedAgentIds: readonly string[],
): ProjectAgentDefinition[] {
  const orderById = new Map<string, number>()
  let index = 0
  for (const raw of orderedAgentIds) {
    const id = raw.trim()
    if (!id || orderById.has(id)) continue
    orderById.set(id, index)
    index += 1
  }
  const remaining = agents
    .map(agent => agent.id)
    .filter(id => !orderById.has(id))
    .sort((a, b) => a.localeCompare(b))
  for (const id of remaining) {
    orderById.set(id, index)
    index += 1
  }
  return agents.map(agent => {
    const order = orderById.get(agent.id)
    if (order === undefined) return agent
    if (agent.order === order) return agent
    return { ...agent, order }
  })
}

/** ¿El catálogo de org permite “Subir cambios”? (manager/admin vía canRename). */
export function canUploadOrgWorkspaceChanges(
  canRename: boolean | undefined,
): boolean {
  return canRename === true
}
