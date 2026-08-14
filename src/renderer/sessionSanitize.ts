import type { FileExplorerPersistedState } from '@shared/fileExplorerPersistedState'
import type {
  AgentPaneBinding,
  AgentPaneMeta,
  AgentPermissionMode,
  PaneKind,
  TabSession,
} from '@shared/tabSession'
import {
  parseAgentPaneBinding,
  stripBindingCliSessions,
  type ProjectAgentDefinition,
} from '@shared/projectAgentCatalog'
import {
  sanitizePlaneLoopLinks,
  sanitizePlaneLoopNodePositions,
} from '@shared/planeLoopGraph'
import { sanitizePlaneLoopChains } from '@shared/planeLoopChain'
import { collapseAllPaneWindows, ensurePaneWindows } from '@shared/paneWindows'
import { migrateExplorerStateByTab } from './tabFileExplorer'
import { normalizeTabSession } from './tabSplitSizes'

export interface PersistedSessionInput {
  version: 1
  activeTabId: string
  tabs: TabSession[]
  cwds: Record<string, string>
  explorerByTab?: Record<string, FileExplorerPersistedState>
  /** @deprecated migrado a explorerByTab. */
  explorerByPane?: Record<string, FileExplorerPersistedState>
}

export interface SanitizedSession {
  tabs: TabSession[]
  activeTabId: string
  cwds: Record<string, string>
  explorerByTab: Record<string, FileExplorerPersistedState>
  orphanPaneIds: string[]
  /**
   * Siempre vacío: ya no se resucitan agentes desde rich meta de session.
   * Se mantiene el campo por compat de tipado / callers.
   */
  pendingAgentMigrations: Array<{
    projectFolder: string
    definition: ProjectAgentDefinition
  }>
}

/**
 * Quita `cliSessionId` de tabs org al persistir o al rehidratar session.json.
 * En memoria (React) la sesión se conserva para --resume entre turnos; no debe
 * viajar en el snapshot compartido porque es local al usuario/CLI.
 */
export function stripOrgTabAgentCliSessionIds(tab: TabSession): TabSession {
  const org = tab.orgWorkspace
  if (!org?.slug?.trim() || !org?.workspaceId?.trim()) return tab
  const agentByPane = tab.agentByPane
  if (!agentByPane) return tab
  let changed = false
  const next: Record<string, AgentPaneBinding> = {}
  for (const [paneId, binding] of Object.entries(agentByPane)) {
    const stripped = stripBindingCliSessions(binding)
    if (stripped !== binding) changed = true
    next[paneId] = stripped
  }
  return changed ? { ...tab, agentByPane: next } : tab
}

function sanitizeTab(tab: TabSession): {
  tab: TabSession
  migrations: SanitizedSession['pendingAgentMigrations']
} | null {
  if (!tab?.id || !Array.isArray(tab.paneIds)) return null
  const rawPaneIds = tab.paneIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
  const paneKinds: Record<string, PaneKind> = {}
  const agentByPane: Record<string, AgentPaneBinding> = {}
  const droppedAgentPanes = new Set<string>()
  const projectFolder = typeof tab.projectFolder === 'string' && tab.projectFolder.trim()
    ? tab.projectFolder.trim()
    : undefined
  const orgWorkspaceRaw = tab.orgWorkspace
  const orgWorkspace =
    orgWorkspaceRaw
    && typeof orgWorkspaceRaw.slug === 'string'
    && orgWorkspaceRaw.slug.trim()
    && typeof orgWorkspaceRaw.workspaceId === 'string'
    && orgWorkspaceRaw.workspaceId.trim()
      ? {
          slug: orgWorkspaceRaw.slug.trim(),
          workspaceId: orgWorkspaceRaw.workspaceId.trim(),
          ...(typeof orgWorkspaceRaw.localDir === 'string' && orgWorkspaceRaw.localDir.trim()
            ? { localDir: orgWorkspaceRaw.localDir.trim() }
            : {}),
        }
      : undefined

  for (const paneId of rawPaneIds) {
    if (tab.paneKinds?.[paneId] !== 'agent') continue
    const raw = tab.agentByPane?.[paneId] as unknown
    const binding = parseAgentPaneBinding(raw)
    if (binding) {
      paneKinds[paneId] = 'agent'
      // Org: no rehidratar sesión CLI desde snapshot (puede ser de otro usuario
      // o máquina). El resume en vivo lo vuelve a adoptar el primer turno.
      agentByPane[paneId] = orgWorkspace ? stripBindingCliSessions(binding) : binding
      continue
    }
    // Rich meta legacy o binding inválido: pane huérfano (no migrar, no inventar agentId).
    droppedAgentPanes.add(paneId)
  }

  const paneIds = rawPaneIds.filter(id => !droppedAgentPanes.has(id))
  const activePaneId = paneIds.length === 0
    ? ''
    : paneIds.includes(tab.activePaneId)
      ? tab.activePaneId
      : paneIds[paneIds.length - 1]!

  const paneWindows = collapseAllPaneWindows(ensurePaneWindows(paneIds, tab.paneWindows))
  const rawOpenChat = tab.planeOpenChatAgentId
  const planeOpenChatAgentId =
    typeof rawOpenChat === 'string'
    && paneIds.includes(rawOpenChat)
    && paneKinds[rawOpenChat] === 'agent'
      ? rawOpenChat
      : null
  const {
    panePlaneNodes: _legacyPlaneNodes,
    contexts: _legacyContexts,
    projectFolder: _rawProjectFolder,
    orgWorkspace: _rawOrgWorkspace,
    planeOpenChatAgentId: _rawOpenChat,
    planeLoopLinks: _rawLoopLinks,
    planeLoopNodePositions: _rawLoopPositions,
    planeLoopChains: _rawLoopChains,
    ...tabBase
  } = tab as TabSession & { panePlaneNodes?: unknown }
  const paneIdToAgentId: Record<string, string> = {}
  const knownAgentIds = new Set<string>()
  for (const [paneId, binding] of Object.entries(agentByPane)) {
    const agentId = binding.agentId?.trim()
    if (!agentId) continue
    paneIdToAgentId[paneId] = agentId
    knownAgentIds.add(agentId)
  }
  const planeLoopLinks = sanitizePlaneLoopLinks(
    tab.planeLoopLinks,
    knownAgentIds,
    paneIdToAgentId,
  )
  const planeLoopNodePositions = sanitizePlaneLoopNodePositions(
    tab.planeLoopNodePositions,
    knownAgentIds,
    paneIdToAgentId,
  )
  const planeLoopChains = sanitizePlaneLoopChains(
    tab.planeLoopChains,
    knownAgentIds,
    paneIdToAgentId,
  )
  return {
    tab: normalizeTabSession({
      ...tabBase,
      title: typeof tab.title === 'string' && tab.title.trim() ? tab.title : 'Workspace',
      paneIds,
      activePaneId,
      ...(Object.keys(paneKinds).length ? { paneKinds } : { paneKinds: undefined }),
      ...(Object.keys(agentByPane).length ? { agentByPane } : { agentByPane: undefined }),
      ...(paneWindows ? { paneWindows } : { paneWindows: undefined }),
      planeOpenChatAgentId,
      ...(projectFolder ? { projectFolder } : {}),
      ...(orgWorkspace ? { orgWorkspace } : {}),
      ...(planeLoopLinks.length ? { planeLoopLinks } : {}),
      ...(planeLoopNodePositions ? { planeLoopNodePositions } : {}),
      ...(planeLoopChains.length ? { planeLoopChains } : {}),
      // Contextos viven en disco (`.gravity`); nunca en session.
      contexts: undefined,
    }),
    migrations: [],
  }
}

/** Derive next tab counter from persisted tab titles like "Terminal 3". */
export function deriveTabCounter(tabs: TabSession[]): number {
  let max = tabs.length
  for (const tab of tabs) {
    const m = /(\d+)\s*$/.exec(tab.title)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return max
}

export function sanitizePersistedSession(saved: PersistedSessionInput): SanitizedSession | null {
  const rawTabs = Array.isArray(saved.tabs) ? saved.tabs : []
  const cwds = saved.cwds ?? {}

  // projectFolder desde cwd de terminales (hint de carpeta; no crea agentes).
  const tabsWithFolderHint = rawTabs.map(raw => {
    const tab = raw as TabSession
    if (typeof tab.projectFolder === 'string' && tab.projectFolder.trim()) return tab
    const paneIds = Array.isArray(tab.paneIds) ? tab.paneIds : []
    const terminalIds = paneIds.filter(paneId => tab.paneKinds?.[paneId] !== 'agent')
    const orderedIds = [
      ...terminalIds,
      ...paneIds.filter(paneId => !terminalIds.includes(paneId)),
    ]
    const fromPane = orderedIds
      .map(paneId => cwds[paneId]?.trim() || '')
      .find(Boolean)
    return fromPane ? { ...tab, projectFolder: fromPane } : tab
  })

  const sanitizedTabs: TabSession[] = []
  for (const raw of tabsWithFolderHint) {
    const result = sanitizeTab(raw as TabSession)
    if (!result) continue
    sanitizedTabs.push(result.tab)
  }

  if (sanitizedTabs.length === 0) return null

  const keptPaneIds = new Set(sanitizedTabs.flatMap(t => t.paneIds))
  const activeTabId = sanitizedTabs.some(t => t.id === saved.activeTabId)
    ? saved.activeTabId
    : sanitizedTabs[0]!.id

  const keptCwds = Object.fromEntries(
    Object.entries(cwds)
      .filter(([id]) => keptPaneIds.has(id))
      .filter(([, cwd]) => Boolean(cwd?.trim())),
  )

  const keptTabIds = new Set(sanitizedTabs.map(tab => tab.id))
  const explorerByTabRaw = Object.fromEntries(
    Object.entries(saved.explorerByTab ?? {}).filter(([id]) => keptTabIds.has(id)),
  )
  const explorerByPaneRaw = Object.fromEntries(
    Object.entries(saved.explorerByPane ?? {}).filter(([id]) => keptPaneIds.has(id)),
  )
  const explorerByTab = migrateExplorerStateByTab(
    sanitizedTabs,
    explorerByTabRaw,
    explorerByPaneRaw,
  )

  const allSavedPaneIds = new Set(
    rawTabs.flatMap(t => (Array.isArray((t as TabSession).paneIds) ? (t as TabSession).paneIds : [])),
  )
  const orphanPaneIds = [...allSavedPaneIds].filter(id => !keptPaneIds.has(id))

  return {
    tabs: sanitizedTabs,
    activeTabId,
    cwds: keptCwds,
    explorerByTab,
    orphanPaneIds,
    pendingAgentMigrations: [],
  }
}

/** @deprecated solo para tests de tipado; preferir AgentPaneMeta del catálogo. */
export type { AgentPaneMeta, AgentPermissionMode }
