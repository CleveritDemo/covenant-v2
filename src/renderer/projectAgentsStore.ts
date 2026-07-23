import type {
  AgentPaneBinding,
  PaneKind,
  PaneWindowState,
  TabSession,
  AgentPaneMeta,
} from '@shared/tabSession'
import {
  resolveAgentPaneMeta,
  type ProjectAgentDefinition,
} from '@shared/projectAgentCatalog'
import { removePaneFromLoopChains } from '@shared/planeLoopChain'
import { ensurePaneWindows } from '@shared/paneWindows'

/** Resuelve la vista runtime de un pane desde binding local + catálogo del cwd. */
export function resolveTabAgentMeta(
  tab: TabSession,
  paneId: string,
  catalogByCwd: Record<string, ProjectAgentDefinition[]>,
): AgentPaneMeta {
  const binding = tab.agentByPane?.[paneId]
  const cwd = tab.projectFolder?.trim() ?? ''
  const agents = cwd ? (catalogByCwd[cwd] ?? []) : []
  if (!binding) {
    return {
      id: `missing-${paneId.slice(0, 8)}`,
      provider: 'claude',
      permissionMode: 'ask',
      autoImproveContexts: true,
    }
  }
  const definition = agents.find(agent => agent.id === binding.agentId)
  return resolveAgentPaneMeta(binding, definition)
}

export function indexProjectAgents(
  agents: ProjectAgentDefinition[],
): Map<string, ProjectAgentDefinition> {
  return new Map(agents.map(agent => [agent.id, agent]))
}

export function upsertAgentInList(
  agents: ProjectAgentDefinition[],
  next: ProjectAgentDefinition,
): ProjectAgentDefinition[] {
  const without = agents.filter(agent => agent.id !== next.id)
  return [...without, next].sort((a, b) => a.id.localeCompare(b.id))
}

export interface SyncTabAgentsFromCatalogOptions {
  maxPanes: number
  createPaneId: () => string
  createWindow: (
    paneWindows: Record<string, PaneWindowState> | undefined,
    open: boolean,
  ) => PaneWindowState
}

export interface SyncTabAgentsFromCatalogResult {
  tab: TabSession
  removedPaneIds: string[]
  addedPaneIds: string[]
  changed: boolean
}

/**
 * El catálogo del repo es la única fuente de verdad de agentes.
 * Terminales se conservan; panes de agente se alinean 1:1 con el catálogo.
 */
export function syncTabAgentsFromCatalog(
  tab: TabSession,
  catalog: readonly ProjectAgentDefinition[],
  options: SyncTabAgentsFromCatalogOptions,
): SyncTabAgentsFromCatalogResult {
  const terminalIds = tab.paneIds.filter(id => tab.paneKinds?.[id] !== 'agent')
  const agentSlots = Math.max(0, options.maxPanes - terminalIds.length)
  const desired = catalog.slice(0, agentSlots)

  const existingByAgentId = new Map<string, { paneId: string; binding: AgentPaneBinding }>()
  for (const paneId of tab.paneIds) {
    if (tab.paneKinds?.[paneId] !== 'agent') continue
    const binding = tab.agentByPane?.[paneId]
    if (!binding?.agentId) continue
    if (existingByAgentId.has(binding.agentId)) continue
    existingByAgentId.set(binding.agentId, { paneId, binding })
  }

  const paneKinds: Record<string, PaneKind> = {}
  for (const id of terminalIds) paneKinds[id] = 'terminal'

  const agentByPane: Record<string, AgentPaneBinding> = {}
  const paneWindows: Record<string, PaneWindowState> = { ...(tab.paneWindows ?? {}) }
  const agentPaneIds: string[] = []
  const addedPaneIds: string[] = []

  for (const definition of desired) {
    const existing = existingByAgentId.get(definition.id)
    const paneId = existing?.paneId ?? options.createPaneId()
    if (!existing) {
      addedPaneIds.push(paneId)
      paneWindows[paneId] = options.createWindow(paneWindows, false)
    } else if (!paneWindows[paneId]) {
      paneWindows[paneId] = options.createWindow(paneWindows, false)
    }
    paneKinds[paneId] = 'agent'
    agentByPane[paneId] = {
      agentId: definition.id,
      ...(existing?.binding.cliSessionId
        ? { cliSessionId: existing.binding.cliSessionId }
        : {}),
    }
    agentPaneIds.push(paneId)
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
  const changed =
    removedPaneIds.length > 0
    || addedPaneIds.length > 0
    || nextPaneIds.length !== tab.paneIds.length
    || nextPaneIds.some((id, index) => tab.paneIds[index] !== id)
    || desired.some(definition => {
      const match = [...existingByAgentId.entries()].find(([id]) => id === definition.id)
      return !match
    })

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
