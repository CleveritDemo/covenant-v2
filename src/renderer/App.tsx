import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyTheme, getTheme, normalizeThemeId } from '@themes/presets'
import type { AppConfig } from '@shared/configSchema'
import { CONFIG_DEFAULTS } from '@shared/configSchema'
import { i18next } from '@i18n/index'
import { useT } from '@i18n/useT'
import {
  DEFAULT_FILE_EXPLORER_STATE,
  normalizeFileExplorerState,
  type FileExplorerPersistedState,
} from '@shared/fileExplorerPersistedState'
import type { TabContext } from '@shared/tabContext'
import type { AgentCliImageAttachment } from '@shared/agentCliTypes'
import { resolveContextColor } from '@shared/tabContextAppearance'
import { contextIconName } from './agent/tabContextKindIcons'
import { TabBar, type TabBarHandle } from './components/TabBar'
import { TerminalPane } from './terminal/TerminalPane'
import { AgentPane } from './agent/AgentPane'
import { TabContextsModal } from './agent/TabContextsModal'
import { AppModals } from './components/AppModals'
import { TabAgenticPlane } from './workspace/TabAgenticPlane'
import {
  armMiniExpandSuppress,
  isMiniExpandSuppressed,
  setMiniExpandLocked,
} from './workspace/miniExpandSuppress'
import {
  createPaneWindowState,
  ensureTabPaneLayout,
  maxPaneWindowZ,
  minimizeOtherPaneWindows,
} from '@shared/paneWindows'
import type { AgentPlaneStatus, AgentPlaneQueueControls } from './agent/AgentPane'
import type { TerminalRef } from './terminal/TerminalPane'
import {
  listOrchestrationTargets,
  resolveDelegationTargetPaneId,
} from './workspace/orchestrationBridge'
import { formatDelegationResultFollowUp, formatDelegationRoundCapFollowUp, resolveOrchestrationMaxRounds } from '@shared/agentOrchestration'
import type { DelegateRequest, DelegateResult } from '@shared/agentOrchestration'
import { Titlebar } from './components/Titlebar'
import { sessionCwdFolderName } from './terminal/explorer/explorerPathUtils'
import {
  normalizeTabSession,
  type TabSplitSizes,
} from './tabSplitSizes'
import {
  computeTabInsertIndex,
  moveItemToIndex,
  reorderPaneIdsByKind,
  type PaneReorderKind,
} from './arrayReorder'
import { deriveTabCounter, sanitizePersistedSession } from './sessionSanitize'
import {
  resolveTabAgentMeta,
  syncTabAgentsFromCatalog,
  upsertAgentInList,
} from './projectAgentsStore'
import './styles/app.css'

import {
  type AgentCliProvider,
  type AgentPaneMeta,
  type PaneKind,
  type PlaneLoopChain,
  type TabSession,
} from '../shared/tabSession'
import {
  allocateAgentSlug,
  agentBindingFromMeta,
  agentDefinitionFromMeta,
  cloneProjectAgentDefinition,
  type ProjectAgentDefinition,
} from '../shared/projectAgentCatalog'
import {
  removePaneFromLoopChains,
  activeLoopChainPaneIds,
  chainHasPane,
  planeLoopChainsForPersist,
} from '../shared/planeLoopChain'
import {
  advanceLoopChainAfterStep,
  resumeLoopChainAfterWait,
  startLoopChain,
  stopLoopChain,
  type LoopOrchestratorAction,
} from './workspace/loopOrchestrator'
import {
  createLoopChainFifoItem,
  dequeueLoopChainFifoHead,
  enqueueLoopChainFifo,
  removeLoopChainFromFifo,
  removePaneFromFifo,
  type LoopChainFifoItem,
  type LoopChainTurnWait,
} from './workspace/loopChainFifo'

export type { TabSession, TabSplitSizes } from '../shared/tabSession'

/** Máximo de paneles (ventanas) por pestaña. */
export const MAX_PANES_PER_TAB = 10

function reorderPaneIdsAfterClose(paneIds: string[], closedPaneId: string): string[] {
  return paneIds.filter(id => id !== closedPaneId)
}

function capTabsPaneCount(tabs: TabSession[], maxPanes: number): { tabs: TabSession[]; orphanPaneIds: string[] } {
  const orphanPaneIds: string[] = []
  const out = tabs.map(tab => {
    if (tab.paneIds.length <= maxPanes) return tab
    orphanPaneIds.push(...tab.paneIds.slice(maxPanes))
    const paneIds = tab.paneIds.slice(0, maxPanes)
    const activePaneId = paneIds.includes(tab.activePaneId)
      ? tab.activePaneId
      : (paneIds[paneIds.length - 1] ?? '')
    const paneKinds = Object.fromEntries(
      Object.entries(tab.paneKinds ?? {}).filter(([id]) => paneIds.includes(id)),
    )
    const agentByPane = Object.fromEntries(
      Object.entries(tab.agentByPane ?? {}).filter(([id]) => paneIds.includes(id)),
    )
    const paneWindows = Object.fromEntries(
      Object.entries(tab.paneWindows ?? {}).filter(([id]) => paneIds.includes(id)),
    )
    const planeOpenChatAgentId =
      typeof tab.planeOpenChatAgentId === 'string'
      && paneIds.includes(tab.planeOpenChatAgentId)
      && paneKinds[tab.planeOpenChatAgentId] === 'agent'
        ? tab.planeOpenChatAgentId
        : null
    const agentPaneIds = new Set(
      paneIds.filter(id => paneKinds[id] === 'agent'),
    )
    const planeLoopLinks = (tab.planeLoopLinks ?? []).filter(
      link => agentPaneIds.has(link.fromPaneId) && agentPaneIds.has(link.toPaneId),
    )
    const planeLoopNodePositions = Object.fromEntries(
      Object.entries(tab.planeLoopNodePositions ?? {})
        .filter(([id]) => agentPaneIds.has(id)),
    )
    const planeLoopChains = (tab.planeLoopChains ?? [])
      .map(chain => ({
        ...chain,
        steps: chain.steps.filter(step => agentPaneIds.has(step.paneId)),
      }))
      .filter(chain => chain.steps.length > 0)
      .map(chain => ({
        ...chain,
        cursor: chain.cursor >= 0 && chain.cursor < chain.steps.length ? chain.cursor : 0,
        status: 'idle' as const,
      }))
    const {
      panePlaneNodes: _legacyPlaneNodes,
      ...tabBase
    } = tab as TabSession & { panePlaneNodes?: unknown }
    return normalizeTabSession({
      ...tabBase,
      paneIds,
      activePaneId,
      ...(Object.keys(paneKinds).length ? { paneKinds } : { paneKinds: undefined }),
      ...(Object.keys(agentByPane).length ? { agentByPane } : { agentByPane: undefined }),
      ...(Object.keys(paneWindows).length ? { paneWindows } : { paneWindows: undefined }),
      planeOpenChatAgentId,
      ...(planeLoopLinks.length ? { planeLoopLinks } : { planeLoopLinks: undefined }),
      ...(Object.keys(planeLoopNodePositions).length
        ? { planeLoopNodePositions }
        : { planeLoopNodePositions: undefined }),
      ...(planeLoopChains.length ? { planeLoopChains } : { planeLoopChains: undefined }),
    })
  })
  return { tabs: out, orphanPaneIds: orphanPaneIds }
}

/** Marca que las pestañas ya fueron cargadas desde persistencia (o se creó la primera). */
type SessionReady = { loaded: boolean }

let tabCounter = 0
/** Nueva pestaña: plano vacío (sin agente ni terminal abiertos). */
function newTab(title: string): TabSession {
  return {
    id: crypto.randomUUID(),
    title,
    paneIds: [],
    activePaneId: '',
    planeOpenChatAgentId: null,
  }
}

export const App: React.FC = () => {
  const { t } = useT()
  const [tabs, setTabs] = useState<TabSession[]>([])
  const [activeTabId, setActiveTabId] = useState<string>('')
  const [config, setConfig] = useState<AppConfig>(CONFIG_DEFAULTS)
  const [configReady, setConfigReady] = useState(false)
  const [sessionReady, setSessionReady] = useState<SessionReady>({ loaded: false })
  const [explorerByPane, setExplorerByPane] = useState<Record<string, FileExplorerPersistedState>>({})
  const [busyPanes, setBusyPanes] = useState<Set<string>>(new Set())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [themePickerOpen, setThemePickerOpen] = useState(false)
  const [agentPicker, setAgentPicker] = useState<{ tabId: string; fromPaneId?: string } | null>(null)
  const [agentPlaneStatus, setAgentPlaneStatus] = useState<Record<string, AgentPlaneStatus>>({})
  const planeLoopToggleByPaneRef = useRef(new Map<string, () => void>())
  const planeQueueControlsByPaneRef = useRef(new Map<string, AgentPlaneQueueControls>())
  const [tabContextsByTab, setTabContextsByTab] = useState<Record<string, TabContext[]>>({})
  /** Catálogo `.iaterminal/agents` indexado por projectFolder. */
  const [projectAgentsByCwd, setProjectAgentsByCwd] = useState<Record<string, ProjectAgentDefinition[]>>({})
  const projectAgentsByCwdRef = useRef(projectAgentsByCwd)
  projectAgentsByCwdRef.current = projectAgentsByCwd
  const handleAgentMetaChangeRef = useRef<(
    tabId: string,
    paneId: string,
    meta: AgentPaneMeta | ((previous: AgentPaneMeta) => AgentPaneMeta),
  ) => Promise<boolean>>(async () => true)
  const [openConfigForPaneId, setOpenConfigForPaneId] = useState<string | null>(null)
  /** Evita que el click al cerrar el modal de config expanda el mini del plano. */
  const suppressPaneExpandUntilRef = useRef(0)
  const armSuppressPaneExpand = useCallback(() => {
    // Corto: solo el gesto que cierra el modal (pointerup/click fantasma).
    const until = Date.now() + 320
    suppressPaneExpandUntilRef.current = until
    armMiniExpandSuppress(320)
  }, [])
  const lockMiniExpandForConfig = useCallback(() => {
    setMiniExpandLocked(true)
  }, [])
  const unlockMiniExpandForConfig = useCallback(() => {
    setMiniExpandLocked(false)
    suppressPaneExpandUntilRef.current = Date.now() + 320
  }, [])
  const [openContextForPane, setOpenContextForPane] = useState<{ paneId: string; contextId: string } | null>(null)
  const [planeSendByPane, setPlaneSendByPane] = useState<Record<string, {
    text: string
    images: AgentCliImageAttachment[]
    focusPane?: boolean
    orchestrationFollowUp?: boolean
    allowDelegations?: boolean
    delegation?: {
      id: string
      fromPaneId: string
      toAgentId: string
    }
  }>>({})
  const [planeStopPaneIds, setPlaneStopPaneIds] = useState<ReadonlySet<string>>(() => new Set())
  const [planeClearPaneId, setPlaneClearPaneId] = useState<string | null>(null)
  const [planeLoopsOpenByTab, setPlaneLoopsOpenByTab] = useState<Record<string, boolean>>({})
  const [loopFifoTick, setLoopFifoTick] = useState(0)
  const [orchestrationFifoTick, setOrchestrationFifoTick] = useState(0)
  const chainFifoByPaneRef = useRef(new Map<string, LoopChainFifoItem[]>())
  const chainOfferByPaneRef = useRef(new Map<string, LoopChainFifoItem>())
  const chainTurnWaitRef = useRef(new Map<string, LoopChainTurnWait>())
  const chainWaitTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const prevBusyByPaneRef = useRef<Record<string, boolean>>({})
  /** Cola de envíos de orquestación (delegaciones + follow-ups) por pane. */
  const orchestrationFifoByPaneRef = useRef(new Map<string, Array<{
    text: string
    images: AgentCliImageAttachment[]
    focusPane?: boolean
    orchestrationFollowUp?: boolean
    allowDelegations?: boolean
    delegation?: {
      id: string
      fromPaneId: string
      toAgentId: string
    }
  }>>())
  /** Delegaciones en vuelo: id → destino (para cancelar al stop del orquestador). */
  const pendingDelegationsByOrchestratorRef = useRef(new Map<string, Map<string, string>>())
  /** Oleadas de delegación por orquestador (se resetea en cada pedido humano). */
  const orchestrationRoundsByPaneRef = useRef(new Map<string, number>())
  const [planeContextsModalTabId, setPlaneContextsModalTabId] = useState<string | null>(null)
  const termRefs = useRef<Map<string, TerminalRef>>(new Map())
  const splitSpawnCwdRef = useRef<Map<string, string>>(new Map())
  const cwdsRef = useRef<Record<string, string>>({})
  /** Mirror reactivo de cwdsRef para badges de minis en el plano. */
  const [paneCwds, setPaneCwds] = useState<Record<string, string>>({})
  const explorerByPaneRef = useRef<Record<string, FileExplorerPersistedState>>({})
  const tabsRef = useRef(tabs)
  const activeTabIdRef = useRef(activeTabId)
  const tabContextsByTabRef = useRef(tabContextsByTab)
  tabsRef.current = tabs
  activeTabIdRef.current = activeTabId
  tabContextsByTabRef.current = tabContextsByTab

  // Guardar sesión con debounce al cambiar tabs / activeTabId
  const saveSessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Resuelve cwd para persistir: IPC, último guardado o cwd de spawn pendiente. */
  const resolvePaneCwdForPersist = useCallback(async (paneId: string): Promise<string> => {
    const fallback =
      cwdsRef.current[paneId]?.trim() ||
      splitSpawnCwdRef.current.get(paneId)?.trim() ||
      ''
    try {
      const cwd = (await window.api.getSessionCwd(paneId)).trim()
      return cwd || fallback
    } catch {
      return fallback
    }
  }, [])

  const rememberPaneCwd = useCallback((paneId: string, cwd: string): void => {
    const dir = cwd.trim()
    if (!dir) return
    cwdsRef.current = { ...cwdsRef.current, [paneId]: dir }
    splitSpawnCwdRef.current.set(paneId, dir)
    setPaneCwds(prev => (prev[paneId] === dir ? prev : { ...prev, [paneId]: dir }))
  }, [])

  const refreshProjectAgents = useCallback(async (cwd: string): Promise<ProjectAgentDefinition[]> => {
    const root = cwd.trim()
    if (!root) return []
    const agents = await window.api.listProjectAgents(root)
    setProjectAgentsByCwd(prev => (
      prev[root] === agents ? prev : { ...prev, [root]: agents }
    ))
    projectAgentsByCwdRef.current = {
      ...projectAgentsByCwdRef.current,
      [root]: agents,
    }
    return agents
  }, [])

  const rememberProjectAgent = useCallback((cwd: string, agent: ProjectAgentDefinition) => {
    // '' = catálogo efímero cuando la pestaña aún no tiene projectFolder.
    const root = cwd.trim()
    setProjectAgentsByCwd(prev => {
      const next = { ...prev, [root]: upsertAgentInList(prev[root] ?? [], agent) }
      projectAgentsByCwdRef.current = next
      return next
    })
  }, [])

  /** Limpia recursos locales de panes de agente eliminados al sincronizar con el catálogo. */
  const cleanupRemovedAgentPanes = useCallback((paneIds: string[]) => {
    for (const paneId of paneIds) {
      window.api.stopAgentTurn(paneId)
      termRefs.current.delete(paneId)
      splitSpawnCwdRef.current.delete(paneId)
      delete cwdsRef.current[paneId]
      planeLoopToggleByPaneRef.current.delete(paneId)
      planeQueueControlsByPaneRef.current.delete(paneId)
      removePaneFromFifo(chainFifoByPaneRef.current, paneId)
      chainOfferByPaneRef.current.delete(paneId)
      for (const [chainId, wait] of [...chainTurnWaitRef.current.entries()]) {
        if (wait.paneId === paneId) chainTurnWaitRef.current.delete(chainId)
      }
      delete prevBusyByPaneRef.current[paneId]
    }
    setPaneCwds(prev => {
      let changed = false
      const next = { ...prev }
      for (const paneId of paneIds) {
        if (paneId in next) {
          delete next[paneId]
          changed = true
        }
      }
      return changed ? next : prev
    })
    setBusyPanes(prev => {
      let changed = false
      const next = new Set(prev)
      for (const paneId of paneIds) {
        if (next.delete(paneId)) changed = true
      }
      return changed ? next : prev
    })
    setAgentPlaneStatus(prev => {
      let changed = false
      const next = { ...prev }
      for (const paneId of paneIds) {
        if (paneId in next) {
          delete next[paneId]
          changed = true
        }
      }
      return changed ? next : prev
    })
    setPlaneSendByPane(prev => {
      let changed = false
      const next = { ...prev }
      for (const paneId of paneIds) {
        if (paneId in next) {
          delete next[paneId]
          changed = true
        }
      }
      return changed ? next : prev
    })
    setExplorerByPane(prev => {
      let changed = false
      const next = { ...prev }
      for (const paneId of paneIds) {
        if (paneId in next) {
          delete next[paneId]
          changed = true
        }
      }
      if (changed) explorerByPaneRef.current = next
      return changed ? next : prev
    })
    setTimeout(() => {
      for (const paneId of paneIds) {
        window.api.deleteScrollback(paneId)
        window.api.deleteAiChat(paneId)
        window.api.deleteCmdHistory(paneId)
        window.api.deleteInteractionsLog(paneId)
        window.api.deleteAgentChat(paneId)
      }
    }, 0)
  }, [])

  /** Alinea panes de agente de una tab con `.iaterminal/agents` (fuente de verdad). */
  const syncTabWithProjectAgents = useCallback((
    tabId: string,
    agents: ProjectAgentDefinition[],
  ): void => {
    const current = tabsRef.current.find(tab => tab.id === tabId)
    if (!current) return
    const synced = syncTabAgentsFromCatalog(current, agents, {
      maxPanes: MAX_PANES_PER_TAB,
      createPaneId: () => crypto.randomUUID(),
      createWindow: (paneWindows, open) => createPaneWindowState(paneWindows, open),
    })
    if (!synced.changed) return
    if (synced.removedPaneIds.length) cleanupRemovedAgentPanes(synced.removedPaneIds)
    for (const paneId of synced.addedPaneIds) {
      const cwd = synced.tab.projectFolder?.trim() || ''
      if (cwd) rememberPaneCwd(paneId, cwd)
    }
    const nextTabs = tabsRef.current.map(tab => (
      tab.id === tabId ? normalizeTabSession(ensureTabPaneLayout(synced.tab)) : tab
    ))
    tabsRef.current = nextTabs
    setTabs(nextTabs)
  }, [cleanupRemovedAgentPanes, rememberPaneCwd])

  const refreshAndSyncProjectAgents = useCallback(async (cwd: string, tabId?: string) => {
    const agents = await refreshProjectAgents(cwd)
    const root = cwd.trim()
    if (!root) return agents
    const targets = tabsRef.current.filter(tab => {
      if (tab.projectFolder?.trim() !== root) return false
      if (tabId) return tab.id === tabId
      return true
    })
    for (const tab of targets) syncTabWithProjectAgents(tab.id, agents)
    return agents
  }, [refreshProjectAgents, syncTabWithProjectAgents])

  const buildSessionSnapshot = useCallback(() => {
    const currentTabs = tabsRef.current
    const currentActiveTabId = activeTabIdRef.current
    if (!currentTabs.length || !currentActiveTabId) return null
    const tabs = currentTabs.map(tab => {
      const planeLoopChains = planeLoopChainsForPersist(tab.planeLoopChains)
      if (!planeLoopChains) {
        if (!tab.planeLoopChains) return tab
        const { planeLoopChains: _dropped, ...rest } = tab
        return rest
      }
      return { ...tab, planeLoopChains }
    })
    return {
      version: 1 as const,
      activeTabId: currentActiveTabId,
      tabs,
      cwds: { ...cwdsRef.current },
      explorerByPane: { ...explorerByPaneRef.current },
    }
  }, [])

  const saveSessionNow = useCallback(async () => {
    const snapshot = buildSessionSnapshot()
    if (!snapshot) return
    await window.api.saveSession(snapshot)
  }, [buildSessionSnapshot])

  /** Tras `cd`: actualiza cwds y escribe session.json de inmediato. */
  const persistPaneCwdOnCd = useCallback(
    (paneId: string, cwd: string) => {
      rememberPaneCwd(paneId, cwd)
      void saveSessionNow()
    },
    [rememberPaneCwd, saveSessionNow],
  )

  /** Consulta el cwd actual de cada pane via IPC y lo guarda en cwdsRef antes de persistir. */
  const flushCwdsAndSave = useCallback(async () => {
    const currentTabs = tabsRef.current
    const currentActiveTabId = activeTabIdRef.current
    if (!currentTabs.length || !currentActiveTabId) return
    const allPaneIds = currentTabs.flatMap(t => t.paneIds)
    const entries = await Promise.all(
      allPaneIds.map(async paneId => [paneId, await resolvePaneCwdForPersist(paneId)] as const),
    )
    cwdsRef.current = Object.fromEntries(entries)
    setPaneCwds(prev => {
      const next = Object.fromEntries(
        entries.filter(([, cwd]) => Boolean(cwd.trim())),
      )
      const prevKeys = Object.keys(prev)
      const nextKeys = Object.keys(next)
      if (
        prevKeys.length === nextKeys.length
        && nextKeys.every(key => prev[key] === next[key])
      ) {
        return prev
      }
      return next
    })
    await saveSessionNow()
  }, [resolvePaneCwdForPersist, saveSessionNow])

  const scheduleSaveSession = useCallback(() => {
    if (saveSessionTimerRef.current) clearTimeout(saveSessionTimerRef.current)
    saveSessionTimerRef.current = setTimeout(() => {
      void flushCwdsAndSave()
    }, 400)
  }, [flushCwdsAndSave])

  /** Guarda al instante sesión + scrollbacks visibles (ocultar/cerrar ventana). */
  const flushSessionSnapshotNow = useCallback(() => {
    if (saveSessionTimerRef.current) {
      clearTimeout(saveSessionTimerRef.current)
      saveSessionTimerRef.current = null
    }
    const snapshot = buildSessionSnapshot()
    if (snapshot) void window.api.saveSession(snapshot)
    for (const [paneId, ref] of termRefs.current.entries()) {
      try {
        const data = ref.serialize()
        if (data) window.api.saveScrollback(paneId, data)
      } catch { /* ignore */ }
    }
  }, [buildSessionSnapshot])

  useEffect(() => {
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') flushSessionSnapshotNow()
    }
    window.addEventListener('pagehide', flushSessionSnapshotNow)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flushSessionSnapshotNow)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [flushSessionSnapshotNow])

  // Load config on mount; theme + fuente se aplican en el efecto siguiente cuando `configReady`
  useEffect(() => {
    window.api.getConfig().then(cfg => {
      const tid = normalizeThemeId(cfg.themeId)
      if (tid !== cfg.themeId) {
        void window.api.setConfig({ themeId: tid })
      }
      setConfig({ ...cfg, themeId: tid })
      setConfigReady(true)
    })
  }, [])

  useEffect(() => {
    if (!configReady) return
    applyTheme(getTheme(config.themeId))
  }, [configReady, config.themeId])

  useEffect(() => {
    if (!configReady) return
    void i18next.changeLanguage(config.language ?? 'en')
  }, [configReady, config.language])

  // Load persisted session on mount
  useEffect(() => {
    window.api.loadSession().then(saved => {
      const sanitized = saved ? sanitizePersistedSession(saved) : null
      if (sanitized) {
        const { tabs: cappedTabs, orphanPaneIds: capOrphans } = capTabsPaneCount(
          sanitized.tabs,
          MAX_PANES_PER_TAB,
        )
        const orphanPaneIds = [...new Set([...sanitized.orphanPaneIds, ...capOrphans])]
        const keptPaneIds = new Set(cappedTabs.flatMap(t => t.paneIds))
        for (const pid of orphanPaneIds) {
          window.api.ptyKill(pid)
          splitSpawnCwdRef.current.delete(pid)
          delete cwdsRef.current[pid]
        }
        setPaneCwds(prev => {
          if (orphanPaneIds.length === 0) return prev
          const next = { ...prev }
          for (const pid of orphanPaneIds) delete next[pid]
          return next
        })
        setTimeout(() => {
          for (const pid of orphanPaneIds) {
            window.api.deleteScrollback(pid)
            window.api.deleteAiChat(pid)
            window.api.deleteCmdHistory(pid)
            window.api.deleteInteractionsLog(pid)
            window.api.deleteAgentChat(pid)
          }
        }, 0)
        cwdsRef.current = Object.fromEntries(
          Object.entries(sanitized.cwds).filter(([id]) => keptPaneIds.has(id)),
        )
        setPaneCwds({ ...cwdsRef.current })
        const explorerMap = Object.fromEntries(
          Object.entries(sanitized.explorerByPane)
            .filter(([id]) => keptPaneIds.has(id))
            .map(([id, st]) => [id, normalizeFileExplorerState(st)]),
        )
        explorerByPaneRef.current = explorerMap
        setExplorerByPane(explorerMap)
        for (const [paneId, cwd] of Object.entries(cwdsRef.current)) {
          if (cwd.trim()) splitSpawnCwdRef.current.set(paneId, cwd)
        }
        tabCounter = deriveTabCounter(cappedTabs)
        const activeTabId = cappedTabs.some(t => t.id === sanitized.activeTabId)
          ? sanitized.activeTabId
          : cappedTabs[0]!.id
        const layoutTabs = cappedTabs.map(tab => normalizeTabSession(ensureTabPaneLayout(tab)))
        setTabs(layoutTabs)
        tabsRef.current = layoutTabs
        setActiveTabId(activeTabId)
        // Migrar metas legacy a `.iaterminal/agents` y sincronizar planos con el catálogo.
        void (async () => {
          for (const item of sanitized.pendingAgentMigrations) {
            await window.api.upsertProjectAgent(item.projectFolder, item.definition)
          }
          const folders = [...new Set(
            layoutTabs
              .map(tab => tab.projectFolder?.trim() || '')
              .filter(Boolean),
          )]
          await Promise.all(folders.map(folder => refreshAndSyncProjectAgents(folder)))
          const snapshot = buildSessionSnapshot()
          if (snapshot) await window.api.saveSession(snapshot)
        })()
        // Persistir layout migrado (paneWindows / plane nodes) de inmediato.
        void window.api.saveSession({
          version: 1,
          activeTabId,
          tabs: layoutTabs.map(tab => {
            const planeLoopChains = planeLoopChainsForPersist(tab.planeLoopChains)
            if (!planeLoopChains) {
              if (!tab.planeLoopChains) return tab
              const { planeLoopChains: _dropped, ...rest } = tab
              return rest
            }
            return { ...tab, planeLoopChains }
          }),
          cwds: { ...cwdsRef.current },
          explorerByPane: { ...explorerByPaneRef.current },
        })
      } else {
        const tab = newTab(t('tabs.defaultTitle', { n: ++tabCounter }))
        setTabs([tab])
        setActiveTabId(tab.id)
      }
      setSessionReady({ loaded: true })
    }).catch(() => {
      const tab = newTab(t('tabs.defaultTitle', { n: ++tabCounter }))
      setTabs([tab])
      setActiveTabId(tab.id)
      setSessionReady({ loaded: true })
    })
    // Solo al montar: sync via closures actuales (no re-cargar session).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Guardar sesión cuando cambia tabs o activeTabId (solo después de que se cargó la sesión)
  useEffect(() => {
    if (!sessionReady.loaded || !tabs.length) return
    scheduleSaveSession()
  }, [tabs, activeTabId, sessionReady.loaded, scheduleSaveSession])

  /** Solo refit cuando cambia open/fullscreen (el tamaño es fijo ~70% del viewport). */
  const terminalRefitKey = useMemo(() => {
    const tab = tabs.find(t => t.id === activeTabId)
    if (!tab) return ''
    return tab.paneIds.map(paneId => {
      const win = tab.paneWindows?.[paneId]
      return [
        paneId,
        win?.open ? '1' : '0',
        win?.fullscreen ? '1' : '0',
      ].join(':')
    }).join('|')
  }, [tabs, activeTabId])

  useEffect(() => {
    const tab = tabsRef.current.find(t => t.id === activeTabId)
    if (!tab) return

    const raf = requestAnimationFrame(() => {
      for (const paneId of tab.paneIds) {
        termRefs.current.get(paneId)?.refit?.()
      }
    })
    return () => {
      cancelAnimationFrame(raf)
    }
  }, [activeTabId, terminalRefitKey])

  /** Rediscover contextos solo si cambia el tab o sus panes. */
  const tabContextDiscoverKey = useMemo(() => {
    const tab = tabs.find(t => t.id === activeTabId)
    if (!tab) return ''
    return `${tab.id}:${tab.paneIds.join(',')}`
  }, [tabs, activeTabId])

  // Catálogo de contextos del tab activo (plano 2D)
  useEffect(() => {
    const tab = tabsRef.current.find(item => item.id === activeTabIdRef.current)
    if (!tab) return
    let cancelled = false
    void (async () => {
      const cwd = tab.projectFolder?.trim()
        || (tab.paneIds.find(id => tab.paneKinds?.[id] !== 'agent')
          ? await resolvePaneCwdForPersist(
            tab.paneIds.find(id => tab.paneKinds?.[id] !== 'agent')!,
          )
          : '')
      if (!cwd || cancelled) return
      const result = await window.api.discoverTabContexts({ cwd })
      if (cancelled || !result.ok) return
      setTabContextsByTab(prev => ({ ...prev, [tab.id]: result.contexts }))
    })()
    return () => { cancelled = true }
  }, [activeTabId, tabContextDiscoverKey, resolvePaneCwdForPersist])

  // Manejar APP_SAVE_BEFORE_CLOSE: serializar scrollbacks, actualizar cwds y responder
  useEffect(() => {
    return window.api.onSaveBeforeClose(() => {
      void (async () => {
        const scrollbacks: Record<string, string> = {}
        for (const [paneId, ref] of termRefs.current.entries()) {
          try {
            const data = ref.serialize()
            if (data) scrollbacks[paneId] = data
          } catch { /* ignore */ }
        }
        // Consultar cwds actuales antes del guardado final
        const currentTabs = tabsRef.current
        const currentActiveTabId = activeTabIdRef.current
        if (currentTabs.length && currentActiveTabId) {
          const allPaneIds = currentTabs.flatMap(t => t.paneIds)
          const entries = await Promise.all(
            allPaneIds.map(async paneId => [paneId, await resolvePaneCwdForPersist(paneId)] as const),
          )
          cwdsRef.current = Object.fromEntries(entries)
          await window.api.saveSession({
            version: 1,
            activeTabId: currentActiveTabId,
            tabs: currentTabs,
            cwds: cwdsRef.current,
            explorerByPane: { ...explorerByPaneRef.current },
          })
        }
        window.api.sendCloseReady(scrollbacks)
      })()
    })
  }, [resolvePaneCwdForPersist])

  const handleBusyChange = useCallback((paneId: string, busy: boolean) => {
    setBusyPanes(prev => {
      const hasPid = prev.has(paneId)
      if (busy === hasPid) return prev
      const next = new Set(prev)
      if (busy) next.add(paneId)
      else next.delete(paneId)
      return next
    })
  }, [])

  const busyTabIds = useMemo(() => {
    const ids = new Set<string>()
    for (const tab of tabs) {
      if (tab.paneIds.some(pid => busyPanes.has(pid))) ids.add(tab.id)
    }
    return ids
  }, [tabs, busyPanes])

  const handleFileExplorerChange = useCallback(
    (paneId: string, state: FileExplorerPersistedState) => {
      setExplorerByPane(prev => {
        const next = { ...prev, [paneId]: state }
        explorerByPaneRef.current = next
        return next
      })
      scheduleSaveSession()
    },
    [scheduleSaveSession],
  )

  const handleAddTab = useCallback(() => {
    const tab = newTab(t('tabs.defaultTitle', { n: ++tabCounter }))
    setTabs(prev => [...prev, tab])
    setActiveTabId(tab.id)
  }, [t])

  /** ⌘W: mismo modal que la cruz del panel (TerminalPane registra `openConfirm` por paneId). */
  const paneShortcutCloseInterceptors = useRef(new Map<string, () => void>())
  const registerPaneShortcutCloseIntercept = useCallback((paneId: string, openConfirm: () => void) => {
    paneShortcutCloseInterceptors.current.set(paneId, openConfirm)
    return () => {
      paneShortcutCloseInterceptors.current.delete(paneId)
    }
  }, [])

  const handleCloseTab = useCallback((tabId: string) => {
    const victim = tabsRef.current.find(t => t.id === tabId)
    if (victim) {
      setExplorerByPane(ex => {
        const next = { ...ex }
        for (const p of victim.paneIds) delete next[p]
        explorerByPaneRef.current = next
        return next
      })
      const paneIds = [...victim.paneIds]
      for (const pid of paneIds) {
        if (victim.paneKinds?.[pid] === 'agent') window.api.stopAgentTurn(pid)
        else window.api.ptyKill(pid)
        termRefs.current.delete(pid)
        splitSpawnCwdRef.current.delete(pid)
        delete cwdsRef.current[pid]
      }
      setPaneCwds(prev => {
        let changed = false
        const next = { ...prev }
        for (const pid of paneIds) {
          if (pid in next) {
            delete next[pid]
            changed = true
          }
        }
        return changed ? next : prev
      })
      setBusyPanes(prev => {
        if (!paneIds.some(pid => prev.has(pid))) return prev
        const next = new Set(prev)
        paneIds.forEach(pid => next.delete(pid))
        return next
      })
      setTimeout(() => {
        for (const pid of paneIds) {
          window.api.deleteScrollback(pid)
          window.api.deleteAiChat(pid)
          window.api.deleteCmdHistory(pid)
          window.api.deleteInteractionsLog(pid)
          window.api.deleteAgentChat(pid)
        }
      }, 0)
    }
    setTabs(prev => {
      const next = prev.filter(tab => tab.id !== tabId)
      if (next.length === 0) {
        const fresh = newTab(t('tabs.defaultTitle', { n: ++tabCounter }))
        setActiveTabId(fresh.id)
        return [fresh]
      }
      if (activeTabId === tabId) {
        setActiveTabId(next[next.length - 1].id)
      }
      return next
    })
  }, [activeTabId, t])

  const handleClosePane = useCallback((tabId: string, paneId: string) => {
    const t = tabsRef.current.find(x => x.id === tabId)
    if (!t || !t.paneIds.includes(paneId)) return
    const isAgent = t.paneKinds?.[paneId] === 'agent'
    const agentId = t.agentByPane?.[paneId]?.agentId
    const cwd = t.projectFolder?.trim() || ''
    if (isAgent && cwd && agentId) {
      void window.api.deleteProjectAgent(cwd, agentId).then(result => {
        if (!result.ok) return
        setProjectAgentsByCwd(prev => {
          const list = (prev[cwd] ?? []).filter(agent => agent.id !== agentId)
          const next = { ...prev, [cwd]: list }
          projectAgentsByCwdRef.current = next
          return next
        })
      })
    }
    setExplorerByPane(prev => {
      const next = { ...prev }
      delete next[paneId]
      explorerByPaneRef.current = next
      return next
    })
    if (isAgent) window.api.stopAgentTurn(paneId)
    else window.api.ptyKill(paneId)
    termRefs.current.delete(paneId)
    splitSpawnCwdRef.current.delete(paneId)
    delete cwdsRef.current[paneId]
    setPaneCwds(prev => {
      if (!(paneId in prev)) return prev
      const next = { ...prev }
      delete next[paneId]
      return next
    })
    setBusyPanes(prev => {
      if (!prev.has(paneId)) return prev
      const next = new Set(prev)
      next.delete(paneId)
      return next
    })
    setTabs(prev => prev.map(tab => {
      if (tab.id !== tabId) return tab
      const idx = tab.paneIds.indexOf(paneId)
      if (idx < 0) return tab
      const nextPanes = reorderPaneIdsAfterClose(tab.paneIds, paneId)
      let nextActive = tab.activePaneId
      if (nextActive === paneId) {
        nextActive = nextPanes[Math.max(0, idx - 1)] ?? nextPanes[0] ?? ''
      }
      const paneKinds = { ...(tab.paneKinds ?? {}) }
      const agentByPane = { ...(tab.agentByPane ?? {}) }
      const paneWindows = { ...(tab.paneWindows ?? {}) }
      delete paneKinds[paneId]
      delete agentByPane[paneId]
      delete paneWindows[paneId]
      const planeOpenChatAgentId = tab.planeOpenChatAgentId === paneId
        ? null
        : (tab.planeOpenChatAgentId ?? null)
      const planeLoopLinks = (tab.planeLoopLinks ?? []).filter(
        link => link.fromPaneId !== paneId && link.toPaneId !== paneId,
      )
      const planeLoopNodePositions = { ...(tab.planeLoopNodePositions ?? {}) }
      delete planeLoopNodePositions[paneId]
      const planeLoopChains = removePaneFromLoopChains(tab.planeLoopChains ?? [], paneId)
      const {
        panePlaneNodes: _legacyPlaneNodes,
        ...tabBase
      } = tab as TabSession & { panePlaneNodes?: unknown }
      return normalizeTabSession({
        ...tabBase,
        paneIds: nextPanes,
        activePaneId: nextActive,
        ...(Object.keys(paneKinds).length ? { paneKinds } : { paneKinds: undefined }),
        ...(Object.keys(agentByPane).length ? { agentByPane } : { agentByPane: undefined }),
        ...(Object.keys(paneWindows).length ? { paneWindows } : { paneWindows: undefined }),
        planeOpenChatAgentId,
        ...(planeLoopLinks.length ? { planeLoopLinks } : { planeLoopLinks: undefined }),
        ...(Object.keys(planeLoopNodePositions).length
          ? { planeLoopNodePositions }
          : { planeLoopNodePositions: undefined }),
        ...(planeLoopChains.length ? { planeLoopChains } : { planeLoopChains: undefined }),
      })
    }))
    setAgentPlaneStatus(prev => {
      if (!(paneId in prev)) return prev
      const next = { ...prev }
      delete next[paneId]
      return next
    })
    removePaneFromFifo(chainFifoByPaneRef.current, paneId)
    chainOfferByPaneRef.current.delete(paneId)
    setPlaneSendByPane(prev => {
      if (!(paneId in prev)) return prev
      const next = { ...prev }
      delete next[paneId]
      return next
    })
    for (const [chainId, wait] of [...chainTurnWaitRef.current.entries()]) {
      if (wait.paneId === paneId) chainTurnWaitRef.current.delete(chainId)
    }
    delete prevBusyByPaneRef.current[paneId]
    planeLoopToggleByPaneRef.current.delete(paneId)
    planeQueueControlsByPaneRef.current.delete(paneId)
    setTimeout(() => {
      window.api.deleteScrollback(paneId)
      window.api.deleteAiChat(paneId)
      window.api.deleteCmdHistory(paneId)
      window.api.deleteInteractionsLog(paneId)
      window.api.deleteAgentChat(paneId)
    }, 0)
  }, [])

  const handlePickProjectFolder = useCallback(async (tabId: string): Promise<string | null> => {
    const tab = tabsRef.current.find(t => t.id === tabId)
    const result = await window.api.selectDirectory({
      title: t('tabs.projectFolderDialogTitle'),
      defaultPath: tab?.projectFolder?.trim() || undefined,
    })
    if (!result.ok) return null
    const path = result.path.trim()
    if (!path) return null
    const previousCwd = tab?.projectFolder?.trim() || ''
    const next = tabsRef.current.map(t => (t.id === tabId ? { ...t, projectFolder: path } : t))
    tabsRef.current = next
    setTabs(next)

    // Si había ediciones en catálogo efímero (sin carpeta), volcarlas al nuevo cwd.
    if (!previousCwd) {
      const agentIds = new Set(
        Object.values(tab?.agentByPane ?? {}).map(binding => binding.agentId),
      )
      const ephemeral = projectAgentsByCwdRef.current[''] ?? []
      for (const definition of ephemeral) {
        if (!agentIds.has(definition.id)) continue
        const written = await window.api.upsertProjectAgent(path, definition)
        if (written.ok) rememberProjectAgent(path, written.agent)
      }
    }

    // Guardado inmediato con tabsRef ya actualizado (no esperar al render).
    await saveSessionNow()
    void refreshAndSyncProjectAgents(path, tabId)
    return path
  }, [refreshAndSyncProjectAgents, rememberProjectAgent, saveSessionNow, t])

  const handleCreateTerminal = useCallback((tabId: string) => {
    const tab = tabsRef.current.find(t => t.id === tabId)
    if (!tab || tab.paneIds.length >= MAX_PANES_PER_TAB) return
    const cwd = tab.projectFolder?.trim() || ''
    if (!cwd) return
    const newPaneId = crypto.randomUUID()
    rememberPaneCwd(newPaneId, cwd)
    setTabs(prev => prev.map(t => {
      if (t.id !== tabId || t.paneIds.length >= MAX_PANES_PER_TAB) return t
      const paneWindows = { ...(t.paneWindows ?? {}) }
      minimizeOtherPaneWindows(t.paneIds, paneWindows, newPaneId)
      paneWindows[newPaneId] = createPaneWindowState(paneWindows, true)
      return normalizeTabSession({
        ...t,
        projectFolder: cwd,
        paneIds: [...t.paneIds, newPaneId],
        activePaneId: newPaneId,
        paneWindows,
      })
    }))
    scheduleSaveSession()
  }, [rememberPaneCwd, scheduleSaveSession])

  const handleAddAgentPane = useCallback(async (
    tabId: string,
    fromPaneId: string | undefined,
    provider: AgentCliProvider,
  ) => {
    const current = tabsRef.current.find(tab => tab.id === tabId)
    if (!current || current.paneIds.length >= MAX_PANES_PER_TAB) return
    const cwd = current.projectFolder?.trim() || ''
    if (!cwd) return
    const existing = new Set(
      (projectAgentsByCwdRef.current[cwd] ?? []).map(agent => agent.id),
    )
    const agentId = allocateAgentSlug(provider === 'cursor' ? 'cursor' : 'claude', existing)
    const definition: ProjectAgentDefinition = {
      id: agentId,
      provider,
      permissionMode: 'auto',
      autoImproveContexts: true,
    }
    const written = await window.api.upsertProjectAgent(cwd, definition)
    if (!written.ok) return
    rememberProjectAgent(cwd, written.agent)
    const paneId = crypto.randomUUID()
    rememberPaneCwd(paneId, cwd)
    setTabs(prev => prev.map(tab => {
      if (tab.id !== tabId || tab.paneIds.length >= MAX_PANES_PER_TAB) return tab
      const paneWindows = { ...(tab.paneWindows ?? {}) }
      /* Mini en el plano: el chat centrado es el home; ventana al expandir. */
      paneWindows[paneId] = createPaneWindowState(paneWindows, false)
      const paneKinds: Record<string, PaneKind> = { ...(tab.paneKinds ?? {}), [paneId]: 'agent' }
      return normalizeTabSession({
        ...tab,
        paneIds: [...tab.paneIds, paneId],
        activePaneId: paneId,
        paneKinds,
        paneWindows,
        agentByPane: {
          ...(tab.agentByPane ?? {}),
          [paneId]: { agentId: written.agent.id },
        },
      })
    }))
    scheduleSaveSession()
  }, [rememberPaneCwd, rememberProjectAgent, scheduleSaveSession])

  /** Nuevo agente con la misma configuración (sin historial / sesión CLI). */
  const handleDuplicateAgentPane = useCallback(async (
    tabId: string,
    sourcePaneId: string,
  ) => {
    const current = tabsRef.current.find(tab => tab.id === tabId)
    if (!current || current.paneIds.length >= MAX_PANES_PER_TAB) return
    if (current.paneKinds?.[sourcePaneId] !== 'agent') return
    const cwd = current.projectFolder?.trim() || ''
    if (!cwd) return
    const sourceMeta = resolveTabAgentMeta(current, sourcePaneId, projectAgentsByCwdRef.current)
    const existing = new Set(
      (projectAgentsByCwdRef.current[cwd] ?? []).map(agent => agent.id),
    )
    const clonedFields = cloneProjectAgentDefinition(
      sourceMeta,
      i18next.t('agentPane.duplicateNameSuffix'),
    )
    const agentId = allocateAgentSlug(clonedFields.name ?? sourceMeta.id, existing)
    const written = await window.api.upsertProjectAgent(cwd, { ...clonedFields, id: agentId })
    if (!written.ok) return
    rememberProjectAgent(cwd, written.agent)
    const paneId = crypto.randomUUID()
    rememberPaneCwd(paneId, cwd)
    setTabs(prev => prev.map(tab => {
      if (tab.id !== tabId || tab.paneIds.length >= MAX_PANES_PER_TAB) return tab
      const paneWindows = { ...(tab.paneWindows ?? {}) }
      paneWindows[paneId] = createPaneWindowState(paneWindows, false)
      const paneKinds: Record<string, PaneKind> = { ...(tab.paneKinds ?? {}), [paneId]: 'agent' }
      return normalizeTabSession({
        ...tab,
        paneIds: [...tab.paneIds, paneId],
        activePaneId: paneId,
        paneKinds,
        paneWindows,
        agentByPane: {
          ...(tab.agentByPane ?? {}),
          [paneId]: { agentId: written.agent.id },
        },
      })
    }))
    scheduleSaveSession()
    armSuppressPaneExpand()
    lockMiniExpandForConfig()
    setOpenConfigForPaneId(paneId)
  }, [
    armSuppressPaneExpand,
    lockMiniExpandForConfig,
    rememberPaneCwd,
    rememberProjectAgent,
    scheduleSaveSession,
  ])

  /** Abre el picker de proveedor solo si la pestaña ya tiene carpeta de proyecto. */
  const requestAddAgent = useCallback((
    tabId: string,
    fromPaneId?: string,
  ): void => {
    const tab = tabsRef.current.find(item => item.id === tabId)
    if (!tab || tab.paneIds.length >= MAX_PANES_PER_TAB) return
    if (!tab.projectFolder?.trim()) return
    setAgentPicker({ tabId, fromPaneId })
  }, [])

  const handleOpenPaneWindow = useCallback((tabId: string, paneId: string) => {
    setTabs(prev => {
      const nextTabs = prev.map(tab => {
        if (tab.id !== tabId || !tab.paneIds.includes(paneId)) return tab
        const ensured = ensureTabPaneLayout(tab)
        const paneWindows = { ...(ensured.paneWindows ?? {}) }
        const prevWin = paneWindows[paneId] ?? createPaneWindowState(paneWindows, false)
        // Solo una ventana abierta: el resto vuelve a mini.
        minimizeOtherPaneWindows(tab.paneIds, paneWindows, paneId)
        paneWindows[paneId] = {
          ...prevWin,
          open: true,
          fullscreen: false,
          zIndex: maxPaneWindowZ(paneWindows) + 1,
        }
        return { ...ensured, activePaneId: paneId, paneWindows }
      })
      tabsRef.current = nextTabs
      return nextTabs
    })
    scheduleSaveSession()
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const tab = tabsRef.current.find(item => item.id === tabId)
        for (const id of tab?.paneIds ?? []) {
          termRefs.current.get(id)?.refit?.()
        }
        // Foco en la terminal recién expandida (tras layout/morph).
        termRefs.current.get(paneId)?.focus?.()
      })
    })
  }, [scheduleSaveSession])

  const openPaneWindowUnlessSuppressed = useCallback((tabId: string, paneId: string) => {
    if (isMiniExpandSuppressed()) return
    if (Date.now() < suppressPaneExpandUntilRef.current) return
    handleOpenPaneWindow(tabId, paneId)
  }, [handleOpenPaneWindow])

  const handleClosePaneWindow = useCallback((tabId: string, paneId: string) => {
    setTabs(prev => {
      const nextTabs = prev.map(tab => {
        if (tab.id !== tabId || !tab.paneIds.includes(paneId)) return tab
        const ensured = ensureTabPaneLayout(tab)
        const paneWindows = { ...(ensured.paneWindows ?? {}) }
        const win = paneWindows[paneId] ?? createPaneWindowState(paneWindows, false)
        paneWindows[paneId] = { ...win, open: false, fullscreen: false }
        return { ...ensured, paneWindows }
      })
      tabsRef.current = nextTabs
      return nextTabs
    })
    void saveSessionNow()
    requestAnimationFrame(() => {
      termRefs.current.get(paneId)?.refit?.()
    })
  }, [saveSessionNow])

  const handleMinimizeAllPaneWindows = useCallback((tabId: string) => {
    setTabs(prev => {
      const nextTabs = prev.map(item => {
        if (item.id !== tabId || item.paneIds.length === 0) return item
        const ensured = ensureTabPaneLayout(item)
        const paneWindows = { ...(ensured.paneWindows ?? {}) }
        for (const id of item.paneIds) {
          const win = paneWindows[id] ?? createPaneWindowState(paneWindows, false)
          paneWindows[id] = { ...win, open: false, fullscreen: false }
        }
        return { ...ensured, paneWindows }
      })
      tabsRef.current = nextTabs
      return nextTabs
    })
    void saveSessionNow()
    requestAnimationFrame(() => {
      const tab = tabsRef.current.find(item => item.id === tabId)
      for (const paneId of tab?.paneIds ?? []) {
        termRefs.current.get(paneId)?.refit?.()
      }
    })
  }, [saveSessionNow])

  const handleTogglePaneFullscreen = useCallback((tabId: string, paneId: string) => {
    setTabs(prev => {
      const nextTabs = prev.map(tab => {
        if (tab.id !== tabId || !tab.paneIds.includes(paneId)) return tab
        const ensured = ensureTabPaneLayout(tab)
        const paneWindows = { ...(ensured.paneWindows ?? {}) }
        const win = paneWindows[paneId] ?? createPaneWindowState(paneWindows, false)
        const nextFullscreen = !win.fullscreen
        if (nextFullscreen) {
          minimizeOtherPaneWindows(tab.paneIds, paneWindows, paneId)
        }
        paneWindows[paneId] = {
          ...win,
          open: true,
          fullscreen: nextFullscreen,
          zIndex: maxPaneWindowZ(paneWindows) + 1,
        }
        return { ...ensured, activePaneId: paneId, paneWindows }
      })
      tabsRef.current = nextTabs
      return nextTabs
    })
    void saveSessionNow()
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const tab = tabsRef.current.find(item => item.id === tabId)
        for (const id of tab?.paneIds ?? []) {
          termRefs.current.get(id)?.refit?.()
        }
      })
    })
  }, [saveSessionNow])

  const handleFocusPaneWindow = useCallback((tabId: string, paneId: string) => {
    setActiveTabId(tabId)
    setTabs(prev => {
      const nextTabs = prev.map(tab => {
        if (tab.id !== tabId || !tab.paneIds.includes(paneId)) return tab
        const ensured = ensureTabPaneLayout(tab)
        const paneWindows = { ...(ensured.paneWindows ?? {}) }
        const win = paneWindows[paneId]
        if (win?.open) {
          paneWindows[paneId] = { ...win, zIndex: maxPaneWindowZ(paneWindows) + 1 }
        }
        return { ...ensured, activePaneId: paneId, paneWindows }
      })
      tabsRef.current = nextTabs
      return nextTabs
    })
  }, [])

  /** Abre/cambia el chat del plano, o lo cierra si `paneId` es null. */
  const handlePlaneOpenChatAgent = useCallback((tabId: string, paneId: string | null) => {
    setTabs(prev => {
      const nextTabs = prev.map(tab => {
        if (tab.id !== tabId) return tab
        if (paneId === null) {
          return { ...tab, planeOpenChatAgentId: null }
        }
        if (tab.paneKinds?.[paneId] !== 'agent') return tab
        return { ...tab, planeOpenChatAgentId: paneId }
      })
      tabsRef.current = nextTabs
      return nextTabs
    })
  }, [])

  const handleAssignContextToAgent = useCallback((
    tabId: string,
    toPaneId: string,
    contextId: string,
  ) => {
    handleAgentMetaChangeRef.current(tabId, toPaneId, previous => {
      const nextIds = [...new Set([...(previous.contextIds ?? []), contextId])]
      return { ...previous, contextIds: nextIds }
    })
  }, [])

  const handleToggleAgentContext = useCallback((
    tabId: string,
    paneId: string,
    contextId: string,
  ) => {
    handleAgentMetaChangeRef.current(tabId, paneId, previous => {
      const selected = new Set(previous.contextIds ?? [])
      if (selected.has(contextId)) selected.delete(contextId)
      else selected.add(contextId)
      return { ...previous, contextIds: [...selected] }
    })
  }, [])

  const handleAgentAutoImproveChange = useCallback((
    tabId: string,
    paneId: string,
    enabled: boolean,
  ) => {
    handleAgentMetaChangeRef.current(tabId, paneId, previous => {
      if (enabled) return { ...previous, autoImproveContexts: true }
      const { autoImproveContexts: _dropped, ...rest } = previous
      return rest
    })
  }, [])

  const handleOpenConfigFromPlane = useCallback((tabId: string, paneId: string) => {
    // Solo modal de config (portal); no expandir la ventana del agente.
    armSuppressPaneExpand()
    lockMiniExpandForConfig()
    setActiveTabId(tabId)
    setTabs(prev => prev.map(tab => (
      tab.id === tabId && tab.paneIds.includes(paneId)
        ? { ...tab, activePaneId: paneId }
        : tab
    )))
    setOpenConfigForPaneId(paneId)
  }, [armSuppressPaneExpand, lockMiniExpandForConfig])

  const refreshTabContexts = useCallback(async (tabId: string): Promise<void> => {
    const tab = tabsRef.current.find(item => item.id === tabId)
    if (!tab) return
    const cwd = tab.projectFolder?.trim() || ''
    if (!cwd) return
    const result = await window.api.discoverTabContexts({ cwd })
    if (!result.ok) return
    setTabContextsByTab(prev => ({ ...prev, [tabId]: result.contexts }))
  }, [])

  const handleConfigureContextsFromPlane = useCallback((tabId: string) => {
    setPlaneContextsModalTabId(tabId)
  }, [])

  const handleAgentPlaneStatusChange = useCallback((paneId: string, status: AgentPlaneStatus) => {
    setAgentPlaneStatus(prev => {
      const previous = prev[paneId]
      if (
        previous
        && previous.busy === status.busy
        && previous.activity === status.activity
        && previous.lastSnippet === status.lastSnippet
        && previous.activeAssistantId === status.activeAssistantId
        && previous.loopMode === status.loopMode
        && previous.loopActive === status.loopActive
        && previous.localLoopActive === status.localLoopActive
        && previous.turnCloseReason === status.turnCloseReason
        && previous.loopEndReason === status.loopEndReason
        && (previous.queuedTurns?.length ?? 0) === status.queuedTurns.length
        && (previous.queuedTurns ?? []).every((item, i) =>
          item.id === status.queuedTurns[i]?.id
          && item.text === status.queuedTurns[i]?.text
          && item.images.length === status.queuedTurns[i]?.images.length,
        )
        && previous.messages.length === status.messages.length
        && previous.messages.every((msg, i) =>
          msg.id === status.messages[i]?.id
          && msg.role === status.messages[i]?.role
          && msg.content === status.messages[i]?.content,
        )
        && previous.contexts.length === status.contexts.length
        && previous.contexts.every((ctx, i) =>
          ctx.id === status.contexts[i]?.id
          && ctx.name === status.contexts[i]?.name
          && ctx.kind === status.contexts[i]?.kind,
        )
      ) {
        return prev
      }
      return { ...prev, [paneId]: status }
    })
  }, [])

  const handlePlaneLoopToggleReady = useCallback((paneId: string, toggle: (() => void) | null) => {
    if (toggle) planeLoopToggleByPaneRef.current.set(paneId, toggle)
    else planeLoopToggleByPaneRef.current.delete(paneId)
  }, [])

  const handlePlaneToggleLoop = useCallback((paneId: string) => {
    planeLoopToggleByPaneRef.current.get(paneId)?.()
  }, [])

  const yieldChainOfferForUserSend = useCallback((paneId: string) => {
    const offer = chainOfferByPaneRef.current.get(paneId)
    if (!offer) return
    chainOfferByPaneRef.current.delete(paneId)
    chainTurnWaitRef.current.delete(offer.chainId)
    const rest = chainFifoByPaneRef.current.get(paneId) ?? []
    chainFifoByPaneRef.current.set(paneId, [offer, ...rest.filter(item => item.id !== offer.id)])
    setLoopFifoTick(n => n + 1)
  }, [])

  const handleLoopChainsChange = useCallback((tabId: string, chains: PlaneLoopChain[]) => {
    setTabs(prev => {
      const nextTabs = prev.map(tab => {
        if (tab.id !== tabId) return tab
        return {
          ...tab,
          ...(chains.length ? { planeLoopChains: chains } : { planeLoopChains: undefined }),
        }
      })
      tabsRef.current = nextTabs
      return nextTabs
    })
    void saveSessionNow()
  }, [saveSessionNow])

  const patchLoopChain = useCallback((
    tabId: string,
    chainId: string,
    updater: (chain: PlaneLoopChain) => PlaneLoopChain,
  ): PlaneLoopChain | null => {
    let updated: PlaneLoopChain | null = null
    setTabs(prev => {
      const nextTabs = prev.map(tab => {
        if (tab.id !== tabId) return tab
        const chains = tab.planeLoopChains ?? []
        const nextChains = chains.map(chain => {
          if (chain.id !== chainId) return chain
          updated = updater(chain)
          return updated
        })
        return {
          ...tab,
          ...(nextChains.length
            ? { planeLoopChains: nextChains }
            : { planeLoopChains: undefined }),
        }
      })
      tabsRef.current = nextTabs
      return nextTabs
    })
    void saveSessionNow()
    return updated
  }, [saveSessionNow])

  const clearChainWaitTimer = useCallback((chainId: string) => {
    const timer = chainWaitTimersRef.current.get(chainId)
    if (timer) {
      clearTimeout(timer)
      chainWaitTimersRef.current.delete(chainId)
    }
  }, [])

  const enqueueChainAction = useCallback((
    tabId: string,
    chainId: string,
    action: LoopOrchestratorAction,
  ) => {
    if (action.type === 'noop') return
    if (action.type === 'send_step') {
      const item = createLoopChainFifoItem({
        tabId,
        chainId,
        stepIndex: action.stepIndex,
        paneId: action.paneId,
        text: action.objective,
      })
      const queue = chainFifoByPaneRef.current.get(action.paneId) ?? []
      chainFifoByPaneRef.current.set(
        action.paneId,
        enqueueLoopChainFifo(queue, item),
      )
      setLoopFifoTick(n => n + 1)
      return
    }
    if (action.type === 'start_wait') {
      clearChainWaitTimer(chainId)
      const timer = setTimeout(() => {
        chainWaitTimersRef.current.delete(chainId)
        const tab = tabsRef.current.find(item => item.id === tabId)
        const chain = tab?.planeLoopChains?.find(item => item.id === chainId)
        if (!chain || chain.status !== 'waiting') return
        const resumed = resumeLoopChainAfterWait(chain)
        patchLoopChain(tabId, chainId, () => resumed.chain)
        enqueueChainAction(tabId, chainId, resumed.action)
      }, action.intervalMs)
      chainWaitTimersRef.current.set(chainId, timer)
    }
  }, [clearChainWaitTimer, patchLoopChain])

  const handleStartLoopChain = useCallback((tabId: string, chainId: string) => {
    const tab = tabsRef.current.find(item => item.id === tabId)
    if (!tab?.projectFolder?.trim()) return
    const chain = tab.planeLoopChains?.find(item => item.id === chainId)
    if (!chain) return
    const started = startLoopChain(chain)
    if (started.action.type === 'noop') return
    patchLoopChain(tabId, chainId, () => started.chain)
    enqueueChainAction(tabId, chainId, started.action)
  }, [enqueueChainAction, patchLoopChain])

  const handleStopLoopChain = useCallback((tabId: string, chainId: string) => {
    clearChainWaitTimer(chainId)
    removeLoopChainFromFifo(chainFifoByPaneRef.current, chainId)
    chainTurnWaitRef.current.delete(chainId)
    for (const [paneId, offer] of [...chainOfferByPaneRef.current.entries()]) {
      if (offer.chainId !== chainId) continue
      chainOfferByPaneRef.current.delete(paneId)
      setPlaneSendByPane(prev => {
        if (!(paneId in prev)) return prev
        const next = { ...prev }
        delete next[paneId]
        return next
      })
    }
    patchLoopChain(tabId, chainId, chain => stopLoopChain(chain))
    setLoopFifoTick(n => n + 1)
  }, [clearChainWaitTimer, patchLoopChain])

  const stopChainsForPane = useCallback((tabId: string, paneId: string) => {
    const tab = tabsRef.current.find(item => item.id === tabId)
    for (const chain of tab?.planeLoopChains ?? []) {
      if (
        (chain.status === 'running' || chain.status === 'waiting')
        && chainHasPane(chain, paneId)
      ) {
        handleStopLoopChain(tabId, chain.id)
      }
    }
  }, [handleStopLoopChain])

  // Drena FIFO por agente: ofrece preferSend solo si el pane está idle.
  useEffect(() => {
    const queues = chainFifoByPaneRef.current
    for (const paneId of [...queues.keys()]) {
      if (chainOfferByPaneRef.current.has(paneId)) continue
      if (planeSendByPane[paneId]) continue
      const status = agentPlaneStatus[paneId]
      if (status?.busy || status?.localLoopActive) continue
      const peek = queues.get(paneId)?.[0]
      if (!peek) continue
      const tab = tabsRef.current.find(item => item.id === peek.tabId)
      const chain = tab?.planeLoopChains?.find(item => item.id === peek.chainId)
      if (!chain) {
        // Ítem huérfano: sí descartar.
        dequeueLoopChainFifoHead(queues, paneId)
        continue
      }
      // No descartar si aún no está running (p. ej. estado stale); stop limpia la cola.
      if (chain.status !== 'running') continue
      const head = dequeueLoopChainFifoHead(queues, paneId)
      if (!head) continue
      chainOfferByPaneRef.current.set(paneId, head)
      chainTurnWaitRef.current.set(head.chainId, {
        tabId: head.tabId,
        chainId: head.chainId,
        paneId: head.paneId,
        stepIndex: head.stepIndex,
        phase: 'awaiting_busy',
      })
      setPlaneSendByPane(prev => {
        if (prev[paneId]) {
          // Otro offer ganó la carrera: devolver el head a la FIFO.
          const q = queues.get(paneId) ?? []
          q.unshift(head)
          queues.set(paneId, q)
          chainOfferByPaneRef.current.delete(paneId)
          chainTurnWaitRef.current.delete(head.chainId)
          return prev
        }
        return {
          ...prev,
          [paneId]: {
            text: head.text,
            images: [],
            focusPane: false,
          },
        }
      })
    }
  }, [agentPlaneStatus, loopFifoTick, planeSendByPane])

  // Avanza la cadena solo si el turno cerró con éxito (no stop/fallo).
  useEffect(() => {
    const prev = prevBusyByPaneRef.current
    const nextPrev = { ...prev }
    for (const [paneId, status] of Object.entries(agentPlaneStatus)) {
      const wasBusy = Boolean(prev[paneId])
      const isBusy = Boolean(status.busy)
      nextPrev[paneId] = isBusy

      const wait = [...chainTurnWaitRef.current.values()].find(item => item.paneId === paneId)
      if (!wait) continue

      if (!wasBusy && isBusy && wait.phase === 'awaiting_busy') {
        chainTurnWaitRef.current.set(wait.chainId, { ...wait, phase: 'in_flight' })
        continue
      }
      if (wasBusy && !isBusy && wait.phase === 'in_flight') {
        chainTurnWaitRef.current.delete(wait.chainId)
        chainOfferByPaneRef.current.delete(wait.paneId)
        setLoopFifoTick(n => n + 1)
        if (status.turnCloseReason !== 'completed') {
          handleStopLoopChain(wait.tabId, wait.chainId)
          continue
        }
        const tab = tabsRef.current.find(item => item.id === wait.tabId)
        const chain = tab?.planeLoopChains?.find(item => item.id === wait.chainId)
        if (!chain || chain.status !== 'running') continue
        const advanced = advanceLoopChainAfterStep(chain)
        patchLoopChain(wait.tabId, wait.chainId, () => advanced.chain)
        enqueueChainAction(wait.tabId, wait.chainId, advanced.action)
      }
    }
    prevBusyByPaneRef.current = nextPrev
  }, [agentPlaneStatus, enqueueChainAction, handleStopLoopChain, patchLoopChain])

  const handlePlaneQueueControlsReady = useCallback((
    paneId: string,
    controls: AgentPlaneQueueControls | null,
  ) => {
    if (controls) planeQueueControlsByPaneRef.current.set(paneId, controls)
    else planeQueueControlsByPaneRef.current.delete(paneId)
  }, [])

  const enqueueOrchestrationSend = useCallback((
    paneId: string,
    payload: {
      text: string
      images?: AgentCliImageAttachment[]
      focusPane?: boolean
      orchestrationFollowUp?: boolean
      allowDelegations?: boolean
      delegation?: {
        id: string
        fromPaneId: string
        toAgentId: string
      }
    },
  ) => {
    const queue = orchestrationFifoByPaneRef.current.get(paneId) ?? []
    queue.push({
      text: payload.text,
      images: payload.images ?? [],
      focusPane: payload.focusPane,
      ...(payload.orchestrationFollowUp ? { orchestrationFollowUp: true } : {}),
      ...(payload.allowDelegations === false ? { allowDelegations: false } : {}),
      ...(payload.delegation ? { delegation: payload.delegation } : {}),
    })
    orchestrationFifoByPaneRef.current.set(paneId, queue)
    setOrchestrationFifoTick(n => n + 1)
  }, [])

  const resetOrchestrationRun = useCallback((paneId: string) => {
    orchestrationRoundsByPaneRef.current.delete(paneId)
  }, [])

  const orchestrationMaxRoundsForPane = useCallback((paneId: string, tabId?: string): number => {
    const tab = tabId
      ? tabsRef.current.find(item => item.id === tabId)
      : tabsRef.current.find(item => (item.paneIds ?? []).includes(paneId))
    if (!tab || tab.paneKinds?.[paneId] !== 'agent') {
      return resolveOrchestrationMaxRounds(undefined)
    }
    const meta = resolveTabAgentMeta(tab, paneId, projectAgentsByCwdRef.current)
    return resolveOrchestrationMaxRounds(meta.orchestrationMaxRounds)
  }, [])

  const handleOrchestratorDelegations = useCallback((
    fromPaneId: string,
    tabId: string,
    delegations: DelegateRequest[],
  ) => {
    if (!delegations.length) return
    const maxRounds = orchestrationMaxRoundsForPane(fromPaneId, tabId)
    const previousRounds = orchestrationRoundsByPaneRef.current.get(fromPaneId) ?? 0
    const nextRound = previousRounds + 1
    orchestrationRoundsByPaneRef.current.set(fromPaneId, nextRound)
    if (nextRound > maxRounds) {
      enqueueOrchestrationSend(fromPaneId, {
        text: formatDelegationRoundCapFollowUp(maxRounds),
        focusPane: false,
        orchestrationFollowUp: true,
        allowDelegations: false,
      })
      return
    }

    const tab = tabsRef.current.find(item => item.id === tabId)
    if (!tab) return
    const panes = (tab.paneIds ?? [])
      .filter(id => tab.paneKinds?.[id] === 'agent')
      .map(paneId => ({
        paneId,
        meta: resolveTabAgentMeta(tab, paneId, projectAgentsByCwdRef.current),
      }))
    const targets = listOrchestrationTargets(panes, fromPaneId)
    const pending = pendingDelegationsByOrchestratorRef.current.get(fromPaneId)
      ?? new Map<string, string>()
    for (const delegation of delegations) {
      const toPaneId = resolveDelegationTargetPaneId(targets, delegation)
      if (!toPaneId) {
        enqueueOrchestrationSend(fromPaneId, {
          text: formatDelegationResultFollowUp({
            id: delegation.id,
            status: 'fail',
            summary: `No agent found for agentId "${delegation.toAgentId}".`,
            toAgentId: delegation.toAgentId,
          }, {
            round: nextRound,
            maxRounds,
            batchRemaining: 0,
          }),
          focusPane: false,
          orchestrationFollowUp: true,
          allowDelegations: nextRound < maxRounds,
        })
        continue
      }
      pending.set(delegation.id, toPaneId)
      const contextHint = delegation.contextIds?.length
        ? `\n\nPreferred context ids: ${delegation.contextIds.join(', ')}`
        : ''
      enqueueOrchestrationSend(toPaneId, {
        text: `${delegation.objective}${contextHint}`,
        focusPane: false,
        delegation: {
          id: delegation.id,
          fromPaneId,
          toAgentId: delegation.toAgentId,
        },
      })
    }
    pendingDelegationsByOrchestratorRef.current.set(fromPaneId, pending)
  }, [enqueueOrchestrationSend, orchestrationMaxRoundsForPane])

  const handleDelegationTurnComplete = useCallback((result: DelegateResult) => {
    const fromPaneId = [...pendingDelegationsByOrchestratorRef.current.entries()]
      .find(([, map]) => map.has(result.id))?.[0]
    if (!fromPaneId) return
    const pending = pendingDelegationsByOrchestratorRef.current.get(fromPaneId)
    pending?.delete(result.id)
    const remaining = pending?.size ?? 0
    if (pending && remaining === 0) {
      pendingDelegationsByOrchestratorRef.current.delete(fromPaneId)
    }
    const round = orchestrationRoundsByPaneRef.current.get(fromPaneId) ?? 1
    const maxRounds = orchestrationMaxRoundsForPane(fromPaneId)
    const atCap = round >= maxRounds
    enqueueOrchestrationSend(fromPaneId, {
      text: formatDelegationResultFollowUp(result, {
        round,
        maxRounds,
        batchRemaining: remaining,
      }),
      focusPane: false,
      orchestrationFollowUp: true,
      allowDelegations: !atCap,
    })
  }, [enqueueOrchestrationSend, orchestrationMaxRoundsForPane])

  const requestPlaneStop = useCallback((paneId: string) => {
    setPlaneStopPaneIds(previous => {
      if (previous.has(paneId)) return previous
      const next = new Set(previous)
      next.add(paneId)
      return next
    })
  }, [])

  const handleOrchestratorStop = useCallback((fromPaneId: string) => {
    const pending = pendingDelegationsByOrchestratorRef.current.get(fromPaneId)
    const runningTargets = pending ? [...new Set(pending.values())] : []
    pendingDelegationsByOrchestratorRef.current.delete(fromPaneId)
    orchestrationRoundsByPaneRef.current.delete(fromPaneId)
    // No reinyectar follow-ups ni subtareas pendientes de este orquestador.
    orchestrationFifoByPaneRef.current.delete(fromPaneId)
    for (const [paneId, queue] of [...orchestrationFifoByPaneRef.current.entries()]) {
      const next = queue.filter(item => item.delegation?.fromPaneId !== fromPaneId)
      if (next.length) orchestrationFifoByPaneRef.current.set(paneId, next)
      else orchestrationFifoByPaneRef.current.delete(paneId)
    }
    for (const controls of planeQueueControlsByPaneRef.current.values()) {
      controls.cancelDelegationsFrom(fromPaneId)
    }
    for (const paneId of runningTargets) {
      requestPlaneStop(paneId)
    }
    setOrchestrationFifoTick(n => n + 1)
  }, [requestPlaneStop])

  // Drena FIFO de orquestación: ofrece preferSend si el pane está idle.
  useEffect(() => {
    const queues = orchestrationFifoByPaneRef.current
    for (const paneId of [...queues.keys()]) {
      if (planeSendByPane[paneId]) continue
      if (chainOfferByPaneRef.current.has(paneId)) continue
      const status = agentPlaneStatus[paneId]
      if (status?.busy || status?.localLoopActive) continue
      const queue = queues.get(paneId)
      if (!queue?.length) {
        queues.delete(paneId)
        continue
      }
      setPlaneSendByPane(prev => {
        if (prev[paneId]) return prev
        const head = queue.shift()
        if (!head) {
          if (!queue.length) queues.delete(paneId)
          return prev
        }
        if (!queue.length) queues.delete(paneId)
        return { ...prev, [paneId]: head }
      })
    }
  }, [agentPlaneStatus, orchestrationFifoTick, planeSendByPane])

  const handlePlaneRemoveQueuedTurn = useCallback((paneId: string, id: string) => {
    planeQueueControlsByPaneRef.current.get(paneId)?.remove(id)
  }, [])

  const handlePlaneUpdateQueuedTurn = useCallback((paneId: string, id: string, text: string) => {
    planeQueueControlsByPaneRef.current.get(paneId)?.update(id, text)
  }, [])

  const handleAgentMetaChange = useCallback(async (
    tabId: string,
    paneId: string,
    meta: AgentPaneMeta | ((previous: AgentPaneMeta) => AgentPaneMeta),
  ): Promise<boolean> => {
    const tab = tabsRef.current.find(item => item.id === tabId)
    if (!tab || tab.paneKinds?.[paneId] !== 'agent') return false
    const cwd = tab.projectFolder?.trim() || ''
    const previous = resolveTabAgentMeta(tab, paneId, projectAgentsByCwdRef.current)
    const next = typeof meta === 'function' ? meta(previous) : meta
    const agentId = previous.id
    const binding = agentBindingFromMeta({ ...next, id: agentId })
    const previousDefinition = agentDefinitionFromMeta({ ...previous, id: agentId })
    const definition = agentDefinitionFromMeta({ ...next, id: agentId })

    setTabs(prev => {
      const nextTabs = prev.map(item => {
        if (item.id !== tabId) return item
        return {
          ...item,
          agentByPane: {
            ...(item.agentByPane ?? {}),
            [paneId]: binding,
          },
        }
      })
      tabsRef.current = nextTabs
      return nextTabs
    })
    // Optimista: la UI lee definición desde el catálogo; sin esto los controles vuelven atrás.
    rememberProjectAgent(cwd, definition)
    void saveSessionNow()

    // Sin carpeta de proyecto: solo sesión local (optimistic); no hay upsert a disco.
    if (!cwd) return true

    const result = await window.api.upsertProjectAgent(cwd, definition)
    if (!result.ok) {
      rememberProjectAgent(cwd, previousDefinition)
      setTabs(prev => {
        const previousBinding = agentBindingFromMeta({ ...previous, id: agentId })
        const nextTabs = prev.map(item => {
          if (item.id !== tabId) return item
          return {
            ...item,
            agentByPane: {
              ...(item.agentByPane ?? {}),
              [paneId]: previousBinding,
            },
          }
        })
        tabsRef.current = nextTabs
        return nextTabs
      })
      void saveSessionNow()
      return false
    }
    rememberProjectAgent(cwd, result.agent)
    return true
  }, [rememberProjectAgent, saveSessionNow])
  handleAgentMetaChangeRef.current = handleAgentMetaChange

  const tabBarRef = useRef<TabBarHandle>(null)
  const handleClosePaneRef = useRef(handleClosePane)
  handleClosePaneRef.current = handleClosePane
  const handleCreateTerminalRef = useRef(handleCreateTerminal)
  handleCreateTerminalRef.current = handleCreateTerminal
  const requestAddAgentRef = useRef(requestAddAgent)
  requestAddAgentRef.current = requestAddAgent

  // ⌘W: hay paneles → destruir el activo (confirm); plano vacío + varias pestañas → cerrar pestaña; si no → cerrar ventana
  useEffect(() => {
    return window.api.onShortcutCloseTab(() => {
      const tabList = tabsRef.current
      const aid = activeTabIdRef.current
      const tab = tabList.find(t => t.id === aid)
      if (!tab) return
      if (tab.paneIds.length >= 1 && tab.activePaneId) {
        const openConfirm = paneShortcutCloseInterceptors.current.get(tab.activePaneId)
        if (openConfirm) {
          openConfirm()
          return
        }
        handleClosePaneRef.current(tab.id, tab.activePaneId)
        return
      }
      if (tabList.length > 1) {
        tabBarRef.current?.requestCloseTab(aid)
        return
      }
      window.close()
    })
  }, [])

  const handleTabTitleChange = useCallback((id: string, title: string) => {
    setTabs(prev => prev.map(t => {
      if (t.id !== id) return t
      if (t.titleLocked) return t
      return { ...t, title }
    }))
  }, [])

  const handleRenameTab = useCallback((id: string, name: string) => {
    setTabs(prev => prev.map(t => (t.id === id ? { ...t, title: name, titleLocked: true } : t)))
  }, [])

  const handleReorderTabs = useCallback((
    dragId: string,
    dropId: string,
    place: 'before' | 'after',
  ) => {
    setTabs(prev => {
      const fromIdx = prev.findIndex(t => t.id === dragId)
      const dropIdx = prev.findIndex(t => t.id === dropId)
      if (fromIdx < 0 || dropIdx < 0) return prev
      const insertAt = computeTabInsertIndex(prev.length, fromIdx, dropIdx, place)
      return moveItemToIndex(prev, fromIdx, insertAt)
    })
  }, [])

  const handleReorderPanes = useCallback((
    tabId: string,
    kind: PaneReorderKind,
    orderedPaneIds: string[],
  ) => {
    setTabs(prev => {
      const nextTabs = prev.map(tab => {
        if (tab.id !== tabId) return tab
        const paneIds = reorderPaneIdsByKind(tab.paneIds, tab.paneKinds, kind, orderedPaneIds)
        if (paneIds.every((id, index) => id === tab.paneIds[index])) return tab
        return { ...tab, paneIds }
      })
      tabsRef.current = nextTabs
      return nextTabs
    })
    void saveSessionNow()
  }, [saveSessionNow])

  const handleThemeChange = useCallback((themeId: string) => {
    const updated = { ...config, themeId }
    setConfig(updated)
    window.api.setConfig({ themeId })
  }, [config])

  const handleConfigSaved = useCallback((cfg: AppConfig) => {
    setConfig(cfg)
  }, [])

  /** Devuelve foco al xterm de la pestaña activa (p. ej. tras modales o botones con tabIndex -1). */
  const focusActiveTerminalTextarea = useCallback((): void => {
    queueMicrotask(() => {
      document
        .querySelector<HTMLTextAreaElement>(
          '.tab-terminal-group--active .xterm-helper-textarea',
        )
        ?.focus()
    })
  }, [])

  const patchConfig = useCallback(async (partial: Partial<AppConfig>) => {
    const r = await window.api.setConfig(partial)
    if (r.ok) {
      const cfg = await window.api.getConfig()
      setConfig(cfg)
    }
  }, [])

  const MIN_FONT = 9
  const MAX_FONT = 24

  const changeFontSize = useCallback((delta: number) => {
    setConfig(prev => {
      const next = Math.min(MAX_FONT, Math.max(MIN_FONT, (prev.fontSize ?? 13) + delta))
      if (next === prev.fontSize) return prev
      window.api.setConfig({ fontSize: next })
      return { ...prev, fontSize: next }
    })
  }, [])

  // Atajos de teclado globales (captura en fase de bajada para que funcionen con foco en xterm)
  useEffect(() => {
    const isFocusInFileExplorer = (): boolean => {
      const focus = document.activeElement
      return focus instanceof HTMLElement && focus.closest('.terminal-file-explorer') !== null
    }

    /** Bloquea ⌘E fuera de xterm y del explorador (p. ej. ajustes, otros modales). */
    const shouldBlockExplorerToggleShortcut = (target: HTMLElement | null): boolean => {
      if (isFocusInFileExplorer()) return false
      if (!target || target.closest('.xterm')) return false
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
      if (target.isContentEditable) return true
      return false
    }

    /** ⌘Fin: terminal activa (xterm, cuerpo del panel o chrome de la terminal). */
    const shouldAllowScrollToBottomShortcut = (target: HTMLElement | null): boolean => {
      if (!target) return false
      return Boolean(
        target.closest('.xterm') ||
          target.closest('.terminal-pane-body') ||
          target.closest('.pane-toolbar') ||
          target.closest('.terminal-chrome-btn'),
      )
    }

    const onKeyDown = (e: KeyboardEvent): void => {
      const accel = e.metaKey || e.ctrlKey
      if (!accel) return

      // ⌘Fin / Ctrl+Fin: ir al final del scrollback (panel activo)
      const isEndKey = e.key === 'End' || e.code === 'End'
      if (!e.altKey && !e.shiftKey && isEndKey) {
        if (!shouldAllowScrollToBottomShortcut(e.target as HTMLElement | null)) return
        e.preventDefault()
        e.stopPropagation()
        const tabList = tabsRef.current
        const aid = activeTabIdRef.current
        const tab = tabList.find(t => t.id === aid)
        if (!tab) return
        termRefs.current.get(tab.activePaneId)?.scrollToBottom()
        return
      }

      if (e.altKey || e.shiftKey) return

      // ⌘E / Ctrl+E: explorador de archivos (panel activo)
      if (e.key === 'e' || e.key === 'E' || e.code === 'KeyE') {
        if (isFocusInFileExplorer()) return
        if (shouldBlockExplorerToggleShortcut(e.target as HTMLElement | null)) return
        e.preventDefault()
        e.stopPropagation()
        const tabList = tabsRef.current
        const aid = activeTabIdRef.current
        const tab = tabList.find(t => t.id === aid)
        if (!tab) return
        termRefs.current.get(tab.activePaneId)?.toggleExplorer()
        return
      }

      // ⌘T / Ctrl+T: nueva pestaña
      if (e.key === 't' || e.key === 'T' || e.code === 'KeyT') {
        const target = e.target as HTMLElement | null
        if (target && !target.closest('.xterm')) {
          const tag = target.tagName
          if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
          if (target.isContentEditable) return
        }
        e.preventDefault()
        e.stopPropagation()
        handleAddTab()
        return
      }

      // ⌘Y / Ctrl+Y: nueva terminal en ventana (misma pestaña)
      if (e.key === 'y' || e.key === 'Y' || e.code === 'KeyY') {
        const target = e.target as HTMLElement | null
        if (target && !target.closest('.xterm')) {
          const tag = target.tagName
          if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
          if (target.isContentEditable) return
        }
        e.preventDefault()
        e.stopPropagation()
        const tabList = tabsRef.current
        const aid = activeTabIdRef.current
        const tab = tabList.find(t => t.id === aid)
        if (!tab || tab.paneIds.length >= MAX_PANES_PER_TAB) return
        handleCreateTerminalRef.current(tab.id)
        return
      }

      // ⌘A / Ctrl+A: nueva ventana de agente en la pestaña activa
      if (e.key === 'a' || e.key === 'A' || e.code === 'KeyA') {
        const target = e.target as HTMLElement | null
        if (target && !target.closest('.xterm')) {
          const tag = target.tagName
          if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
          if (target.isContentEditable) return
        }
        e.preventDefault()
        e.stopPropagation()
        const tab = tabsRef.current.find(item => item.id === activeTabIdRef.current)
        if (!tab || tab.paneIds.length >= MAX_PANES_PER_TAB) return
        requestAddAgentRef.current(tab.id, tab.activePaneId || undefined)
        return
      }

      // ⌘1–9: cambiar a la pestaña en esa posición
      const digit = parseInt(e.key, 10)
      if (digit >= 1 && digit <= 9) {
        e.preventDefault()
        e.stopPropagation()
        const target = tabsRef.current[digit - 1]
        if (target) setActiveTabId(target.id)
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [handleAddTab])

  const renderPaneContent = (tab: TabSession, paneId: string): React.ReactElement => {
    const isAgent = tab.paneKinds?.[paneId] === 'agent'
    const registerClose = (openConfirm: () => void) =>
      registerPaneShortcutCloseIntercept(paneId, openConfirm)
    const chainLoopActive = activeLoopChainPaneIds(tab.planeLoopChains ?? []).has(paneId)

    if (isAgent) {
      return (
        <AgentPane
          paneId={paneId}
          meta={resolveTabAgentMeta(tab, paneId, projectAgentsByCwd)}
          cwd={tab.projectFolder?.trim() ?? ''}
          tabActive={tab.id === activeTabId}
          isActivePane={tab.id === activeTabId && tab.activePaneId === paneId}
          windowOpen={Boolean(tab.paneWindows?.[paneId]?.open)}
          chainLoopActive={chainLoopActive}
          onChainLoopStop={() => stopChainsForPane(tab.id, paneId)}
          onMetaChange={meta => handleAgentMetaChange(tab.id, paneId, meta)}
          onRequestPaneFocus={() => handleFocusPaneWindow(tab.id, paneId)}
          onClosePane={() => handleClosePane(tab.id, paneId)}
          onBusyChange={busy => handleBusyChange(paneId, busy)}
          onPlaneStatusChange={status => handleAgentPlaneStatusChange(paneId, status)}
          onPlaneLoopToggleReady={toggle => handlePlaneLoopToggleReady(paneId, toggle)}
          onPlaneQueueControlsReady={controls => handlePlaneQueueControlsReady(paneId, controls)}
          getOrchestrationAgents={() => {
            const panes = (tab.paneIds ?? [])
              .filter(id => tab.paneKinds?.[id] === 'agent')
              .map(id => ({
                paneId: id,
                meta: resolveTabAgentMeta(tab, id, projectAgentsByCwdRef.current),
              }))
            return listOrchestrationTargets(panes, paneId)
          }}
          onOrchestratorDelegations={delegations => {
            handleOrchestratorDelegations(paneId, tab.id, delegations)
          }}
          onOrchestratorStop={() => handleOrchestratorStop(paneId)}
          onDelegationTurnComplete={handleDelegationTurnComplete}
          onOrchestrationUserTurn={() => resetOrchestrationRun(paneId)}
          getOrchestrationRound={() => ({
            round: orchestrationRoundsByPaneRef.current.get(paneId) ?? 0,
            maxRounds: orchestrationMaxRoundsForPane(paneId, tab.id),
          })}
          preferOpenConfig={openConfigForPaneId === paneId}
          onPreferOpenConfigConsumed={() => {
            setOpenConfigForPaneId(current => (current === paneId ? null : current))
          }}
          onConfigClose={unlockMiniExpandForConfig}
          onConfigOpen={lockMiniExpandForConfig}
          preferOpenContextId={
            openContextForPane?.paneId === paneId ? openContextForPane.contextId : null
          }
          onPreferOpenContextConsumed={() => {
            setOpenContextForPane(current => (current?.paneId === paneId ? null : current))
          }}
          preferSend={planeSendByPane[paneId] ?? null}
          onPreferSendConsumed={() => {
            setPlaneSendByPane(current => {
              if (!(paneId in current)) return current
              const next = { ...current }
              delete next[paneId]
              return next
            })
          }}
          preferStop={planeStopPaneIds.has(paneId)}
          onPreferStopConsumed={() => {
            setPlaneStopPaneIds(current => {
              if (!current.has(paneId)) return current
              const next = new Set(current)
              next.delete(paneId)
              return next
            })
          }}
          preferClearConversation={planeClearPaneId === paneId}
          onPreferClearConversationConsumed={() => {
            setPlaneClearPaneId(current => (current === paneId ? null : current))
          }}
          registerShortcutCloseInterceptor={registerClose}
          fontSize={config.fontSize ?? 13}
        />
      )
    }

    return (
      <TerminalPane
        sessionId={paneId}
        fileExplorer={explorerByPane[paneId] ?? DEFAULT_FILE_EXPLORER_STATE}
        onFileExplorerChange={state => handleFileExplorerChange(paneId, state)}
        tabActive={tab.id === activeTabId}
        isActivePane={tab.id === activeTabId && tab.activePaneId === paneId}
        initialPtyCwd={splitSpawnCwdRef.current.get(paneId) || cwdsRef.current[paneId] || undefined}
        onPtyCwdInitialized={rememberPaneCwd}
        onPaneCwdChanged={persistPaneCwdOnCd}
        showPaneToolbar={false}
        paneToolbar={{
          onClosePane: () => handleClosePane(tab.id, paneId),
          showClosePane: false,
        }}
        registerShortcutCloseInterceptor={registerClose}
        onRequestPaneFocus={() => handleFocusPaneWindow(tab.id, paneId)}
        config={config}
        onTitleChange={title => handleTabTitleChange(tab.id, title)}
        onBusyChange={busy => handleBusyChange(paneId, busy)}
        onRegisterRef={ref => {
          if (ref) termRefs.current.set(paneId, ref)
          else termRefs.current.delete(paneId)
        }}
      />
    )
  }

  const agentCloneSources = useMemo(() => {
    if (!agentPicker) return []
    const tab = tabs.find(item => item.id === agentPicker.tabId)
    if (!tab) return []
    return tab.paneIds
      .filter(paneId => tab.paneKinds?.[paneId] === 'agent')
      .map(paneId => {
        const meta = resolveTabAgentMeta(tab, paneId, projectAgentsByCwd)
        return {
          paneId,
          name: meta.name?.trim() || '',
          provider: meta.provider ?? 'claude' as const,
        }
      })
  }, [agentPicker, projectAgentsByCwd, tabs])

  return (
    <div className="app-root">
      {/* ── Title bar (macOS traffic lights live here) ── */}
      <Titlebar
        config={config}
        fontSize={config.fontSize ?? 13}
        fontSizeMin={MIN_FONT}
        fontSizeMax={MAX_FONT}
        themePickerOpen={themePickerOpen}
        onFontIncrease={() => changeFontSize(1)}
        onFontDecrease={() => changeFontSize(-1)}
        onOpenThemePicker={() => setThemePickerOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onConfigPatch={patchConfig}
      />

      {/* ── Tab bar ── */}
      <TabBar
        ref={tabBarRef}
        tabs={tabs}
        activeTabId={activeTabId}
        onSelect={setActiveTabId}
        onAdd={handleAddTab}
        onClose={handleCloseTab}
        onRename={handleRenameTab}
        onReorder={handleReorderTabs}
        busyTabIds={busyTabIds}
      />

      {/* ── Main area ── */}
      <div className="main-area">
        <div className="terminals-container">
          {configReady && sessionReady.loaded && tabs.map(tab => {
            const discoveredContexts = tabContextsByTab[tab.id] ?? []
            const tabContextBadges = discoveredContexts.map(ctx => ({
              id: ctx.id,
              name: ctx.name,
              kind: ctx.kind,
              kindLabel: t(`tabContexts.kind_${ctx.kind}`),
              icon: contextIconName(ctx),
              color: resolveContextColor(ctx),
            }))

            const contextUsage = new Map<string, number>()
            for (const paneId of tab.paneIds) {
              if (tab.paneKinds?.[paneId] !== 'agent') continue
              const resolved = resolveTabAgentMeta(tab, paneId, projectAgentsByCwd)
              for (const contextId of resolved.contextIds ?? []) {
                contextUsage.set(contextId, (contextUsage.get(contextId) ?? 0) + 1)
              }
            }

            const entities = tab.paneIds.map((paneId, index) => {
              const kind = tab.paneKinds?.[paneId] === 'agent' ? 'agent' as const : 'terminal' as const
              const ensured = ensureTabPaneLayout(tab)
              const win = ensured.paneWindows?.[paneId] ?? createPaneWindowState(ensured.paneWindows, false)
              const meta = kind === 'agent'
                ? resolveTabAgentMeta(tab, paneId, projectAgentsByCwd)
                : undefined
              const terminalIndex = kind === 'terminal'
                ? tab.paneIds
                  .filter(id => tab.paneKinds?.[id] !== 'agent')
                  .indexOf(paneId) + 1
                : 0
              const title = kind === 'agent'
                ? (
                  meta?.name?.trim()
                  || (meta?.provider === 'cursor' ? t('agentPane.cursor') : t('agentPane.claude'))
                )
                : `${t('tabs.nodeTerminal')} ${terminalIndex || index + 1}`

              if (kind === 'agent') {
                const status = agentPlaneStatus[paneId]
                const assignedContexts = (meta?.contextIds ?? [])
                  .map(id => discoveredContexts.find(ctx => ctx.id === id))
                  .filter((ctx): ctx is TabContext => Boolean(ctx))
                  .map(ctx => ({
                    id: ctx.id,
                    name: ctx.name,
                    kind: ctx.kind,
                    kindLabel: t(`tabContexts.kind_${ctx.kind}`),
                    icon: contextIconName(ctx),
                    color: resolveContextColor(ctx),
                    shared: (contextUsage.get(ctx.id) ?? 0) > 1,
                  }))
                return {
                  paneId,
                  kind,
                  title,
                  busy: busyPanes.has(paneId),
                  provider: meta?.provider ?? 'claude',
                  coordination: (meta?.coordination === 'orchestrator'
                    ? 'orchestrator'
                    : 'none') as 'none' | 'orchestrator',
                  snippet: status?.lastSnippet ?? status?.activity ?? '',
                  contexts: assignedContexts,
                  autoImproveContexts: meta?.autoImproveContexts === true,
                  window: win,
                }
              }

              return {
                paneId,
                kind,
                title,
                busy: busyPanes.has(paneId),
                folderPath: paneCwds[paneId]?.trim() || tab.projectFolder?.trim() || undefined,
                folderName: (() => {
                  const name = sessionCwdFolderName(
                    paneCwds[paneId] || tab.projectFolder,
                  )
                  return name === '—' ? undefined : name
                })(),
                window: win,
              }
            })

            return (
              <div
                key={tab.id}
                className={[
                  'tab-terminal-group',
                  tab.id === activeTabId ? 'tab-terminal-group--active' : '',
                ].filter(Boolean).join(' ')}
              >
                <TabAgenticPlane
                  emptyTitle={t('tabs.planeEmptyTitle')}
                  emptyHint={t('tabs.planeEmptyHint')}
                  agentFabTitle={
                    tab.projectFolder?.trim()
                      ? t('tabs.fabAgent')
                      : t('agentPane.projectFolderRequired')
                  }
                  terminalFabTitle={
                    tab.projectFolder?.trim()
                      ? t('tabs.fabTerminal')
                      : t('agentPane.projectFolderRequired')
                  }
                  idleAgentLabel={t('tabs.planeIdleAgent')}
                  contextPoolTitle={t('tabs.planeContextPoolTitle')}
                  contextPoolConfigureLabel={t('tabContexts.manage')}
                  chatPlaceholder={t('tabs.planeChatPlaceholder')}
                  chatEmptyAgents={t('tabs.planeChatEmptyAgents')}
                  chatSendLabel={t('tabs.planeChatSend')}
                  chatContextsEmpty={t('tabs.planeChatContextsEmpty')}
                  tabContexts={tabContextBadges}
                  onToggleAgentContext={(paneId, contextId) => {
                    handleToggleAgentContext(tab.id, paneId, contextId)
                  }}
                  onAutoImproveChange={(paneId, enabled) => {
                    handleAgentAutoImproveChange(tab.id, paneId, enabled)
                  }}
                  onToggleLoop={handlePlaneToggleLoop}
                  onRemoveQueuedTurn={handlePlaneRemoveQueuedTurn}
                  onUpdateQueuedTurn={handlePlaneUpdateQueuedTurn}
                  canAdd={tab.paneIds.length < MAX_PANES_PER_TAB}
                  canAddAgent={Boolean(tab.projectFolder?.trim())}
                  canAddTerminal={Boolean(tab.projectFolder?.trim())}
                  activePaneId={tab.activePaneId}
                  entities={entities}
                  onAddAgent={() => {
                    requestAddAgent(tab.id, tab.activePaneId || undefined)
                  }}
                  onAddTerminal={() => { handleCreateTerminal(tab.id) }}
                  onExpandEntity={paneId => openPaneWindowUnlessSuppressed(tab.id, paneId)}
                  onCloseWindow={paneId => handleClosePaneWindow(tab.id, paneId)}
                  onMinimizeAllWindows={() => handleMinimizeAllPaneWindows(tab.id)}
                  onFocusWindow={paneId => handleFocusPaneWindow(tab.id, paneId)}
                  onConfigureContexts={() => handleConfigureContextsFromPlane(tab.id)}
                  onAssignContext={(paneId, contextId) => {
                    handleAssignContextToAgent(tab.id, paneId, contextId)
                  }}
                  openChatAgentId={tab.planeOpenChatAgentId ?? null}
                  onOpenChatAgentChange={paneId => handlePlaneOpenChatAgent(tab.id, paneId)}
                  onSendChat={(paneId, text, images) => {
                    yieldChainOfferForUserSend(paneId)
                    setPlaneSendByPane(prev => ({
                      ...prev,
                      [paneId]: { text, images, focusPane: true },
                    }))
                    setTabs(prev => {
                      const nextTabs = prev.map(tabItem => {
                        if (tabItem.id !== tab.id) return tabItem
                        const ensured = ensureTabPaneLayout(tabItem)
                        const paneWindows = { ...(ensured.paneWindows ?? {}) }
                        const win = paneWindows[paneId] ?? createPaneWindowState(paneWindows, false)
                        paneWindows[paneId] = { ...win, open: false, fullscreen: false }
                        return {
                          ...ensured,
                          activePaneId: paneId,
                          paneWindows,
                          planeOpenChatAgentId: paneId,
                        }
                      })
                      tabsRef.current = nextTabs
                      return nextTabs
                    })
                    void saveSessionNow()
                  }}
                  onStopChat={paneId => {
                    requestPlaneStop(paneId)
                    stopChainsForPane(tab.id, paneId)
                  }}
                  onClearConversation={paneId => {
                    setPlaneClearPaneId(paneId)
                  }}
                  agentStatuses={agentPlaneStatus}
                  chatFontSize={config.fontSize ?? 13}
                  configLabel={t('agentPane.openConfig')}
                  deleteLabel={t('tabs.planeDeletePane')}
                  maximizeLabel={t('tabs.planeMaximize')}
                  restoreLabel={t('tabs.planeRestore')}
                  closeWindowLabel={t('tabs.planeHideWindow')}
                  projectFolder={tab.projectFolder ?? ''}
                  projectFolderSelectLabel={t('tabs.projectFolderSelect')}
                  projectFolderChangeLabel={t('tabs.projectFolderChange')}
                  projectFolderEmptyHint={t('tabs.projectFolderEmptyHint')}
                  onSelectProjectFolder={() => { void handlePickProjectFolder(tab.id) }}
                  onRevealProjectFolder={tab.projectFolder?.trim()
                    ? () => { window.api.openFolder(tab.projectFolder!.trim()) }
                    : undefined}
                  loopsOpen={Boolean(planeLoopsOpenByTab[tab.id])}
                  onLoopsOpenChange={open => {
                    setPlaneLoopsOpenByTab(prev => ({ ...prev, [tab.id]: open }))
                  }}
                  loopsButtonLabel={t('tabs.loopsButton')}
                  loopsTitle={t('tabs.loopsTitle')}
                  loopsSubtitle={t('tabs.loopsSubtitle')}
                  loopsEmptyTitle={t('tabs.loopsEmptyTitle')}
                  loopsEmptyHint={t('tabs.loopsEmptyHint')}
                  loopsChainsTitle={t('tabs.loopsChainsTitle')}
                  loopsChainsEmpty={t('tabs.loopsChainsEmpty')}
                  loopsCreateChainLabel={t('tabs.loopsCreateChain')}
                  loopsAppendStepLabel={t('tabs.loopsAppendStep')}
                  loopsStartChainLabel={t('tabs.loopsStartChain')}
                  loopsStopChainLabel={t('tabs.loopsStopChain')}
                  loopsDeleteChainLabel={t('tabs.loopsDeleteChain')}
                  loopsChainModalTitle={t('tabs.loopsChainModalTitle')}
                  loopsChainModalDescription={t('tabs.loopsChainModalDescription')}
                  loopsAppendModalTitle={t('tabs.loopsAppendModalTitle')}
                  loopsAppendModalDescription={t('tabs.loopsAppendModalDescription')}
                  loopsAgentLabel={t('tabs.loopsAgent')}
                  loopsObjectiveLabel={t('tabs.loopsObjective')}
                  loopsObjectivePlaceholder={t('tabs.loopsObjectivePlaceholder')}
                  loopsNoAgentsHint={t('tabs.loopsNoAgents')}
                  loopsNoAppendAgentsHint={t('tabs.loopsNoAppendAgents')}
                  loopsBlockNeedObjectiveHint={t('tabs.loopsBlockNeedObjective')}
                  loopsChainConfirmLabel={t('tabs.loopsChainConfirm')}
                  loopsAppendConfirmLabel={t('tabs.loopsAppendConfirm')}
                  loopsCancelLabel={t('common.cancel')}
                  loopsStatusIdle={t('tabs.loopsStatusIdle')}
                  loopsStatusBusy={t('tabs.loopsStatusBusy')}
                  loopsStatusLooping={t('tabs.loopsStatusLooping')}
                  loopsChainStatusIdle={t('tabs.loopsChainStatusIdle')}
                  loopsChainStatusRunning={t('tabs.loopsChainStatusRunning')}
                  loopsChainStatusWaiting={t('tabs.loopsChainStatusWaiting')}
                  loopsChainStatusStopped={t('tabs.loopsChainStatusStopped')}
                  loopChains={tab.planeLoopChains ?? []}
                  onLoopChainsChange={chains => handleLoopChainsChange(tab.id, chains)}
                  onStartLoopChain={chainId => handleStartLoopChain(tab.id, chainId)}
                  onStopLoopChain={chainId => handleStopLoopChain(tab.id, chainId)}
                  canStartLoopChains={Boolean(tab.projectFolder?.trim())}
                  startLoopChainsBlockedHint={t('agentPane.projectFolderRequired')}
                  onOpenConfig={paneId => handleOpenConfigFromPlane(tab.id, paneId)}
                  onDeletePane={paneId => handleClosePane(tab.id, paneId)}
                  onToggleFullscreen={paneId => handleTogglePaneFullscreen(tab.id, paneId)}
                  onReorderPanes={(kind, orderedPaneIds) => {
                    handleReorderPanes(tab.id, kind, orderedPaneIds)
                  }}
                  reorderAriaLabel={t('tabs.planeReorderAriaLabel')}
                  renderPane={paneId => renderPaneContent(tab, paneId)}
                />
              </div>
            )
          })}
        </div>

      </div>

      {(() => {
        const modalTab = planeContextsModalTabId
          ? tabs.find(item => item.id === planeContextsModalTabId)
          : undefined
        if (!modalTab || !planeContextsModalTabId) return null
        const cwd = modalTab.projectFolder?.trim() || ''
        return (
          <TabContextsModal
            open
            contexts={tabContextsByTab[modalTab.id] ?? []}
            cwd={cwd}
            onRefresh={() => { void refreshTabContexts(modalTab.id) }}
            onClose={() => {
              setPlaneContextsModalTabId(null)
              void refreshTabContexts(modalTab.id)
            }}
          />
        )
      })()}

      <AppModals
        config={config}
        settingsOpen={settingsOpen}
        themePickerOpen={themePickerOpen}
        agentPicker={agentPicker}
        agentCloneSources={agentCloneSources}
        onCloseSettings={() => {
          setSettingsOpen(false)
          focusActiveTerminalTextarea()
        }}
        onCloseThemePicker={() => {
          setThemePickerOpen(false)
          focusActiveTerminalTextarea()
        }}
        onCloseAgentPicker={() => {
          setAgentPicker(null)
          focusActiveTerminalTextarea()
        }}
        onConfigSaved={handleConfigSaved}
        onThemeChange={handleThemeChange}
        onAgentProviderSelect={provider => {
          const pending = agentPicker
          setAgentPicker(null)
          if (pending) {
            void handleAddAgentPane(pending.tabId, pending.fromPaneId, provider)
          }
        }}
        onAgentCloneSelect={sourcePaneId => {
          const pending = agentPicker
          setAgentPicker(null)
          if (pending) {
            handleDuplicateAgentPane(pending.tabId, sourcePaneId)
          }
        }}
      />
    </div>
  )
}
