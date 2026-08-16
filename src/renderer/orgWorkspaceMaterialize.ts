/**
 * Descarga/subida de agentes+contextos org ↔ disco local (.gravity).
 * Deps inyectadas para tests sin Electron.
 */

import type {
  CovenantResult,
  CovenantWikiLogEntryRecord,
  CovenantWikiPageRecord,
  CovenantWorkspaceAgentRecord,
  CovenantWorkspaceContextPayload,
  CovenantWorkspaceContextRecord,
} from '@shared/covenantTypes'
import {
  projectAgentsFromWorkspaceAgents,
  tabContextsFromWorkspaceContexts,
  workspaceContextBody,
  workspaceContextUpsertPayload,
  type WorkspaceContextBodyScope,
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
import { COVENANT_REQUEST_LIMIT, mapWithConcurrency } from '@shared/boundedMap'

export type OrgWorkspaceSyncPhase = 'repos' | 'agents' | 'contexts' | 'wiki'

export type OrgWorkspaceMaterializeListResult = {
  agentsOk: boolean
  contextsOk: boolean
  agentsError?: string
  contextsError?: string
  wikiError?: string
  cancelled?: boolean
}

/** Page normalizada para el replace local (espejo de WikiSyncPage en main). */
export type OrgWikiPullPage = {
  slug: string
  title: string
  type: string
  body: string
}

/** Records del server → pages para el replace local (pageType → type). */
export function wikiPullPagesFromRecords(
  records: readonly CovenantWikiPageRecord[],
): OrgWikiPullPage[] {
  const out: OrgWikiPullPage[] = []
  for (const record of records) {
    const slug = typeof record.slug === 'string' ? record.slug.trim() : ''
    if (!slug) continue
    out.push({
      slug,
      title: typeof record.title === 'string' && record.title.trim() ? record.title : slug,
      type: typeof record.pageType === 'string' ? record.pageType : 'concept',
      body: typeof record.body === 'string' ? record.body : '',
    })
  }
  return out
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
  /** Pull de wiki org (opcional: solo el download lo usa). */
  listRemoteWikiPages?: () => Promise<CovenantResult<CovenantWikiPageRecord[]>>
  replaceLocalWikiPages?: (
    cwd: string,
    pages: OrgWikiPullPage[],
  ) => Promise<{ ok: boolean; error?: string }>
  /** Pull del log de wiki (best-effort; fallo no marca download fallido). */
  listRemoteWikiLog?: () => Promise<CovenantResult<CovenantWikiLogEntryRecord[]>>
  replaceLocalWikiLog?: (
    cwd: string,
    entries: Array<{ entry: string; createdBy?: string | null; createdAt?: number }>,
  ) => Promise<{ ok: boolean; error?: string }>
  /**
   * Post-replace OK de pages: siembra el caché de hashes del push.
   * `logEntryCount` = entradas bajadas; null si el log no se bajó.
   */
  onWikiPagesReplaced?: (
    pages: OrgWikiPullPage[],
    logEntryCount: number | null,
  ) => void | Promise<void>
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
    /** Default true: si false, no lista/borra/upserta agentes. */
    includeAgents?: boolean
    preferredAgentIds?: readonly string[]
    /** Aísla bodies en memoria por workspace org (colisión de contextId). */
    orgWorkspaceScope?: WorkspaceContextBodyScope
    onPhase?: (phase: OrgWorkspaceSyncPhase) => void
    isCancelled?: () => boolean
  } = { wipeLocal: false },
): Promise<OrgWorkspaceMaterializeListResult> {
  const root = cwd.trim()
  if (!root) {
    return { agentsOk: false, contextsOk: false, agentsError: 'missing cwd' }
  }
  if (options.isCancelled?.()) {
    return { agentsOk: true, contextsOk: true, cancelled: true }
  }
  const scope = options.orgWorkspaceScope
  const includeAgents = options.includeAgents !== false

  let agentsOk = true
  let agentsError: string | undefined
  let contextsOk = true
  let contextsError: string | undefined

  if (includeAgents) {
    options.onPhase?.('agents')
  }

  const [agentsResult, contextsResult] = includeAgents
    ? await Promise.all([deps.listRemoteAgents(), deps.listRemoteContexts()])
    : [null, await deps.listRemoteContexts()]

  // Snapshot result assignments before wipe/upsert (machine-local, like agentResult files).
  let preferredAgentIds = options.preferredAgentIds
  const localResultContextIdsByAgentId = new Map<string, string[]>()
  if (includeAgents) {
    const localAgentsSnapshot = await deps.listLocalAgents(root)
    for (const agent of localAgentsSnapshot) {
      const resultIds = pickLocalAgentResultContextIds(agent.contextIds)
      if (resultIds.length > 0) {
        localResultContextIdsByAgentId.set(agent.id, resultIds)
      }
    }
    if (options.wipeLocal) {
      if (!preferredAgentIds?.length) {
        preferredAgentIds = localAgentsSnapshot.map(agent => agent.id)
      }
      for (const agent of localAgentsSnapshot) {
        await deps.deleteLocalAgent(root, agent.id)
      }
    }
  }

  if (options.wipeLocal) {
    const discovered = await deps.discoverLocalContexts(root)
    if (discovered.ok) {
      for (const context of localContextsToWipeOnOrgResync(discovered.contexts)) {
        await deps.deleteLocalContext(context, root)
      }
    }
  }

  if (options.isCancelled?.()) {
    return { agentsOk: true, contextsOk: true, cancelled: true }
  }

  if (includeAgents && agentsResult) {
    agentsOk = agentsResult.ok
    if (agentsResult.ok) {
      const agents = projectAgentsFromWorkspaceAgents(
        agentsResult.data,
        preferredAgentIds,
      )
      for (const definition of agents) {
        if (options.isCancelled?.()) {
          return { agentsOk: true, contextsOk: true, cancelled: true }
        }
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
  }

  if (options.isCancelled?.()) {
    return { agentsOk: true, contextsOk: true, cancelled: true }
  }

  options.onPhase?.('contexts')
  contextsOk = contextsResult.ok

  if (contextsResult.ok) {
    // Hidrata cuerpos en memoria para notes (workspaceContextBody), scoped si hay org.
    const contexts = tabContextsFromWorkspaceContexts(contextsResult.data, scope)
    for (const context of filterSyncableOrgWorkspaceContexts(contexts)) {
      if (options.isCancelled?.()) {
        return { agentsOk: true, contextsOk: true, cancelled: true }
      }
      const body = context.kind === 'notes'
        ? workspaceContextBody(context.id, scope)
        : undefined
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

  // Wiki org: tras bajar contexts, replace local + seed del caché de push.
  // Fallo de PAGES → wikiError (visible); fallo de LOG → best-effort (solo warn).
  let wikiError: string | undefined
  if (deps.listRemoteWikiPages && deps.replaceLocalWikiPages) {
    if (options.isCancelled?.()) {
      return { agentsOk: true, contextsOk: true, cancelled: true }
    }
    options.onPhase?.('wiki')
    try {
      if (options.isCancelled?.()) {
        return { agentsOk: true, contextsOk: true, cancelled: true }
      }
      const wikiResult = await deps.listRemoteWikiPages()
      if (wikiResult.ok) {
        const pages = wikiPullPagesFromRecords(wikiResult.data)
        const replaced = await deps.replaceLocalWikiPages(root, pages)
        if (replaced.ok) {
          let logEntryCount: number | null = null
          if (deps.listRemoteWikiLog && deps.replaceLocalWikiLog) {
            try {
              const logResult = await deps.listRemoteWikiLog()
              if (logResult.ok) {
                const logReplaced = await deps.replaceLocalWikiLog(root, logResult.data)
                if (logReplaced.ok) {
                  logEntryCount = logResult.data.length
                } else {
                  console.warn(`[orgWikiSync] pull log replace falló: ${logReplaced.error ?? 'unknown'}`)
                }
              } else {
                console.warn(`[orgWikiSync] pull log list falló: ${logResult.error}`)
              }
            } catch (error) {
              console.warn(
                `[orgWikiSync] pull log falló: ${error instanceof Error ? error.message : String(error)}`,
              )
            }
          }
          await deps.onWikiPagesReplaced?.(pages, logEntryCount)
        } else {
          wikiError = replaced.error ?? 'unknown'
          console.warn(`[orgWikiSync] pull replace falló: ${wikiError}`)
        }
      } else {
        wikiError = wikiResult.error
        console.warn(`[orgWikiSync] pull list falló: ${wikiError}`)
      }
    } catch (error) {
      wikiError = error instanceof Error ? error.message : String(error)
      console.warn(`[orgWikiSync] pull falló: ${wikiError}`)
    }
  }

  return {
    agentsOk,
    contextsOk,
    ...(agentsError ? { agentsError } : {}),
    ...(contextsError ? { contextsError } : {}),
    ...(wikiError ? { wikiError } : {}),
  }
}

export type OrgWorkspaceUploadResult = {
  ok: boolean
  error?: string
}

export type OrgWorkspaceUploadOptions = {
  orderedAgentIds?: readonly string[]
  /** 0–85: el caller reserva 86–100 para wiki u otras fases posteriores. */
  onProgress?: (percent: number) => void
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
  options: OrgWorkspaceUploadOptions = {},
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

  const agentIdsToDelete = orgWorkspaceRemoteIdsToDelete(localAgentIds, remoteAgentIds)
  const contextIdsToDelete = orgWorkspaceRemoteIdsToDelete(localContextIds, remoteContextIds)
  const totalSteps = 1 + agentsToUpload.length + agentIdsToDelete.length
    + localContexts.length + contextIdsToDelete.length
  let completedSteps = 0
  const reportProgress = (): void => {
    if (!options.onProgress) return
    if (totalSteps <= 0) {
      options.onProgress(85)
      return
    }
    const percent = Math.round((completedSteps / totalSteps) * 85)
    options.onProgress(Math.min(85, Math.max(0, percent)))
  }
  completedSteps = 1
  reportProgress()

  const agentUpserts = await mapWithConcurrency(
    agentsToUpload,
    COVENANT_REQUEST_LIMIT,
    async agent => {
      const { localOnly: _drop, ...payload } = agent
      const forRemote = stripAgentResultContextIdsForUpload(payload as ProjectAgentDefinition)
      const upserted = await deps.upsertRemoteAgent(agent.id, forRemote)
      completedSteps += 1
      reportProgress()
      return { agentId: agent.id, upserted }
    },
  )
  for (const { agentId, upserted } of agentUpserts) {
    if (!upserted.ok) {
      return { ok: false, error: upserted.error || `agent upsert failed: ${agentId}` }
    }
  }

  const agentDeletes = await mapWithConcurrency(
    agentIdsToDelete,
    COVENANT_REQUEST_LIMIT,
    async agentId => {
      const deleted = await deps.deleteRemoteAgent(agentId)
      completedSteps += 1
      reportProgress()
      return { agentId, deleted }
    },
  )
  for (const { agentId, deleted } of agentDeletes) {
    if (!deleted.ok) {
      return { ok: false, error: deleted.error || `agent delete failed: ${agentId}` }
    }
  }

  const contextUpserts = await mapWithConcurrency(
    localContexts,
    COVENANT_REQUEST_LIMIT,
    async context => {
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
      completedSteps += 1
      reportProgress()
      return { contextId: context.id, upserted }
    },
  )
  for (const { contextId, upserted } of contextUpserts) {
    if (!upserted.ok) {
      return { ok: false, error: upserted.error || `context upsert failed: ${contextId}` }
    }
  }

  const contextDeletes = await mapWithConcurrency(
    contextIdsToDelete,
    COVENANT_REQUEST_LIMIT,
    async contextId => {
      const deleted = await deps.deleteRemoteContext(contextId)
      completedSteps += 1
      reportProgress()
      return { contextId, deleted }
    },
  )
  for (const { contextId, deleted } of contextDeletes) {
    if (!deleted.ok) {
      return { ok: false, error: deleted.error || `context delete failed: ${contextId}` }
    }
  }

  return { ok: true }
}
