import type { FileExplorerPersistedState } from '@shared/fileExplorerPersistedState'
import type {
  AgentCliProvider,
  AgentPaneMeta,
  AgentPermissionMode,
  PaneKind,
  TabSession,
} from '@shared/tabSession'
import {
  AGENT_NAME_MAX_LENGTH,
  AGENT_OBJECTIVE_MAX_LENGTH,
  AGENT_ROLE_MAX_LENGTH,
} from '@shared/agentIdentity'
import { collapseAllPaneWindows, ensurePaneWindows } from '@shared/paneWindows'
import { normalizeTabSession } from './tabSplitSizes'

export interface PersistedSessionInput {
  version: 1
  activeTabId: string
  tabs: TabSession[]
  cwds: Record<string, string>
  explorerByPane?: Record<string, FileExplorerPersistedState>
}

export interface SanitizedSession {
  tabs: TabSession[]
  activeTabId: string
  cwds: Record<string, string>
  explorerByPane: Record<string, FileExplorerPersistedState>
  orphanPaneIds: string[]
}

function sanitizeTab(tab: TabSession): TabSession | null {
  if (!tab?.id || !Array.isArray(tab.paneIds)) return null
  const paneIds = tab.paneIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
  // Plano vacío permitido (sin paneles).
  const activePaneId = paneIds.length === 0
    ? ''
    : paneIds.includes(tab.activePaneId)
      ? tab.activePaneId
      : paneIds[paneIds.length - 1]!
  const paneKinds: Record<string, PaneKind> = {}
  const agentByPane: Record<string, AgentPaneMeta> = {}
  for (const paneId of paneIds) {
    if (tab.paneKinds?.[paneId] !== 'agent') continue
    const raw = tab.agentByPane?.[paneId]
    const provider: AgentCliProvider =
      raw?.provider === 'cursor' || raw?.provider === 'claude' ? raw.provider : 'claude'
    const rawMode = raw?.permissionMode as string | undefined
    const permissionMode: AgentPermissionMode =
      rawMode === 'auto' ? 'auto'
      : rawMode === 'plan' || rawMode === 'readonly' ? 'plan'
      : 'ask'
    paneKinds[paneId] = 'agent'
    agentByPane[paneId] = {
      provider,
      permissionMode,
      ...(typeof raw?.name === 'string' && raw.name.trim()
        ? { name: raw.name.trim().slice(0, AGENT_NAME_MAX_LENGTH) }
        : {}),
      ...(typeof raw?.role === 'string' && raw.role.trim()
        ? { role: raw.role.trim().slice(0, AGENT_ROLE_MAX_LENGTH) }
        : {}),
      ...(typeof raw?.objective === 'string' && raw.objective.trim()
        ? { objective: raw.objective.trim().slice(0, AGENT_OBJECTIVE_MAX_LENGTH) }
        : {}),
      ...(typeof raw?.model === 'string' && raw.model.trim()
        ? { model: raw.model.trim() }
        : {}),
      ...(Array.isArray(raw?.contextIds)
        ? {
            contextIds: raw.contextIds.filter(
              (id): id is string => typeof id === 'string' && id.trim().length > 0,
            ),
          }
        : {}),
      ...(raw?.autoImproveContexts === true ? { autoImproveContexts: true } : {}),
      ...(typeof raw?.cliSessionId === 'string' && raw.cliSessionId.trim()
        ? { cliSessionId: raw.cliSessionId.trim() }
        : {}),
    }
  }
  const paneWindows = collapseAllPaneWindows(ensurePaneWindows(paneIds, tab.paneWindows))
  const projectFolder = typeof tab.projectFolder === 'string' && tab.projectFolder.trim()
    ? tab.projectFolder.trim()
    : undefined
  const {
    panePlaneNodes: _legacyPlaneNodes,
    contexts: _legacyContexts,
    projectFolder: _rawProjectFolder,
    ...tabBase
  } = tab as TabSession & { panePlaneNodes?: unknown }
  return normalizeTabSession({
    ...tabBase,
    title: typeof tab.title === 'string' && tab.title.trim() ? tab.title : 'Workspace',
    paneIds,
    activePaneId,
    ...(Object.keys(paneKinds).length ? { paneKinds } : { paneKinds: undefined }),
    ...(Object.keys(agentByPane).length ? { agentByPane } : { agentByPane: undefined }),
    ...(paneWindows ? { paneWindows } : { paneWindows: undefined }),
    ...(projectFolder ? { projectFolder } : {}),
    contexts: undefined,
  })
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
  const tabs = rawTabs
    .map(t => sanitizeTab(t as TabSession))
    .filter((t): t is TabSession => t !== null)

  if (tabs.length === 0) return null

  const keptPaneIds = new Set(tabs.flatMap(t => t.paneIds))
  const activeTabId = tabs.some(t => t.id === saved.activeTabId)
    ? saved.activeTabId
    : tabs[0]!.id

  const cwds = Object.fromEntries(
    Object.entries(saved.cwds ?? {})
      .filter(([id]) => keptPaneIds.has(id))
      .filter(([, cwd]) => Boolean(cwd?.trim())),
  )

  // Migración: pestañas antiguas sin projectFolder heredan el cwd de una terminal
  // (nunca de un agente). Si solo hay agentes, usa el primer cwd disponible.
  const tabsWithProject = tabs.map(tab => {
    if (tab.projectFolder?.trim()) return tab
    const terminalIds = tab.paneIds.filter(paneId => tab.paneKinds?.[paneId] !== 'agent')
    const orderedIds = [
      ...terminalIds,
      ...tab.paneIds.filter(paneId => !terminalIds.includes(paneId)),
    ]
    const fromPane = orderedIds
      .map(paneId => cwds[paneId]?.trim() || '')
      .find(Boolean)
    return fromPane ? { ...tab, projectFolder: fromPane } : tab
  })

  const explorerByPane = Object.fromEntries(
    Object.entries(saved.explorerByPane ?? {}).filter(([id]) => keptPaneIds.has(id)),
  )

  const allSavedPaneIds = new Set(
    rawTabs.flatMap(t => (Array.isArray((t as TabSession).paneIds) ? (t as TabSession).paneIds : [])),
  )
  const orphanPaneIds = [...allSavedPaneIds].filter(id => !keptPaneIds.has(id))

  return { tabs: tabsWithProject, activeTabId, cwds, explorerByPane, orphanPaneIds }
}
