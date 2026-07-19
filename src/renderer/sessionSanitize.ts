import type { FileExplorerPersistedState } from '@shared/fileExplorerPersistedState'
import type {
  AgentCliProvider,
  AgentPaneMeta,
  AgentPermissionMode,
  PaneKind,
  TabSession,
} from '@shared/tabSession'
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
  if (!tab?.id || !Array.isArray(tab.paneIds) || tab.paneIds.length === 0) return null
  const paneIds = tab.paneIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
  if (paneIds.length === 0) return null
  const activePaneId = paneIds.includes(tab.activePaneId)
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
      // 'readonly' es el nombre anterior del modo plan (sesiones ya guardadas).
      : rawMode === 'plan' || rawMode === 'readonly' ? 'plan'
      : 'ask'
    paneKinds[paneId] = 'agent'
    agentByPane[paneId] = {
      provider,
      permissionMode,
      ...(typeof raw?.model === 'string' && raw.model.trim()
        ? { model: raw.model.trim() }
        : {}),
      // Los ids se validan contra disco al descubrir; aquí solo se limpian tipos.
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
  return normalizeTabSession({
    ...tab,
    title: typeof tab.title === 'string' && tab.title.trim() ? tab.title : 'Terminal',
    paneIds,
    activePaneId,
    ...(Object.keys(paneKinds).length ? { paneKinds } : { paneKinds: undefined }),
    ...(Object.keys(agentByPane).length ? { agentByPane } : { agentByPane: undefined }),
    // Catálogo = `.iaterminal`; no se persiste en session.json.
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

  const explorerByPane = Object.fromEntries(
    Object.entries(saved.explorerByPane ?? {}).filter(([id]) => keptPaneIds.has(id)),
  )

  const allSavedPaneIds = new Set(
    rawTabs.flatMap(t => (Array.isArray((t as TabSession).paneIds) ? (t as TabSession).paneIds : [])),
  )
  const orphanPaneIds = [...allSavedPaneIds].filter(id => !keptPaneIds.has(id))

  return { tabs, activeTabId, cwds, explorerByPane, orphanPaneIds }
}
