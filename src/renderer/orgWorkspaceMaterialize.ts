/**
 * Descarga/subida de agentes+contextos org ↔ disco local (.gravity).
 * Deps inyectadas para tests sin Electron.
 */

import type {
  CovenantResult,
  CovenantWorkspaceAgentRecord,
  CovenantWorkspaceContextPayload,
  CovenantWorkspaceContextRecord,
} from '@shared/covenantTypes'
import {
  projectAgentsFromWorkspaceAgents,
  tabContextsFromWorkspaceContexts,
  workspaceContextBody,
  workspaceContextUpsertPayload,
} from '@shared/orgWorkspaceContent'
import {
  filterSyncableOrgWorkspaceAgents,
  filterSyncableOrgWorkspaceContexts,
  localContextsToWipeOnOrgResync,
  mergeRemoteAgentPreservingLocalResultContextIds,
  orgWorkspaceRemoteIdsToDelete,
  pickLocalAgentResultContextIds,
  stampProjectAgentsPlaneOrder,
  stripAgentResultContextIdsForUpload,
} from '@shared/orgWorkspaceLocalSync'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import type { TabContext } from '@shared/tabContext'

export type OrgWorkspaceMaterializeListResult = {
  agentsOk: boolean
  contextsOk: boolean
  agentsError?: string
  contextsError?: string
}

export type OrgWorkspaceMaterializeDeps = {
  listRemoteAgents: () => Promise<CovenantResult<CovenantWorkspaceAgentRecord[]>>
  listRemoteContexts: () => Promise<CovenantResult<CovenantWorkspaceContextRecord[]>>
  listLocalAgents: (cwd: string) => Promise<ProjectAgentDefinition[]>
  upsertLocalAgent: (
    cwd: string,
    definition: ProjectAgentDefinition,
  ) => Promise<{ ok: true; agent: ProjectAgentDefinition } | { ok: false; error?: string }>
  deleteLocalAgent: (
    cwd: string,
    agentId: string,
  ) => Promise<{ ok: boolean; error?: string }>
  discoverLocalContexts: (
    cwd: string,
  ) => Promise<{ ok: true; contexts: TabContext[] } | { ok: false; error?: string }>
  deleteLocalContext: (
    context: TabContext,
    cwd: string,
  ) => Promise<{ ok: boolean; error?: string }>
  materializeLocalContext: (args: {
    context: TabContext
    cwd: string
    content?: string
  }) => Promise<{ ok: boolean; notesContent?: string; error?: string }>
  previewLocalContext: (args: {
    context: TabContext
    cwd: string
  }) => Promise<{ ok: boolean; notesContent?: string; error?: string }>
  upsertRemoteAgent: (
    agentId: string,
    definition: ProjectAgentDefinition,
  ) => Promise<CovenantResult<CovenantWorkspaceAgentRecord>>
  deleteRemoteAgent: (agentId: string) => Promise<CovenantResult<void>>
  upsertRemoteContext: (
    contextId: string,
    payload: CovenantWorkspaceContextPayload,
  ) => Promise<CovenantResult<CovenantWorkspaceContextRecord>>
  deleteRemoteContext: (contextId: string) => Promise<CovenantResult<void>>
}

/**
 * Lista remoto → (opcional wipeLocal: borra syncables locales) → upsert remoto en `.gravity`.
 * Con wipeLocal: false (sync del botón) solo upserta y conserva extras locales.
 * Orden: `definition.order` si existe; si no, `preferredAgentIds` (plano local) y luego id.
 */
export async function downloadOrgWorkspaceToLocal(
  cwd: string,
  deps: OrgWorkspaceMaterializeDeps,
  options: {
    wipeLocal: boolean
    preferredAgentIds?: readonly string[]
  } = { wipeLocal: false },
): Promise<OrgWorkspaceMaterializeListResult> {
  const root = cwd.trim()
  if (!root) {
    return { agentsOk: false, contextsOk: false, agentsError: 'missing cwd' }
  }

  const [agentsResult, contextsResult] = await Promise.all([
    deps.listRemoteAgents(),
    deps.listRemoteContexts(),
  ])

  // Snapshot result assignments before wipe/upsert (machine-local, like agentResult files).
  const localAgentsSnapshot = await deps.listLocalAgents(root)
  const localResultContextIdsByAgentId = new Map<string, string[]>()
  for (const agent of localAgentsSnapshot) {
    const resultIds = pickLocalAgentResultContextIds(agent.contextIds)
    if (resultIds.length > 0) {
      localResultContextIdsByAgentId.set(agent.id, resultIds)
    }
  }

  let preferredAgentIds = options.preferredAgentIds
  if (options.wipeLocal) {
    if (!preferredAgentIds?.length) {
      preferredAgentIds = localAgentsSnapshot.map(agent => agent.id)
    }
    for (const agent of localAgentsSnapshot) {
      await deps.deleteLocalAgent(root, agent.id)
    }
    const discovered = await deps.discoverLocalContexts(root)
    if (discovered.ok) {
      for (const context of localContextsToWipeOnOrgResync(discovered.contexts)) {
        await deps.deleteLocalContext(context, root)
      }
    }
  }

  let agentsOk = agentsResult.ok
  let contextsOk = contextsResult.ok
  let agentsError: string | undefined
  let contextsError: string | undefined

  if (agentsResult.ok) {
    const agents = projectAgentsFromWorkspaceAgents(
      agentsResult.data,
      preferredAgentIds,
    )
    for (const definition of agents) {
      const localResultIds = localResultContextIdsByAgentId.get(definition.id)
      const merged = mergeRemoteAgentPreservingLocalResultContextIds(
        definition,
        localResultIds ? { contextIds: localResultIds } : undefined,
      )
      const written = await deps.upsertLocalAgent(root, merged)
      if (!written.ok) {
        agentsOk = false
        agentsError = written.error ?? 'agent upsert failed'
      }
    }
  } else {
    agentsError = agentsResult.error
  }

  if (contextsResult.ok) {
    // Hidrata cuerpos en memoria para notes (workspaceContextBody).
    const contexts = tabContextsFromWorkspaceContexts(contextsResult.data)
    for (const context of filterSyncableOrgWorkspaceContexts(contexts)) {
      const body = context.kind === 'notes' ? workspaceContextBody(context.id) : undefined
      const written = await deps.materializeLocalContext({
        context,
        cwd: root,
        ...(body !== undefined ? { content: body } : {}),
      })
      if (!written.ok) {
        contextsOk = false
        contextsError = written.error ?? 'context materialize failed'
      }
    }
  } else {
    contextsError = contextsResult.error
  }

  return {
    agentsOk,
    contextsOk,
    ...(agentsError ? { agentsError } : {}),
    ...(contextsError ? { contextsError } : {}),
  }
}

export type OrgWorkspaceUploadResult = {
  ok: boolean
  error?: string
}

/**
 * Lee disco local → upsert syncables → borra remotos ausentes.
 * No toca agentResult ni agentes localOnly.
 * `orderedAgentIds` (paneIds del tab) sella `order` en definition para el PUT.
 * `contextIds` viaja en la definition (fuente única en `.gravity/agents`).
 */
export async function uploadOrgWorkspaceFromLocal(
  cwd: string,
  deps: OrgWorkspaceMaterializeDeps,
  options: { orderedAgentIds?: readonly string[] } = {},
): Promise<OrgWorkspaceUploadResult> {
  const root = cwd.trim()
  if (!root) return { ok: false, error: 'missing cwd' }

  const [agentsResult, contextsResult] = await Promise.all([
    deps.listRemoteAgents(),
    deps.listRemoteContexts(),
  ])
  if (!agentsResult.ok) {
    return { ok: false, error: agentsResult.error || 'agents list failed' }
  }
  if (!contextsResult.ok) {
    return { ok: false, error: contextsResult.error || 'contexts list failed' }
  }

  const localAgents = filterSyncableOrgWorkspaceAgents(await deps.listLocalAgents(root))
  const agentsToUpload = options.orderedAgentIds?.length
    ? stampProjectAgentsPlaneOrder(localAgents, options.orderedAgentIds)
    : localAgents
  const discovered = await deps.discoverLocalContexts(root)
  if (!discovered.ok) {
    return { ok: false, error: discovered.error || 'discover contexts failed' }
  }
  const localContexts = filterSyncableOrgWorkspaceContexts(discovered.contexts)

  const localAgentIds = new Set(localAgents.map(a => a.id))
  const remoteAgentIds = agentsResult.data
    .map(item => (typeof item.agentId === 'string' ? item.agentId.trim() : ''))
    .filter(Boolean)
  const localContextIds = new Set(localContexts.map(c => c.id))
  const remoteContextIds = contextsResult.data
    .map(item => (typeof item.contextId === 'string' ? item.contextId.trim() : ''))
    .filter(Boolean)

  for (const agent of agentsToUpload) {
    const { localOnly: _drop, ...payload } = agent
    const forRemote = stripAgentResultContextIdsForUpload(payload as ProjectAgentDefinition)
    const upserted = await deps.upsertRemoteAgent(agent.id, forRemote)
    if (!upserted.ok) {
      return { ok: false, error: upserted.error || `agent upsert failed: ${agent.id}` }
    }
  }
  for (const agentId of orgWorkspaceRemoteIdsToDelete(localAgentIds, remoteAgentIds)) {
    const deleted = await deps.deleteRemoteAgent(agentId)
    if (!deleted.ok) {
      return { ok: false, error: deleted.error || `agent delete failed: ${agentId}` }
    }
  }

  for (const context of localContexts) {
    let notesContent: string | undefined
    if (context.kind === 'notes') {
      const preview = await deps.previewLocalContext({ context, cwd: root })
      if (preview.ok && typeof preview.notesContent === 'string') {
        notesContent = preview.notesContent
      } else {
        const materialized = await deps.materializeLocalContext({ context, cwd: root })
        if (materialized.ok && typeof materialized.notesContent === 'string') {
          notesContent = materialized.notesContent
        }
      }
    }
    const payload = workspaceContextUpsertPayload(context, notesContent)
    const upserted = await deps.upsertRemoteContext(context.id, payload)
    if (!upserted.ok) {
      return { ok: false, error: upserted.error || `context upsert failed: ${context.id}` }
    }
  }
  for (const contextId of orgWorkspaceRemoteIdsToDelete(localContextIds, remoteContextIds)) {
    const deleted = await deps.deleteRemoteContext(contextId)
    if (!deleted.ok) {
      return { ok: false, error: deleted.error || `context delete failed: ${contextId}` }
    }
  }

  return { ok: true }
}
