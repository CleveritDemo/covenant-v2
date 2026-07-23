import type { FileExplorerPersistedState } from '@shared/fileExplorerPersistedState'
import type {
  AgentPaneBinding,
  AgentPaneMeta,
  AgentPermissionMode,
  PaneKind,
  TabSession,
} from '@shared/tabSession'
import {
  isLegacyRichAgentMeta,
  legacyAgentMetaToDefinition,
  parseAgentPaneBinding,
  type ProjectAgentDefinition,
} from '@shared/projectAgentCatalog'
import {
  sanitizePlaneLoopLinks,
  sanitizePlaneLoopNodePositions,
} from '@shared/planeLoopGraph'
import { sanitizePlaneLoopChains } from '@shared/planeLoopChain'
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
  /** Definiciones a escribir en `.iaterminal/agents/` tras migrar session legacy. */
  pendingAgentMigrations: Array<{
    projectFolder: string
    definition: ProjectAgentDefinition
  }>
}

function sanitizeTab(tab: TabSession): {
  tab: TabSession
  migrations: SanitizedSession['pendingAgentMigrations']
} | null {
  if (!tab?.id || !Array.isArray(tab.paneIds)) return null
  const paneIds = tab.paneIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
  const activePaneId = paneIds.length === 0
    ? ''
    : paneIds.includes(tab.activePaneId)
      ? tab.activePaneId
      : paneIds[paneIds.length - 1]!
  const paneKinds: Record<string, PaneKind> = {}
  const agentByPane: Record<string, AgentPaneBinding> = {}
  const migrations: SanitizedSession['pendingAgentMigrations'] = []
  const projectFolder = typeof tab.projectFolder === 'string' && tab.projectFolder.trim()
    ? tab.projectFolder.trim()
    : undefined
  const usedSlugs = new Set<string>()

  for (const paneId of paneIds) {
    if (tab.paneKinds?.[paneId] !== 'agent') continue
    paneKinds[paneId] = 'agent'
    const raw = tab.agentByPane?.[paneId] as unknown
    const binding = parseAgentPaneBinding(raw)
    if (binding) {
      usedSlugs.add(binding.agentId)
      agentByPane[paneId] = binding
      continue
    }
    if (isLegacyRichAgentMeta(raw) && projectFolder) {
      const definition = legacyAgentMetaToDefinition(paneId, raw, usedSlugs)
      if (definition) {
        usedSlugs.add(definition.id)
        const cliSessionId =
          raw && typeof raw === 'object'
          && typeof (raw as { cliSessionId?: unknown }).cliSessionId === 'string'
          && (raw as { cliSessionId: string }).cliSessionId.trim()
            ? (raw as { cliSessionId: string }).cliSessionId.trim()
            : undefined
        agentByPane[paneId] = {
          agentId: definition.id,
          ...(cliSessionId ? { cliSessionId } : {}),
        }
        migrations.push({ projectFolder, definition })
        continue
      }
    }
    // Binding inválido sin legacy: placeholder local (catálogo se crea al guardar config).
    const fallbackId = `agent-${paneId.slice(0, 8)}`
    const agentId = usedSlugs.has(fallbackId) ? `${fallbackId}-${usedSlugs.size}` : fallbackId
    usedSlugs.add(agentId)
    agentByPane[paneId] = { agentId }
  }

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
    planeOpenChatAgentId: _rawOpenChat,
    planeLoopLinks: _rawLoopLinks,
    planeLoopNodePositions: _rawLoopPositions,
    planeLoopChains: _rawLoopChains,
    ...tabBase
  } = tab as TabSession & { panePlaneNodes?: unknown }
  const agentPaneIds = new Set(
    Object.entries(paneKinds)
      .filter(([, kind]) => kind === 'agent')
      .map(([id]) => id),
  )
  const planeLoopLinks = sanitizePlaneLoopLinks(tab.planeLoopLinks, agentPaneIds)
  const planeLoopNodePositions = sanitizePlaneLoopNodePositions(
    tab.planeLoopNodePositions,
    agentPaneIds,
  )
  const planeLoopChains = sanitizePlaneLoopChains(tab.planeLoopChains, agentPaneIds)
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
      ...(planeLoopLinks.length ? { planeLoopLinks } : {}),
      ...(planeLoopNodePositions ? { planeLoopNodePositions } : {}),
      ...(planeLoopChains.length ? { planeLoopChains } : {}),
      contexts: undefined,
    }),
    migrations,
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

  // projectFolder antes de sanitizar agentes: la migración legacy necesita cwd.
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
  const pendingAgentMigrations: SanitizedSession['pendingAgentMigrations'] = []
  for (const raw of tabsWithFolderHint) {
    const result = sanitizeTab(raw as TabSession)
    if (!result) continue
    sanitizedTabs.push(result.tab)
    pendingAgentMigrations.push(...result.migrations)
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

  const explorerByPane = Object.fromEntries(
    Object.entries(saved.explorerByPane ?? {}).filter(([id]) => keptPaneIds.has(id)),
  )

  const allSavedPaneIds = new Set(
    rawTabs.flatMap(t => (Array.isArray((t as TabSession).paneIds) ? (t as TabSession).paneIds : [])),
  )
  const orphanPaneIds = [...allSavedPaneIds].filter(id => !keptPaneIds.has(id))

  return {
    tabs: sanitizedTabs,
    activeTabId,
    cwds: keptCwds,
    explorerByPane,
    orphanPaneIds,
    pendingAgentMigrations,
  }
}

/** @deprecated solo para tests de tipado; preferir AgentPaneMeta del catálogo. */
export type { AgentPaneMeta, AgentPermissionMode }
