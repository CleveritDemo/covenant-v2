import type {
  AgentPaneBinding,
  PaneKind,
  PaneWindowState,
  TabSession,
  AgentPaneMeta,
} from '@shared/tabSession'
import {
  resolveAgentPaneMeta,
  sortProjectAgentsByPlaneOrder,
  stripBindingCliSessions,
  type ProjectAgentDefinition,
} from '@shared/projectAgentCatalog'
import { tabAgentCatalogKey } from '@shared/covenantTypes'
import { removePaneFromLoopChains } from '@shared/planeLoopChain'
import { ensurePaneWindows } from '@shared/paneWindows'

/** Resuelve la vista runtime de un pane desde binding local + catálogo del cwd/org. */
export function resolveTabAgentMeta(
  tab: TabSession,
  paneId: string,
  catalogByCwd: Record<string, ProjectAgentDefinition[]>,
): AgentPaneMeta {
  const binding = tab.agentByPane?.[paneId]
  const cwd = tabAgentCatalogKey(tab)
  // Sin carpeta/org se usa la clave '' (catálogo efímero en memoria).
  const agents = catalogByCwd[cwd] ?? []
  if (!binding) {
    return {
      id: `missing-${paneId.slice(0, 8)}`,
      provider: 'claude',
      permissionMode: 'auto',
    }
  }
  const definition = agents.find(agent => agent.id === binding.agentId)
  return resolveAgentPaneMeta(binding, definition, agents)
}

export function upsertAgentInList(
  agents: ProjectAgentDefinition[],
  next: ProjectAgentDefinition,
): ProjectAgentDefinition[] {
  const index = agents.findIndex(agent => agent.id === next.id)
  if (index >= 0) {
    const copy = [...agents]
    copy[index] = next
    return sortProjectAgentsByPlaneOrder(copy, agents.map(agent => agent.id))
  }
  return sortProjectAgentsByPlaneOrder(
    [...agents, next],
    [...agents.map(agent => agent.id), next.id],
  )
}

export function mergeRemoteAgentsWithLocalOnly(
  remoteAgents: readonly ProjectAgentDefinition[],
  existingAgents: readonly ProjectAgentDefinition[] | undefined,
): ProjectAgentDefinition[] {
  const remoteIds = new Set(remoteAgents.map(agent => agent.id))
  const localOnly = (existingAgents ?? []).filter(agent => (
    agent.localOnly === true && !remoteIds.has(agent.id)
  ))
  const preferredIds = [
    ...remoteAgents.map(agent => agent.id),
    ...((existingAgents ?? [])
      .map(agent => agent.id)
      .filter(id => !remoteIds.has(id))),
  ]
  return sortProjectAgentsByPlaneOrder([...remoteAgents, ...localOnly], preferredIds)
}

export interface SyncTabAgentsFromCatalogOptions {
  createPaneId: () => string
  createWindow: (
    paneWindows: Record<string, PaneWindowState> | undefined,
    open: boolean,
  ) => PaneWindowState
  /**
   * Si es `false`, descarta `cliSessionId`/sesiones de threads del binding
   * existente al realinear panes con el catálogo. Default: `true` para no
   * romper --resume en memoria (local y org). El strip al persistir org va
   * por `stripOrgTabAgentCliSessionIds`, no por este flag.
   */
  preserveCliSessionIds?: boolean
}

export interface SyncTabAgentsFromCatalogResult {
  tab: TabSession
  removedPaneIds: string[]
  addedPaneIds: string[]
  changed: boolean
}

/**
 * El catálogo del repo define qué agentes existen.
 * El orden visual se toma de `paneIds` (sesión); los nuevos del catálogo van al final.
 */
export function syncTabAgentsFromCatalog(
  tab: TabSession,
  catalog: readonly ProjectAgentDefinition[],
  options: SyncTabAgentsFromCatalogOptions,
): SyncTabAgentsFromCatalogResult {
  const preserveCliSessionIds = options.preserveCliSessionIds !== false
  const terminalIds = tab.paneIds.filter(id => tab.paneKinds?.[id] !== 'agent')
  const catalogById = new Map(catalog.map(definition => [definition.id, definition]))

  const existingByAgentId = new Map<string, { paneId: string; binding: AgentPaneBinding }>()
  const orderedKeptIds: string[] = []
  for (const paneId of tab.paneIds) {
    if (tab.paneKinds?.[paneId] !== 'agent') continue
    const binding = tab.agentByPane?.[paneId]
    if (!binding?.agentId) continue
    if (existingByAgentId.has(binding.agentId)) continue
    existingByAgentId.set(binding.agentId, { paneId, binding })
    if (catalogById.has(binding.agentId)) orderedKeptIds.push(binding.agentId)
  }

  const keptIdSet = new Set(orderedKeptIds)
  const missingDefinitions = catalog.filter(definition => !keptIdSet.has(definition.id))

  const paneKinds: Record<string, PaneKind> = {}
  for (const id of terminalIds) paneKinds[id] = 'terminal'

  const agentByPane: Record<string, AgentPaneBinding> = {}
  const paneWindows: Record<string, PaneWindowState> = { ...(tab.paneWindows ?? {}) }
  const agentPaneIds: string[] = []
  const addedPaneIds: string[] = []

  const pushAgent = (
    definition: ProjectAgentDefinition,
    existing: { paneId: string; binding: AgentPaneBinding } | undefined,
  ): void => {
    const paneId = existing?.paneId ?? options.createPaneId()
    if (!existing) {
      addedPaneIds.push(paneId)
      paneWindows[paneId] = options.createWindow(paneWindows, false)
    } else if (!paneWindows[paneId]) {
      paneWindows[paneId] = options.createWindow(paneWindows, false)
    }
    paneKinds[paneId] = 'agent'
    // Las conversaciones son del pane, no del catálogo: sobreviven al sync.
    const carried = existing
      ? (preserveCliSessionIds
          ? existing.binding
          : stripBindingCliSessions(existing.binding))
      : undefined
    agentByPane[paneId] = {
      ...carried,
      agentId: definition.id,
      ...(definition.localOnly === true || existing?.binding.localOnly === true
        ? { localOnly: true }
        : {}),
    }
    agentPaneIds.push(paneId)
  }

  for (const agentId of orderedKeptIds) {
    const definition = catalogById.get(agentId)
    if (!definition) continue
    pushAgent(definition, existingByAgentId.get(agentId))
  }
  for (const definition of missingDefinitions) {
    pushAgent(definition, existingByAgentId.get(definition.id))
  }

  const nextPaneIds = [...terminalIds, ...agentPaneIds]
  const nextPaneIdSet = new Set(nextPaneIds)
  const removedPaneIds = tab.paneIds.filter(
    id => tab.paneKinds?.[id] === 'agent' && !nextPaneIdSet.has(id),
  )

  for (const paneId of Object.keys(paneWindows)) {
    if (!nextPaneIdSet.has(paneId)) delete paneWindows[paneId]
  }

  let planeLoopChains = tab.planeLoopChains ?? []
  for (const paneId of removedPaneIds) {
    planeLoopChains = removePaneFromLoopChains(planeLoopChains, paneId)
  }

  const planeOpenChatAgentId =
    typeof tab.planeOpenChatAgentId === 'string'
    && nextPaneIdSet.has(tab.planeOpenChatAgentId)
    && paneKinds[tab.planeOpenChatAgentId] === 'agent'
      ? tab.planeOpenChatAgentId
      : null

  const activePaneId = nextPaneIds.includes(tab.activePaneId)
    ? tab.activePaneId
    : (nextPaneIds[nextPaneIds.length - 1] ?? '')

  const ensuredWindows = ensurePaneWindows(nextPaneIds, paneWindows)
  const agentBindingsChanged = Object.entries(agentByPane).some(([paneId, binding]) => {
    const previous = tab.agentByPane?.[paneId]
    if (!previous) return false
    return (previous.cliSessionId ?? '') !== (binding.cliSessionId ?? '')
      || Boolean(previous.localOnly) !== Boolean(binding.localOnly)
      || previous.agentId !== binding.agentId
  })
  const changed =
    removedPaneIds.length > 0
    || addedPaneIds.length > 0
    || nextPaneIds.length !== tab.paneIds.length
    || nextPaneIds.some((id, index) => tab.paneIds[index] !== id)
    || catalog.some(definition => !existingByAgentId.has(definition.id))
    || agentBindingsChanged

  const nextTab: TabSession = {
    ...tab,
    paneIds: nextPaneIds,
    activePaneId,
    paneKinds: Object.keys(paneKinds).length ? paneKinds : undefined,
    agentByPane: Object.keys(agentByPane).length ? agentByPane : undefined,
    paneWindows: ensuredWindows,
    planeOpenChatAgentId,
    ...(planeLoopChains.length
      ? { planeLoopChains }
      : { planeLoopChains: undefined }),
  }

  return {
    tab: nextTab,
    removedPaneIds,
    addedPaneIds,
    changed: Boolean(changed || removedPaneIds.length || addedPaneIds.length),
  }
}
