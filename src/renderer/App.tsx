import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyTheme, getTheme, normalizeThemeId } from '@themes/presets'
import type { AppConfig } from '@shared/configSchema'
import { CONFIG_DEFAULTS } from '@shared/configSchema'
import { agentCliSpec } from '@shared/agentCliProviders'
import { fontStack } from '@shared/fontStacks'
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
import type { PresenceSnapshot } from './presence'
import { setDiscordPresenceEnabled, startDiscordPresence } from './presence'
import type { GitListedRepo } from '@shared/gitSessionTypes'
import { TabBar, type TabBarHandle } from './components/TabBar'
import { TerminalPane } from './terminal/TerminalPane'
import { AgentPane } from './agent/AgentPane'
import { TabContextsModal } from './agent/TabContextsModal'
import { AppModals } from './components/AppModals'
import { QuitConfirmModal } from './components/QuitConfirmModal'
import { type OrgWorkspaceSelection } from './components/OrgWorkspaceTabPickerModal'
import type { OrgWorkspaceCatalog } from '../shared/orgWorkspaceCatalog'
import {
  buildOrgWorkspaceCatalog,
  canAccessOrgWorkspace,
  canRenameOrgWorkspace,
  catalogForLogin,
  catalogHasWorkspaces,
  findOrgWorkspaceCatalogEntry,
  isCatalogFresh,
  patchOrgWorkspaceCatalogName,
  sameGithubLogin,
  syncTabTitlesFromOrgWorkspaceCatalog,
} from '../shared/orgWorkspaceCatalog'
import { GitPanelModal } from './components/GitPanelModal'
import { GitRepoPickerModal } from './components/GitRepoPickerModal'
import { TabAgenticPlane } from './workspace/TabAgenticPlane'
import { BrainstormRoomModal } from './workspace/BrainstormRoomModal'
import { BrainstormRoomView } from './workspace/BrainstormRoomView'
import { BrainstormListModal } from './workspace/BrainstormListModal'
import {
  filterBrainstormInvitableAgents,
  type BrainstormRoom,
} from '../shared/brainstormRoom'
import { TabFileExplorerWindow, type TabFileExplorerWindowHandle } from './workspace/TabFileExplorerWindow'
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
import { APP_OVERLAY_MODAL_Z } from '@shared/overlayZIndex'
import type { AgentPlaneStatus, AgentPlaneQueueControls } from './agent/AgentPane'
import { collectBusyTabIds } from './agent/paneWorkActive'
import type { TerminalRef } from './terminal/TerminalPane'
import {
  listDelegationTargetsForMeta,
} from './workspace/orchestrationBridge'
import {
  formatDelegationResultFollowUp,
  formatDelegationRoundCapFollowUp,
  buildBatchedDelegationFollowUp,
  shouldWakeOrchestratorOnDelegationComplete,
  resolveOrchestrationMaxRounds,
  resolveOrchestrationWorkStyle,
  isOrchestrationRoundsUnlimited,
  orchestrationRoundsAtCap,
  shouldAbortOnHumanTurn,
} from '@shared/agentOrchestration'
import type { DelegateRequest, DelegateResult } from '@shared/agentOrchestration'
import {
  awaitingOrchestratorPaneIds,
  abortOneDelegationInJob,
  canReconcileIdlePending,
  createOrchestrationJob,
  findJobByDelegation,
  findPendingDelegationByToPane,
  flattenAwaitingItemsFromJobs,
  isJobAwaiting,
  listJobsForPane,
  markPendingSawBusyForPane,
  occupiedPaneIdsAcrossJobs,
  occupiedTargetPaneIdsAcrossAllJobs,
  pendingOrchestratorIdsFromJobs,
  resolveOrchestrationJobIdForTurn,
  shouldDeliverOrchestrationJobFollowUp,
  shouldWakeJob,
  supersedeOrchestrationJobsForHumanTurn,
  upsertOrchestrationWaveItem,
  type OrchestrationJob,
} from '@shared/orchestrationJobs'
import { pulseWorkspaceTag } from '@shared/pulseEvents'
import {
  buildMergeCommitMessage,
  buildConflictFollowUp,
  planWorktreeMergeOrder,
  shouldUseWorktreeForDelegation,
  worktreeBranchFor,
  worktreeRelPathFor,
  WORKTREES_DIR_SEGMENT,
} from '@shared/worktreeDelegation'
import {
  buildExpertReplicaDefinition,
  resolveExpertDelegationTarget,
  shouldFinalizeWorktreeFromOrchestrator,
} from '@shared/expertReplicas'
import {
  buildOrchestrationAwaitingView,
  shouldDisposeReplicaOnComplete,
  type OrchestrationAwaitingView,
} from '@shared/orchestrationAwaiting'
import {
  clearPlaneSendsForOrchestrationAbort,
  clearPlaneSendsForSingleDelegationAbort,
  shouldDiscardAbortedDelegationFifoHead,
} from './orchestrationAbort'
import { syncReduceMotionDomFlag } from './reduceMotion'
import {
  contextIdsEqual,
  resolveAssignedContextChips,
  resolveTabContextById,
} from './workspace/resolveAssignedContextChips'
import { ContextContentPreviewModal } from './workspace/ContextContentPreviewModal'
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
import {
  deriveTabCounter,
  sanitizePersistedSession,
  stripOrgTabAgentCliSessionIds,
} from './sessionSanitize'
import { resolveTabExplorerSessionId } from './tabFileExplorer'
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
  setPaneTitle,
  type PlaneLoopChain,
  type TabSession,
} from '../shared/tabSession'
import {
  allocateAgentSlug,
  agentBindingFromMeta,
  agentDefinitionFromMeta,
  buildNewProjectAgentDefinition,
  cloneProjectAgentDefinition,
  isAgentOwnResultContext,
  normalizeAgentSlug,
  remapAgentBindingsInTabs,
  remapAgentResultContextIds,
  remapAgentResultIdsInCatalog,
  remapAgentResultTabContexts,
  type ProjectAgentDefinition,
} from '../shared/projectAgentCatalog'
import { buildBootstrapProjectAgentDefinitions } from '../shared/projectAgentBootstrap'
import {
  covenantWorkspaceCatalogKey,
  tabAgentCatalogKey,
} from '../shared/covenantTypes'
import {
  getCovenantApi,
  hasCovenantOrgAdminsApi,
  hasCovenantWorkspaceContentApi,
  hasCovenantWorkspaceReposApi,
  hasCovenantWorkspacesApi,
} from './covenantApi'
import { retryCovenantResult } from '../shared/covenantRetry'
import { sanitizeSlugSegment } from '../shared/orgWorkspaceContent'
import {
  canUploadOrgWorkspaceChanges,
  orderedAgentIdsFromTab,
} from '../shared/orgWorkspaceLocalSync'
import {
  downloadOrgWorkspaceToLocal,
  uploadOrgWorkspaceFromLocal,
  type OrgWorkspaceMaterializeDeps,
} from './orgWorkspaceMaterialize'
import {
  OrgWorkspaceRequirementModal,
  type OrgWorkspaceRequirementState,
} from './components/OrgWorkspaceRequirementModal'
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
  const [explorerByTab, setExplorerByTab] = useState<Record<string, FileExplorerPersistedState>>({})
  /** UI Git del plano por tab: menú de repos + modal. */
  const [gitUiByTab, setGitUiByTab] = useState<Record<string, {
    pickerOpen: boolean
    modalOpen: boolean
    repoPath: string | null
    repos: GitListedRepo[]
  }>>({})
  const gitUiByTabRef = useRef(gitUiByTab)
  gitUiByTabRef.current = gitUiByTab
  /** Repos git del root folder por tab, para la lista bajo el composer del plano. */
  const [gitReposByTab, setGitReposByTab] = useState<Record<string, GitListedRepo[]>>({})
  const projectFolderKey = tabs.map(tab => `${tab.id}:${tab.projectFolder ?? ''}`).join('|')
  const [busyPanes, setBusyPanes] = useState<Set<string>>(new Set())
  const [settingsOpen, setSettingsOpen] = useState(false)
  /** Confirm de salida pedido por main (⌘Q / botón rojo). */
  const [quitConfirmOpen, setQuitConfirmOpen] = useState(false)
  const [orgModalOpen, setOrgModalOpen] = useState(false)
  const [orgWorkspacePickerOpen, setOrgWorkspacePickerOpen] = useState(false)
  /** Tabs org cuyo resync manual está en curso. */
  const [resyncingWorkspaceTabs, setResyncingWorkspaceTabs] = useState<Set<string>>(() => new Set())
  const [uploadingWorkspaceTabs, setUploadingWorkspaceTabs] = useState<Set<string>>(() => new Set())
  /** Snapshot Cmd+T: null = aún no hidratado / sin sesión. */
  const [orgWorkspaceCatalog, setOrgWorkspaceCatalog] = useState<OrgWorkspaceCatalog | null>(null)
  const orgWorkspaceCatalogRef = useRef<OrgWorkspaceCatalog | null>(null)
  const orgWorkspaceCatalogLoadingRef = useRef(false)
  const orgWorkspaceCatalogLoadGenRef = useRef(0)
  const [orgWorkspaceRequirement, setOrgWorkspaceRequirement] =
    useState<OrgWorkspaceRequirementState | null>(null)
  const [themePickerOpen, setThemePickerOpen] = useState(false)
  const [agentPicker, setAgentPicker] = useState<{ tabId: string; fromPaneId?: string } | null>(null)
  const [agentCreate, setAgentCreate] = useState<{
    tabId: string
    fromPaneId?: string
    provider: AgentCliProvider
  } | null>(null)
  const [agentPlaneStatus, setAgentPlaneStatus] = useState<Record<string, AgentPlaneStatus>>({})
  const agentPlaneStatusRef = useRef(agentPlaneStatus)
  agentPlaneStatusRef.current = agentPlaneStatus
  const planeLoopToggleByPaneRef = useRef(new Map<string, () => void>())
  const planeQueueControlsByPaneRef = useRef(new Map<string, AgentPlaneQueueControls>())
  const [tabContextsByTab, setTabContextsByTab] = useState<Record<string, TabContext[]>>({})
  /** Fuerza rediscovery de contextos en AgentPane tras rename de results. */
  const [contextsRevisionByCwd, setContextsRevisionByCwd] = useState<Record<string, number>>({})
  /** Catálogo `.gravity/agents` indexado por projectFolder. */
  const [projectAgentsByCwd, setProjectAgentsByCwd] = useState<Record<string, ProjectAgentDefinition[]>>({})
  const projectAgentsByCwdRef = useRef(projectAgentsByCwd)
  projectAgentsByCwdRef.current = projectAgentsByCwd
  const resyncOrgWorkspaceRef = useRef<(tab: TabSession) => Promise<void>>(async () => {})
  const syncOrgWorkspaceContentRef = useRef<(
    slug: string,
    workspaceId: string,
    tabIds: string[],
    options?: { wipeLocal?: boolean },
  ) => Promise<{ agentsOk: boolean; contextsOk: boolean }>>(async () => ({
    agentsOk: false,
    contextsOk: false,
  }))
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
    viaLoop?: boolean
    /** Contextos adjuntos solo a este turno (drop en el composer). */
    extraContextIds?: string[]
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
  const [brainstormSetupOpenByTab, setBrainstormSetupOpenByTab] = useState<Record<string, boolean>>({})
  const [brainstormListOpenByTab, setBrainstormListOpenByTab] = useState<Record<string, boolean>>({})
  const [brainstormRoomByTab, setBrainstormRoomByTab] = useState<Record<string, BrainstormRoom | null>>({})
  const [loopFifoTick, setLoopFifoTick] = useState(0)
  const [orchestrationFifoTick, setOrchestrationFifoTick] = useState(0)
  /** Override efímero de cwd por-pane (paneId → worktree absoluto); Fase 3, no persistido. */
  const [paneCwdOverrideTick, setPaneCwdOverrideTick] = useState(0)
  const paneCwdOverrideRef = useRef(new Map<string, string>())
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
    orchestrationJobId?: string
    delegation?: {
      id: string
      fromPaneId: string
      toAgentId: string
    }
  }>>())
  /**
   * Jobs de orquestación por pane (linear ≤1; turbo N).
   * Reemplaza pending/deferred/wave/rounds/completed por-mapa plano.
   */
  const orchestrationJobsByPaneRef = useRef(new Map<string, Map<string, OrchestrationJob>>())
  /** Job activo del próximo turno CLI (humano recién creado o follow-up ofrecido). */
  const activeOrchestrationJobByPaneRef = useRef(new Map<string, string>())
  const [orchestrationAwaitingByPane, setOrchestrationAwaitingByPane] = useState<
    ReadonlyMap<string, OrchestrationAwaitingView>
  >(() => new Map())
  /** Fase 4: rama base cacheada por orquestador (fromPaneId) — evita repetir gitCurrentBranch. */
  const baseBranchByOrchestratorRef = useRef(
    new Map<string, { baseCwd: string; isGitRepo: boolean; baseBranch: string }>(),
  )
  /** Fase 4: worktrees activos por delegación, para commit+merge+cleanup al completar. */
  const worktreesByDelegationRef = useRef(new Map<string, {
    fromPaneId: string
    toPaneId: string
    worktreePath: string
    branch: string
    baseCwd: string
    baseBranch: string
    /** Réplica spawn: para dispose tras merge ok / conflict retry. */
    baseAgentId?: string
  }>())
  /** Fase 4: cola de merges serializada por orquestador (encadena promesas, evita carreras git). */
  const mergeQueueByOrchestratorRef = useRef(new Map<string, Promise<void>>())
  const [awaitingDelegationPaneIds, setAwaitingDelegationPaneIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const [delegationTargetPaneIds, setDelegationTargetPaneIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  /** Especialista idle con pending huérfano → completar (notify perdido / remount). */
  const reconcileIdleDelegationTargetRef = useRef<(
    paneId: string,
    summary: string,
  ) => void>(() => undefined)
  const reconcilingIdleDelegationPaneIdsRef = useRef(new Set<string>())
  const syncAwaitingFromPending = useCallback(() => {
    const byPane = orchestrationJobsByPaneRef.current
    setAwaitingDelegationPaneIds(awaitingOrchestratorPaneIds(byPane))
    setDelegationTargetPaneIds(occupiedTargetPaneIdsAcrossAllJobs(byPane))

    const nextViews = new Map<string, OrchestrationAwaitingView>()
    for (const [fromPaneId, jobsMap] of byPane.entries()) {
      const jobs = [...jobsMap.values()]
      if (!jobs.some(isJobAwaiting) && !jobs.some(job => job.waveItems.length > 0)) {
        continue
      }
      const flat = flattenAwaitingItemsFromJobs(jobs).map(item => {
        const worktreePath = worktreesByDelegationRef.current.get(item.delegationId)?.worktreePath
        return {
          ...item,
          ...(worktreePath ? { worktreePath } : {}),
        }
      })
      const view = buildOrchestrationAwaitingView(flat)
      const stillWaiting = jobs.some(isJobAwaiting)
      if (view && stillWaiting) nextViews.set(fromPaneId, view)
      if (!stillWaiting) {
        for (const job of jobs) job.waveItems = []
      }
    }
    setOrchestrationAwaitingByPane(nextViews)

    // Pending huérfano: especialista idle tras haber estado busy (notify perdido).
    // No reconciliar pending recién creado: el pane aún idle con lastSnippet viejo.
    for (const toPaneId of occupiedTargetPaneIdsAcrossAllJobs(byPane)) {
      const status = agentPlaneStatusRef.current[toPaneId]
      if (!status || status.busy || status.awaitingDelegations || status.localLoopActive) continue
      const pending = findPendingDelegationByToPane(byPane, toPaneId)
      if (!pending || !canReconcileIdlePending(pending.sawBusy)) continue
      reconcileIdleDelegationTargetRef.current(toPaneId, status.lastSnippet)
    }
  }, [])
  const [planeContextsModalTabId, setPlaneContextsModalTabId] = useState<string | null>(null)
  const [planeContextsFocusId, setPlaneContextsFocusId] = useState<string | null>(null)
  const [planeContextsCreate, setPlaneContextsCreate] = useState(false)
  const [resultsPreview, setResultsPreview] = useState<{
    tabId: string
    context: TabContext
  } | null>(null)
  const termRefs = useRef<Map<string, TerminalRef>>(new Map())
  const tabExplorerHostByTabRef = useRef<Map<string, TabFileExplorerWindowHandle>>(new Map())
  const splitSpawnCwdRef = useRef<Map<string, string>>(new Map())
  const cwdsRef = useRef<Record<string, string>>({})
  /** Mirror reactivo de cwdsRef para badges de minis en el plano. */
  const [paneCwds, setPaneCwds] = useState<Record<string, string>>({})
  const explorerByTabRef = useRef<Record<string, FileExplorerPersistedState>>({})
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

  /** Alinea panes de agente de una tab con `.gravity/agents` (fuente de verdad). */
  const syncTabWithProjectAgents = useCallback((
    tabId: string,
    agents: ProjectAgentDefinition[],
  ): void => {
    const current = tabsRef.current.find(tab => tab.id === tabId)
    if (!current) return
    const isOrgBacked = Boolean(
      current.orgWorkspace?.slug?.trim() && current.orgWorkspace?.workspaceId?.trim(),
    )
    const synced = syncTabAgentsFromCatalog(current, agents, {
      maxPanes: MAX_PANES_PER_TAB,
      createPaneId: () => crypto.randomUUID(),
      createWindow: (paneWindows, open) => createPaneWindowState(paneWindows, open),
      // Org: sesiones CLI son locales al usuario; no reutilizar ni sincronizar.
      ...(isOrgBacked ? { preserveCliSessionIds: false } : {}),
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

  /**
   * Descarga agentes+contextos org del backend y los materializa en projectFolder.
   * Tras escribir, refresca UI con rutas locales (refreshProjectAgents + discover).
   */
  const syncOrgWorkspaceContent = useCallback(async (
    slug: string,
    workspaceId: string,
    tabIds: string[],
    options: { wipeLocal?: boolean } = {},
  ): Promise<{ agentsOk: boolean; contextsOk: boolean }> => {
    const covenant = getCovenantApi()
    if (!covenant || !hasCovenantWorkspaceContentApi(covenant)) {
      return { agentsOk: false, contextsOk: false }
    }
    const targets = tabsRef.current.filter(tab => tabIds.includes(tab.id))
    const folders = [...new Set(
      targets
        .map(tab => tab.projectFolder?.trim() || tab.orgWorkspace?.localDir?.trim() || '')
        .filter(Boolean),
    )]
    if (!folders.length) {
      return { agentsOk: false, contextsOk: false }
    }

    const buildDeps = (cwd: string): OrgWorkspaceMaterializeDeps => ({
      listRemoteAgents: () => retryCovenantResult(() => covenant.workspaceAgentsList(slug, workspaceId)),
      listRemoteContexts: () => retryCovenantResult(() => covenant.workspaceContextsList(slug, workspaceId)),
      listLocalAgents: root => window.api.listProjectAgents(root),
      upsertLocalAgent: async (root, definition) => {
        const written = await window.api.upsertProjectAgent(root, definition)
        return written.ok
          ? { ok: true, agent: written.agent }
          : { ok: false, error: written.error }
      },
      deleteLocalAgent: (root, agentId) => window.api.deleteProjectAgent(root, agentId),
      discoverLocalContexts: async root => {
        const result = await window.api.discoverTabContexts({ cwd: root })
        return result.ok
          ? { ok: true, contexts: result.contexts }
          : { ok: false, error: result.error }
      },
      deleteLocalContext: (context, root) => window.api.deleteTabContext({ context, cwd: root }),
      materializeLocalContext: async args => {
        const result = await window.api.materializeTabContext({
          context: args.context,
          cwd: args.cwd,
          ...(args.content !== undefined ? { content: args.content } : {}),
        })
        return result.ok
          ? { ok: true, notesContent: result.notesContent }
          : { ok: false, error: result.error }
      },
      previewLocalContext: async args => {
        const result = await window.api.previewTabContext({
          context: args.context,
          cwd: args.cwd,
        })
        return result.ok
          ? { ok: true, notesContent: result.notesContent }
          : { ok: false, error: result.error }
      },
      upsertRemoteAgent: (agentId, definition) => (
        covenant.workspaceAgentUpsert(slug, workspaceId, agentId, definition)
      ),
      deleteRemoteAgent: agentId => covenant.workspaceAgentDelete(slug, workspaceId, agentId),
      upsertRemoteContext: (contextId, payload) => (
        covenant.workspaceContextUpsert(slug, workspaceId, contextId, payload)
      ),
      deleteRemoteContext: contextId => (
        covenant.workspaceContextDelete(slug, workspaceId, contextId)
      ),
    })

    let agentsOk = true
    let contextsOk = true
    for (const cwd of folders) {
      const preferredAgentIds = targets
        .filter(tab => (
          (tab.projectFolder?.trim() || tab.orgWorkspace?.localDir?.trim() || '') === cwd
        ))
        .flatMap(tab => orderedAgentIdsFromTab(tab))
      const result = await downloadOrgWorkspaceToLocal(cwd, buildDeps(cwd), {
        wipeLocal: options.wipeLocal === true,
        ...(preferredAgentIds.length ? { preferredAgentIds } : {}),
      })
      if (!result.agentsOk) agentsOk = false
      if (!result.contextsOk) contextsOk = false
      const agents = await refreshProjectAgents(cwd)
      for (const tab of targets) {
        if ((tab.projectFolder?.trim() || tab.orgWorkspace?.localDir?.trim() || '') !== cwd) continue
        syncTabWithProjectAgents(tab.id, agents)
        const discovered = await window.api.discoverTabContexts({ cwd })
        if (discovered.ok) {
          setTabContextsByTab(prev => ({ ...prev, [tab.id]: discovered.contexts }))
        }
      }
    }
    return { agentsOk, contextsOk }
  }, [refreshProjectAgents, syncTabWithProjectAgents])
  syncOrgWorkspaceContentRef.current = syncOrgWorkspaceContent

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
      const sanitized = stripOrgTabAgentCliSessionIds(tab)
      const planeLoopChains = planeLoopChainsForPersist(sanitized.planeLoopChains)
      if (!planeLoopChains) {
        if (!sanitized.planeLoopChains) return sanitized
        const { planeLoopChains: _dropped, ...rest } = sanitized
        return rest
      }
      return { ...sanitized, planeLoopChains }
    })
    return {
      version: 1 as const,
      activeTabId: currentActiveTabId,
      tabs,
      cwds: { ...cwdsRef.current },
      explorerByTab: { ...explorerByTabRef.current },
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
    window.api.getConfig().then(async cfg => {
      const tid = normalizeThemeId(cfg.themeId)
      if (tid !== cfg.themeId) {
        void window.api.setConfig({ themeId: tid })
      }
      setConfig({ ...cfg, themeId: tid })

      let login = ''
      try {
        const covenant = getCovenantApi()
        if (covenant) {
          const status = await covenant.status()
          if (status.ok && status.data.signedIn) {
            login = status.data.login?.trim() ?? ''
          }
        }
      } catch {
        /* status local falló → sin cache */
      }
      const hydrated = login
        ? catalogForLogin(cfg.orgWorkspaceCatalogCache, login)
        : null
      orgWorkspaceCatalogRef.current = hydrated
      setOrgWorkspaceCatalog(hydrated)
      setConfigReady(true)
    })
  }, [])

  const applyOrgWorkspaceCatalog = useCallback((next: OrgWorkspaceCatalog | null) => {
    orgWorkspaceCatalogRef.current = next
    setOrgWorkspaceCatalog(next)
    const synced = syncTabTitlesFromOrgWorkspaceCatalog(tabsRef.current, next)
    if (synced) {
      tabsRef.current = synced
      setTabs(synced)
    }
  }, [])

  const persistOrgWorkspaceCatalogCache = useCallback(async (
    next: OrgWorkspaceCatalog | null,
  ) => {
    setConfig(prev => {
      if (next) {
        if (prev.orgWorkspaceCatalogCache === next) return prev
        return { ...prev, orgWorkspaceCatalogCache: next }
      }
      if (prev.orgWorkspaceCatalogCache === undefined) return prev
      const cleared = { ...prev }
      delete cleared.orgWorkspaceCatalogCache
      return cleared
    })
    // null borra en mergeWithDefaults (undefined puede omitirse en IPC).
    await window.api.setConfig({ orgWorkspaceCatalogCache: next })
  }, [])

  const loadOrgWorkspaceCatalog = useCallback(async (force = false) => {
    if (orgWorkspaceCatalogLoadingRef.current && !force) return
    const gen = ++orgWorkspaceCatalogLoadGenRef.current
    orgWorkspaceCatalogLoadingRef.current = true
    const CATALOG_TTL_MS = 5 * 60 * 1000
    try {
      const covenant = getCovenantApi()
      if (!covenant) {
        if (gen !== orgWorkspaceCatalogLoadGenRef.current) return
        applyOrgWorkspaceCatalog(null)
        await persistOrgWorkspaceCatalogCache(null)
        return
      }
      const status = await covenant.status()
      if (gen !== orgWorkspaceCatalogLoadGenRef.current) return
      if (!status.ok || !status.data.signedIn) {
        applyOrgWorkspaceCatalog(null)
        await persistOrgWorkspaceCatalogCache(null)
        return
      }
      const login = status.data.login?.trim() ?? ''
      if (!login) {
        applyOrgWorkspaceCatalog(null)
        await persistOrgWorkspaceCatalogCache(null)
        return
      }

      const current = catalogForLogin(orgWorkspaceCatalogRef.current, login)
      const renameFlagsReady = !current
        || current.entries.every(e => typeof e.canRename === 'boolean')
      if (
        !force
        && isCatalogFresh(current, CATALOG_TTL_MS, Date.now())
        && renameFlagsReady
      ) {
        if (current) applyOrgWorkspaceCatalog(current)
        return
      }

      if (!hasCovenantWorkspacesApi(covenant)) {
        const empty = buildOrgWorkspaceCatalog(login, [], {}, Date.now())
        if (gen !== orgWorkspaceCatalogLoadGenRef.current) return
        applyOrgWorkspaceCatalog(empty)
        await persistOrgWorkspaceCatalogCache(empty)
        return
      }

      const orgsResult = await covenant.orgsList()
      if (gen !== orgWorkspaceCatalogLoadGenRef.current) return
      if (!orgsResult.ok) return

      const workspacesByOrg: Record<string, Array<{
        id: string
        name: string
        canRename: boolean
      }>> = {}
      const orgAdminsApi = hasCovenantOrgAdminsApi(covenant)
      for (const org of orgsResult.data) {
        const slug = org.slug?.trim()
        if (!slug) continue
        const list = await covenant.workspacesList(slug)
        if (gen !== orgWorkspaceCatalogLoadGenRef.current) return
        if (!list.ok) continue
        const orgRole = org.role?.trim() ?? ''
        let isOrgAdmin = orgRole === 'owner' || orgRole === 'admin'
        if (!isOrgAdmin && orgAdminsApi) {
          const adminsResult = await covenant.orgAdminsList(slug)
          if (gen !== orgWorkspaceCatalogLoadGenRef.current) return
          if (adminsResult.ok) {
            isOrgAdmin = adminsResult.data.some(a => sameGithubLogin(a, login))
          }
        }
        workspacesByOrg[slug] = list.data.map(w => {
          const workspaceAccess = {
            login,
            orgRole: org.role ?? '',
            isOrgAdmin,
            createdBy: w.createdBy,
            admins: w.admins,
          }
          return {
            id: w.id,
            name: w.name,
            canAccess: canAccessOrgWorkspace({
              ...workspaceAccess,
              assignees: w.assignees,
            }),
            canRename: canRenameOrgWorkspace(workspaceAccess),
          }
        })
      }

      const built = buildOrgWorkspaceCatalog(
        login,
        orgsResult.data.map(o => ({ slug: o.slug, name: o.name })),
        workspacesByOrg,
        Date.now(),
      )
      if (gen !== orgWorkspaceCatalogLoadGenRef.current) return

      const prev = orgWorkspaceCatalogRef.current
      const changed =
        !prev
        || prev.login !== built.login
        || prev.entries.length !== built.entries.length
        || prev.entries.some((e, i) => {
          const n = built.entries[i]!
          return (
            e.slug !== n.slug
            || e.orgName !== n.orgName
            || e.workspaceId !== n.workspaceId
            || e.name !== n.name
            || e.canRename !== n.canRename
          )
        })

      applyOrgWorkspaceCatalog(built)
      if (changed) await persistOrgWorkspaceCatalogCache(built)
    } catch {
      /* red falló: conservar snapshot en memoria */
    } finally {
      if (gen === orgWorkspaceCatalogLoadGenRef.current) {
        orgWorkspaceCatalogLoadingRef.current = false
      }
    }
  }, [applyOrgWorkspaceCatalog, persistOrgWorkspaceCatalogCache])

  // Stale-while-revalidate tras boot (red en background; Cmd+T ya usa el snapshot).
  useEffect(() => {
    if (!configReady) return
    void loadOrgWorkspaceCatalog(false)
  }, [configReady, loadOrgWorkspaceCatalog])

  // Catálogo y sesión cargan en paralelo: alinear títulos org cuando ambos estén listos.
  useEffect(() => {
    if (!sessionReady.loaded || !orgWorkspaceCatalog) return
    const synced = syncTabTitlesFromOrgWorkspaceCatalog(tabsRef.current, orgWorkspaceCatalog)
    if (!synced) return
    tabsRef.current = synced
    setTabs(synced)
  }, [sessionReady.loaded, orgWorkspaceCatalog])

  useEffect(() => {
    if (!configReady) return
    applyTheme(getTheme(config.themeId))
  }, [configReady, config.themeId])

  // Tipografía elegida en Ajustes. `applyTheme` no toca estas variables, así que
  // cambiar de tema no pisa la fuente. Sin elección se borra el inline y manda global.css.
  useEffect(() => {
    if (!configReady) return
    const root = document.documentElement
    for (const [cssVar, kind, choice] of [
      ['--font-ui', 'ui', config.fontUi],
      ['--font-mono', 'mono', config.fontMono],
    ] as const) {
      const stack = fontStack(choice ?? '', kind)
      if (stack) root.style.setProperty(cssVar, stack)
      else root.style.removeProperty(cssVar)
    }
  }, [configReady, config.fontUi, config.fontMono])

  useEffect(() => {
    if (!configReady) return
    void i18next.changeLanguage(config.language ?? 'en')
  }, [configReady, config.language])

  // App + OS reduce-motion → un solo flag DOM para CSS y JS.
  useEffect(() => {
    if (!configReady) return
    const sync = (): void => {
      syncReduceMotionDomFlag(Boolean(config.reduceMotion))
    }
    sync()
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [configReady, config.reduceMotion])

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
          Object.entries(sanitized.explorerByTab)
            .map(([id, st]) => [id, normalizeFileExplorerState(st)]),
        )
        explorerByTabRef.current = explorerMap
        setExplorerByTab(explorerMap)
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
        // Agentes solo desde `.gravity/agents` (no resucitar rich meta de session).
        void (async () => {
          const folders = [...new Set(
            layoutTabs
              .map(tab => tab.projectFolder?.trim() || '')
              .filter(Boolean),
          )]
          try {
            await Promise.all(folders.map(folder => refreshAndSyncProjectAgents(folder)))
          } catch (err) {
            console.warn('[boot] refreshAndSyncProjectAgents falló:', err)
          }

          // QA fix (Fase 4): boot GC de worktrees huérfanos (crash/kill de sesiones previas).
          await Promise.all(folders.map(async folder => {
            try {
              const worktreePrefix = `${folder.replace(/\/+$/, '')}/${WORKTREES_DIR_SEGMENT}/`
              const list = await window.api.gitWorktreeList({ path: folder })
              const orphans = list.filter(entry => entry.path.startsWith(worktreePrefix))
              for (const entry of orphans) {
                try {
                  await window.api.gitWorktreeRemove({ path: folder }, {
                    worktreePath: entry.path,
                    branch: entry.branch,
                    force: true,
                  })
                } catch (err) {
                  console.warn(`[worktree] boot GC falló removiendo ${entry.path}:`, err)
                }
              }
            } catch (err) {
              console.warn(`[worktree] boot GC falló listando worktrees de ${folder}:`, err)
            }
          }))

          const covenant = getCovenantApi()

          // Repos org: clona faltantes (p. ej. añadidos por admin) sin UI bloqueante.
          const reposByWorkspace = new Map<string, {
            slug: string
            workspaceId: string
            localDir: string
          }>()
          for (const tab of layoutTabs) {
            const org = tab.orgWorkspace
            if (!org?.slug?.trim() || !org.workspaceId?.trim()) continue
            const localDir = tab.projectFolder?.trim() || org.localDir?.trim() || ''
            if (!localDir) continue
            const key = covenantWorkspaceCatalogKey(org.slug, org.workspaceId)
            if (reposByWorkspace.has(key)) continue
            reposByWorkspace.set(key, {
              slug: org.slug.trim(),
              workspaceId: org.workspaceId.trim(),
              localDir,
            })
          }
          if (
            covenant
            && hasCovenantWorkspaceReposApi(covenant)
            && typeof covenant.cloneOrgWorkspace === 'function'
          ) {
            let firstCloneError: string | null = null
            let firstCloneFailure: OrgWorkspaceRequirementState['cloneFailure']
            await Promise.all([...reposByWorkspace.values()].map(async ws => {
              try {
                const reposResult = await covenant.workspaceReposList(ws.slug, ws.workspaceId)
                if (!reposResult.ok) return
                const repos = reposResult.data.map(r => ({
                  repoFullName: r.repoFullName,
                  cloneUrl: r.cloneUrl,
                  ...(r.folderName?.trim() ? { folderName: r.folderName.trim() } : {}),
                }))
                if (!repos.length) return
                const res = await covenant.cloneOrgWorkspace({
                  orgSlug: ws.slug,
                  workspaceSlug: sanitizeSlugSegment(ws.workspaceId),
                  repos,
                  workspaceDir: ws.localDir,
                })
                if (!res.ok) {
                  console.warn('[boot] org workspace repo clone falló', ws.slug, ws.workspaceId, res.error)
                  if (!firstCloneError) {
                    firstCloneError = res.error
                    firstCloneFailure = res.failure
                  }
                }
              } catch (err) {
                console.warn('[boot] org workspace repo sync failed', ws.slug, ws.workspaceId, err)
                if (!firstCloneError) firstCloneError = String(err)
              }
            }))
            if (firstCloneError) {
              const cloneErr = firstCloneError as string
              const requirement: OrgWorkspaceRequirementState =
                cloneErr === 'missing-default-dir'
                  ? { missingFolder: true }
                  : cloneErr === 'missing-token'
                    ? { missingToken: true }
                    : { cloneError: cloneErr, cloneFailure: firstCloneFailure }
              // Updater funcional: consulta el estado VIVO (prev), no el closure stale
              // del boot. Si otro flujo ya abrió un modal (prev !== null), no lo pisa.
              setOrgWorkspaceRequirement(prev => (prev === null ? requirement : prev))
            }
          }

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
          explorerByTab: { ...explorerByTabRef.current },
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

  // Contextos: disco (discoverTabContexts / `.gravity`) para personal y org local-first.
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
      if (cancelled) return
      if (!cwd) {
        setTabContextsByTab(prev => ({ ...prev, [tab.id]: [] }))
        return
      }
      const result = await window.api.discoverTabContexts({ cwd })
      if (cancelled) return
      if (!result.ok) {
        setTabContextsByTab(prev => ({ ...prev, [tab.id]: [] }))
        return
      }
      setTabContextsByTab(prev => ({ ...prev, [tab.id]: result.contexts }))
      // idRemap ya reescribió contextIds en agentes del disco; refrescar catálogo en memoria.
      if (result.contextsMigrated || (result.idRemap && Object.keys(result.idRemap).length > 0)) {
        await refreshProjectAgents(cwd)
      }
    })()
    return () => { cancelled = true }
  }, [activeTabId, tabContextDiscoverKey, resolvePaneCwdForPersist, refreshProjectAgents])

  // Confirmación de salida: main pide, el modal de la app responde.
  useEffect(() => window.api.onConfirmQuit(() => setQuitConfirmOpen(true)), [])

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
            explorerByTab: { ...explorerByTabRef.current },
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

  /**
   * Fase 3 (plumbing): asigna un override de cwd (worktree) al pane `paneId` para que
   * su próximo turno de agente spawnee el CLI ahí en vez de `tab.projectFolder`.
   * Efímero (no persiste en session.json); Fase 4 conectará la creación real de worktrees.
   */
  const setPaneCwdOverride = useCallback((paneId: string, absPath: string) => {
    const trimmed = absPath.trim()
    if (!trimmed) return
    if (paneCwdOverrideRef.current.get(paneId) === trimmed) return
    paneCwdOverrideRef.current.set(paneId, trimmed)
    setPaneCwdOverrideTick(n => n + 1)
  }, [])

  /** Limpia el override de cwd del pane `paneId`, volviendo al `tab.projectFolder` base. */
  const clearPaneCwdOverride = useCallback((paneId: string) => {
    if (!paneCwdOverrideRef.current.has(paneId)) return
    paneCwdOverrideRef.current.delete(paneId)
    setPaneCwdOverrideTick(n => n + 1)
  }, [])

  /**
   * Fase 4 (QA fix): teardown best-effort de worktrees huérfanos al cancelar un
   * orquestador o cerrar un pane. Borra toda entrada de worktreesByDelegationRef cuyo
   * `fromPaneId` (orquestador) O `toPaneId` (especialista) sea `paneId` — cubre ambos
   * casos: cerrar/abortar el orquestador, o cerrar el pane especialista que la ejecutaba.
   */
  const cleanupWorktreesForPane = useCallback(async (paneId: string) => {
    const affected = [...worktreesByDelegationRef.current.entries()]
      .filter(([, info]) => info.fromPaneId === paneId || info.toPaneId === paneId)
    for (const [delegationId, info] of affected) {
      try {
        clearPaneCwdOverride(info.toPaneId)
        await window.api.gitWorktreeRemove({ path: info.baseCwd }, {
          worktreePath: info.worktreePath,
          branch: info.branch,
          force: true,
        })
      } catch (err) {
        console.warn(`[worktree] cleanup falló para la delegación ${delegationId}:`, err)
      } finally {
        worktreesByDelegationRef.current.delete(delegationId)
      }
    }
  }, [clearPaneCwdOverride])

  const busyTabIds = useMemo(
    () => collectBusyTabIds(tabs, busyPanes, delegationTargetPaneIds, agentPlaneStatus),
    [tabs, busyPanes, delegationTargetPaneIds, agentPlaneStatus],
  )

  // Discord Rich Presence: ref reasignada cada render para que el poll de 15s
  // lea siempre el estado actual sin resuscribirse.
  const presenceSnapshotRef = useRef<PresenceSnapshot>({
    workspace: null,
    tabs: 0,
    agentLive: false,
  })
  presenceSnapshotRef.current = {
    workspace: tabs.find(t => t.id === activeTabId)?.projectFolder?.trim().split('/').pop() || null,
    tabs: tabs.length,
    agentLive: busyPanes.size > 0,
  }

  useEffect(() => {
    if (!configReady) return
    startDiscordPresence(() => presenceSnapshotRef.current, config.discordPresenceEnabled)
    return () => setDiscordPresenceEnabled(false)
  }, [configReady, config.discordPresenceEnabled])

  const handleFileExplorerChange = useCallback(
    (tabId: string, state: FileExplorerPersistedState) => {
      setExplorerByTab(prev => {
        const next = { ...prev, [tabId]: state }
        explorerByTabRef.current = next
        return next
      })
      scheduleSaveSession()
    },
    [scheduleSaveSession],
  )

  const patchTabExplorer = useCallback(
    (tabId: string, patch: Partial<FileExplorerPersistedState>) => {
      setExplorerByTab(prev => {
        const current = prev[tabId] ?? DEFAULT_FILE_EXPLORER_STATE
        const next = { ...prev, [tabId]: { ...current, ...patch } }
        explorerByTabRef.current = next
        return next
      })
      scheduleSaveSession()
    },
    [scheduleSaveSession],
  )

  const closeTabExplorer = useCallback((tabId: string) => {
    patchTabExplorer(tabId, { open: false, fullscreen: false })
  }, [patchTabExplorer])

  const toggleTabExplorer = useCallback((tabId: string) => {
    const tab = tabsRef.current.find(item => item.id === tabId)
    if (!tab) return
    const current = explorerByTabRef.current[tabId] ?? DEFAULT_FILE_EXPLORER_STATE
    if (current.open) {
      patchTabExplorer(tabId, { open: false, fullscreen: false })
      return
    }
    // Sin carpeta de proyecto no hay raíz estable: no abrir el explorador.
    if (!tab.projectFolder?.trim()) return
    const sessionId = resolveTabExplorerSessionId(tab)
    if (!sessionId) return
    setTabs(prev => {
      const nextTabs = prev.map(item => {
        if (item.id !== tabId || item.paneIds.length === 0) return item
        const ensured = ensureTabPaneLayout(item)
        const paneWindows = { ...(ensured.paneWindows ?? {}) }
        minimizeOtherPaneWindows(item.paneIds, paneWindows, '')
        return { ...ensured, paneWindows }
      })
      tabsRef.current = nextTabs
      return nextTabs
    })
    void window.api.fileExplorerSetRoot(sessionId, tab.projectFolder.trim())
    patchTabExplorer(tabId, { open: true, fullscreen: false })
  }, [patchTabExplorer])

  const refreshTabGitRepos = useCallback(async (tabId: string) => {
    const tab = tabsRef.current.find(item => item.id === tabId)
    const paths: string[] = []
    const folder = tab?.projectFolder?.trim() ?? ''
    if (folder) paths.push(folder)
    for (const paneId of tab?.paneIds ?? []) {
      if (tab?.paneKinds?.[paneId] === 'agent') continue
      const cwd = (
        cwdsRef.current[paneId]?.trim()
        || paneCwds[paneId]?.trim()
        || ''
      )
      if (cwd) paths.push(cwd)
    }
    if (paths.length === 0) {
      setGitUiByTab(prev => ({
        ...prev,
        [tabId]: {
          pickerOpen: false,
          modalOpen: prev[tabId]?.modalOpen ?? false,
          repoPath: prev[tabId]?.repoPath ?? null,
          repos: [],
        },
      }))
      return [] as GitListedRepo[]
    }
    const repos = await window.api.gitCollectUniqueRepos(paths)
    setGitUiByTab(prev => {
      const prevState = prev[tabId]
      const repoPath = prevState?.repoPath && repos.some(repo => repo.path === prevState.repoPath)
        ? prevState.repoPath
        : (prevState?.repoPath ?? null)
      return {
        ...prev,
        [tabId]: {
          pickerOpen: prevState?.pickerOpen ?? false,
          modalOpen: prevState?.modalOpen ?? false,
          repoPath,
          repos,
        },
      }
    })
    return repos
  }, [paneCwds])

  const openTabGitModal = useCallback((tabId: string, repoPath: string) => {
    setGitUiByTab(prev => ({
      ...prev,
      [tabId]: {
        pickerOpen: false,
        modalOpen: true,
        repoPath,
        repos: prev[tabId]?.repos ?? [],
      },
    }))
  }, [])

  const closeTabGitModal = useCallback((tabId: string) => {
    setGitUiByTab(prev => ({
      ...prev,
      [tabId]: {
        pickerOpen: false,
        modalOpen: false,
        repoPath: prev[tabId]?.repoPath ?? null,
        repos: prev[tabId]?.repos ?? [],
      },
    }))
  }, [])

  const closeTabGitPicker = useCallback((tabId: string) => {
    setGitUiByTab(prev => ({
      ...prev,
      [tabId]: {
        pickerOpen: false,
        modalOpen: prev[tabId]?.modalOpen ?? false,
        repoPath: prev[tabId]?.repoPath ?? null,
        repos: prev[tabId]?.repos ?? [],
      },
    }))
  }, [])

  /** Misma lógica para botón plano, ⌘G global y ⌘G en xterm. */
  const openTabGitPanel = useCallback(async (tabId: string) => {
    const current = gitUiByTabRef.current[tabId]
    if (current?.modalOpen) {
      closeTabGitModal(tabId)
      return
    }
    if (current?.pickerOpen) {
      closeTabGitPicker(tabId)
      return
    }
    const repos = await refreshTabGitRepos(tabId)
    if (repos.length === 0) return
    if (repos.length === 1) {
      openTabGitModal(tabId, repos[0]!.path)
      return
    }
    setGitUiByTab(prev => ({
      ...prev,
      [tabId]: {
        pickerOpen: true,
        modalOpen: false,
        repoPath: prev[tabId]?.repoPath ?? null,
        repos,
      },
    }))
  }, [closeTabGitModal, closeTabGitPicker, openTabGitModal, refreshTabGitRepos])

  const handleTabGitButtonClick = useCallback((tabId: string) => {
    void openTabGitPanel(tabId)
  }, [openTabGitPanel])

  const handleSelectGitRepo = useCallback((tabId: string, path: string) => {
    closeTabGitPicker(tabId)
    openTabGitModal(tabId, path)
  }, [closeTabGitPicker, openTabGitModal])

  // Refresca lista de repos cuando cambia la carpeta de proyecto.
  useEffect(() => {
    for (const tab of tabs) {
      const folder = tab.projectFolder?.trim() ?? ''
      if (!folder) {
        setGitUiByTab(prev => {
          if (!prev[tab.id]?.repos.length && !prev[tab.id]?.pickerOpen && !prev[tab.id]?.modalOpen) {
            return prev
          }
          return {
            ...prev,
            [tab.id]: {
              pickerOpen: false,
              modalOpen: false,
              repoPath: null,
              repos: [],
            },
          }
        })
        continue
      }
      void refreshTabGitRepos(tab.id)
    }
  }, [projectFolderKey, refreshTabGitRepos])

  // Descubre los repos git del root folder de cada tab, para la lista bajo el composer del plano.
  const refreshPlaneGitRepos = useCallback(async () => {
    for (const tab of tabsRef.current) {
      const folder = tab.projectFolder?.trim()
      if (!folder) {
        setGitReposByTab(prev => (prev[tab.id]?.length ? { ...prev, [tab.id]: [] } : prev))
        continue
      }
      try {
        const repos = await window.api.gitCollectUniqueRepos([folder])
        setGitReposByTab(prev => ({ ...prev, [tab.id]: repos }))
      } catch {
        // Fallo transitorio de IPC: mantiene la lista previa en vez de vaciarla.
      }
    }
  }, [])

  useEffect(() => {
    void refreshPlaneGitRepos()
    // Poda tabs cerrados: solo síncrono sobre ids vigentes, no interfiere con los sets async.
    const liveIds = new Set(tabs.map(item => item.id))
    setGitReposByTab(prev => {
      const next = {} as Record<string, GitListedRepo[]>
      let changed = false
      for (const id of Object.keys(prev)) {
        if (liveIds.has(id)) next[id] = prev[id]!
        else changed = true
      }
      return changed ? next : prev
    })
  }, [projectFolderKey, refreshPlaneGitRepos])

  // El disco cambia fuera de la app (borrar/clonar repos): revalida al recuperar el foco.
  useEffect(() => {
    const onFocus = (): void => { void refreshPlaneGitRepos() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshPlaneGitRepos])

  const revealTabExplorerFile = useCallback((tabId: string, relPath: string) => {
    const tab = tabsRef.current.find(item => item.id === tabId)
    const sessionId = tab ? resolveTabExplorerSessionId(tab) : null
    if (!tab || !sessionId) return
    const projectFolder = tab.projectFolder?.trim() || ''
    const current = explorerByTabRef.current[tabId] ?? DEFAULT_FILE_EXPLORER_STATE
    if (!current.open) {
      setTabs(prev => {
        const nextTabs = prev.map(item => {
          if (item.id !== tabId || item.paneIds.length === 0) return item
          const ensured = ensureTabPaneLayout(item)
          const paneWindows = { ...(ensured.paneWindows ?? {}) }
          minimizeOtherPaneWindows(item.paneIds, paneWindows, '')
          return { ...ensured, paneWindows }
        })
        tabsRef.current = nextTabs
        return nextTabs
      })
      if (projectFolder) {
        void window.api.fileExplorerSetRoot(sessionId, projectFolder)
      }
    }
    patchTabExplorer(tabId, {
      open: true,
      selectedRelPath: relPath,
      selectedIsDirectory: false,
      openedRelPath: relPath,
    })
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        tabExplorerHostByTabRef.current.get(tabId)?.expandParents(relPath)
      })
    })
  }, [patchTabExplorer])

  const handleAddTab = useCallback(() => {
    const cat = orgWorkspaceCatalogRef.current
    if (catalogHasWorkspaces(cat)) {
      setOrgWorkspacePickerOpen(true)
      return
    }
    if (cat === null) {
      void loadOrgWorkspaceCatalog(false)
    }
    const tab = newTab(t('tabs.defaultTitle', { n: ++tabCounter }))
    setExplorerByTab(prev => {
      const next = { ...prev, [tab.id]: { ...DEFAULT_FILE_EXPLORER_STATE } }
      explorerByTabRef.current = next
      return next
    })
    setTabs(prev => [...prev, tab])
    setActiveTabId(tab.id)
  }, [t, loadOrgWorkspaceCatalog])

  const handleOrgWorkspacesMutated = useCallback(() => {
    void loadOrgWorkspaceCatalog(true)
  }, [loadOrgWorkspaceCatalog])

  const handleOrgWorkspaceTabConfirm = useCallback(async (selection: OrgWorkspaceSelection) => {
    setOrgWorkspacePickerOpen(false)

    if (!selection.orgWorkspace) {
      const title = t('tabs.defaultTitle', { n: ++tabCounter })
      const tab = newTab(title)
      setExplorerByTab(prev => {
        const next = { ...prev, [tab.id]: { ...DEFAULT_FILE_EXPLORER_STATE } }
        explorerByTabRef.current = next
        return next
      })
      setTabs(prev => [...prev, tab])
      setActiveTabId(tab.id)
      return
    }

    const org = selection.orgWorkspace
    const cfg = await window.api.getConfig()
    const missingFolder = !cfg.defaultWorkspacesDir?.trim()
    const missingToken = !cfg.githubToken?.trim()
    if (missingFolder || missingToken) {
      setOrgWorkspaceRequirement({ missingFolder, missingToken })
      return
    }

    const workspaceSlug = sanitizeSlugSegment(org.name || org.workspaceId)
      || sanitizeSlugSegment(org.workspaceId)
    setOrgWorkspaceRequirement({ cloning: true })

    const covenant = getCovenantApi()
    let repos: Array<{ repoFullName: string; cloneUrl: string; folderName?: string }> = []
    if (covenant && hasCovenantWorkspaceReposApi(covenant)) {
      const reposResult = await covenant.workspaceReposList(org.slug, org.workspaceId)
      if (reposResult.ok) {
        repos = reposResult.data.map(r => ({
          repoFullName: r.repoFullName,
          cloneUrl: r.cloneUrl,
          ...(r.folderName?.trim() ? { folderName: r.folderName.trim() } : {}),
        }))
      }
    }

    const res = await (covenant?.cloneOrgWorkspace
      ? covenant.cloneOrgWorkspace({
          orgSlug: org.slug,
          workspaceSlug,
          repos,
        })
      : Promise.resolve({
          ok: false as const,
          error: 'clone unavailable',
          failure: undefined,
        }))
    if (!res.ok) {
      if (res.error === 'missing-default-dir') {
        setOrgWorkspaceRequirement({ missingFolder: true })
      } else if (res.error === 'missing-token') {
        setOrgWorkspaceRequirement({ missingToken: true })
      } else {
        setOrgWorkspaceRequirement({ cloneError: res.error, cloneFailure: res.failure })
      }
      return
    }

    setOrgWorkspaceRequirement(null)
    const title = org.name?.trim() || t('tabs.defaultTitle', { n: ++tabCounter })
    const tab = newTab(title)
    tab.titleLocked = true
    tab.projectFolder = res.workspaceDir
    tab.orgWorkspace = {
      slug: org.slug,
      workspaceId: org.workspaceId,
      localDir: res.workspaceDir,
    }
    setExplorerByTab(prev => {
      const next = { ...prev, [tab.id]: { ...DEFAULT_FILE_EXPLORER_STATE } }
      explorerByTabRef.current = next
      return next
    })
    setTabs(prev => [...prev, tab])
    setActiveTabId(tab.id)

    if (covenant && hasCovenantWorkspaceContentApi(covenant)) {
      setOrgWorkspaceRequirement({ syncing: true })
      try {
        await syncOrgWorkspaceContent(org.slug, org.workspaceId, [tab.id], { wipeLocal: false })
      } finally {
        setOrgWorkspaceRequirement(prev => (prev?.syncing ? null : prev))
      }
    } else if (selection.agents.length || selection.contexts.length) {
      const cwd = res.workspaceDir
      for (const definition of selection.agents) {
        const written = await window.api.upsertProjectAgent(cwd, definition)
        if (written.ok) rememberProjectAgent(cwd, written.agent)
      }
      for (const context of selection.contexts) {
        await window.api.materializeTabContext({ context, cwd })
      }
      const agents = await refreshAndSyncProjectAgents(cwd, tab.id)
      const discovered = await window.api.discoverTabContexts({ cwd })
      if (discovered.ok) {
        setTabContextsByTab(prev => ({ ...prev, [tab.id]: discovered.contexts }))
      }
      if (agents.length) {
        queueMicrotask(() => syncTabWithProjectAgents(tab.id, agents))
      }
    }
  }, [refreshAndSyncProjectAgents, rememberProjectAgent, syncOrgWorkspaceContent, syncTabWithProjectAgents, t])

  const handleResyncOrgWorkspace = useCallback(async (tab: TabSession) => {
    const org = tab.orgWorkspace
    if (!org?.slug?.trim() || !org.workspaceId?.trim()) return
    const covenant = getCovenantApi()
    if (!covenant) return

    setResyncingWorkspaceTabs(prev => {
      const next = new Set(prev)
      next.add(tab.id)
      return next
    })
    setOrgWorkspaceRequirement({ syncing: true })
    try {
      try {
        if (
          hasCovenantWorkspaceReposApi(covenant)
          && typeof covenant.cloneOrgWorkspace === 'function'
        ) {
          const localDir = tab.projectFolder?.trim() || org.localDir?.trim() || ''
          if (localDir) {
            const reposResult = await covenant.workspaceReposList(org.slug, org.workspaceId)
            if (reposResult.ok && reposResult.data.length) {
              await covenant.cloneOrgWorkspace({
                orgSlug: org.slug,
                workspaceSlug: sanitizeSlugSegment(org.workspaceId),
                repos: reposResult.data.map(x => ({
                  repoFullName: x.repoFullName,
                  cloneUrl: x.cloneUrl,
                  ...(x.folderName?.trim() ? { folderName: x.folderName.trim() } : {}),
                })),
                workspaceDir: localDir,
              })
            }
          }
        }
      } catch (err) {
        console.warn('[resync repos]', org.slug, org.workspaceId, err)
      }

      try {
        await syncOrgWorkspaceContent(org.slug, org.workspaceId, [tab.id], { wipeLocal: true })
      } catch (err) {
        console.warn('[resync agents/contexts]', org.slug, org.workspaceId, err)
        setOrgWorkspaceRequirement(prev => prev ?? {
          agentUpdateError: err instanceof Error ? err.message : 'resync failed',
        })
      }
    } finally {
      setOrgWorkspaceRequirement(prev => (prev?.syncing ? null : prev))
      setResyncingWorkspaceTabs(prev => {
        const next = new Set(prev)
        next.delete(tab.id)
        return next
      })
    }
  }, [syncOrgWorkspaceContent])
  resyncOrgWorkspaceRef.current = handleResyncOrgWorkspace

  const handleUploadOrgWorkspace = useCallback(async (tab: TabSession) => {
    const org = tab.orgWorkspace
    if (!org?.slug?.trim() || !org.workspaceId?.trim()) return
    const entry = findOrgWorkspaceCatalogEntry(
      orgWorkspaceCatalogRef.current,
      org.slug,
      org.workspaceId,
    )
    if (!canUploadOrgWorkspaceChanges(entry?.canRename)) return
    const cwd = tab.projectFolder?.trim() || org.localDir?.trim() || ''
    if (!cwd) {
      setOrgWorkspaceRequirement({ uploadError: 'missing project folder' })
      return
    }
    const covenant = getCovenantApi()
    if (!covenant || !hasCovenantWorkspaceContentApi(covenant)) {
      setOrgWorkspaceRequirement({ uploadError: 'Covenant API unavailable' })
      return
    }

    setUploadingWorkspaceTabs(prev => {
      const next = new Set(prev)
      next.add(tab.id)
      return next
    })
    setOrgWorkspaceRequirement({ uploading: true })
    try {
      const deps: OrgWorkspaceMaterializeDeps = {
        listRemoteAgents: () => retryCovenantResult(
          () => covenant.workspaceAgentsList(org.slug, org.workspaceId),
        ),
        listRemoteContexts: () => retryCovenantResult(
          () => covenant.workspaceContextsList(org.slug, org.workspaceId),
        ),
        listLocalAgents: root => window.api.listProjectAgents(root),
        upsertLocalAgent: async (root, definition) => {
          const written = await window.api.upsertProjectAgent(root, definition)
          return written.ok
            ? { ok: true, agent: written.agent }
            : { ok: false, error: written.error }
        },
        deleteLocalAgent: (root, agentId) => window.api.deleteProjectAgent(root, agentId),
        discoverLocalContexts: async root => {
          const result = await window.api.discoverTabContexts({ cwd: root })
          return result.ok
            ? { ok: true, contexts: result.contexts }
            : { ok: false, error: result.error }
        },
        deleteLocalContext: (context, root) => window.api.deleteTabContext({ context, cwd: root }),
        materializeLocalContext: async args => {
          const result = await window.api.materializeTabContext({
            context: args.context,
            cwd: args.cwd,
            ...(args.content !== undefined ? { content: args.content } : {}),
          })
          return result.ok
            ? { ok: true, notesContent: result.notesContent }
            : { ok: false, error: result.error }
        },
        previewLocalContext: async args => {
          const result = await window.api.previewTabContext({
            context: args.context,
            cwd: args.cwd,
          })
          return result.ok
            ? { ok: true, notesContent: result.notesContent }
            : { ok: false, error: result.error }
        },
        upsertRemoteAgent: (agentId, definition) => (
          covenant.workspaceAgentUpsert(org.slug, org.workspaceId, agentId, definition)
        ),
        deleteRemoteAgent: agentId => (
          covenant.workspaceAgentDelete(org.slug, org.workspaceId, agentId)
        ),
        upsertRemoteContext: (contextId, payload) => (
          covenant.workspaceContextUpsert(org.slug, org.workspaceId, contextId, payload)
        ),
        deleteRemoteContext: contextId => (
          covenant.workspaceContextDelete(org.slug, org.workspaceId, contextId)
        ),
      }
      const orderedAgentIds = orderedAgentIdsFromTab(tab)
      const result = await uploadOrgWorkspaceFromLocal(cwd, deps, {
        ...(orderedAgentIds.length ? { orderedAgentIds } : {}),
      })
      if (!result.ok) {
        setOrgWorkspaceRequirement({ uploadError: result.error ?? 'upload failed' })
        return
      }
      setOrgWorkspaceRequirement(null)
    } catch (err) {
      setOrgWorkspaceRequirement({
        uploadError: err instanceof Error ? err.message : 'upload failed',
      })
    } finally {
      setUploadingWorkspaceTabs(prev => {
        const next = new Set(prev)
        next.delete(tab.id)
        return next
      })
    }
  }, [])

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
      setExplorerByTab(ex => {
        if (!(tabId in ex)) return ex
        const next = { ...ex }
        delete next[tabId]
        explorerByTabRef.current = next
        return next
      })
      tabExplorerHostByTabRef.current.delete(tabId)
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
    const agentBinding = t.agentByPane?.[paneId]
    const agentId = agentBinding?.agentId
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
      const paneTitles = setPaneTitle(tab.paneTitles, paneId, '')
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
        paneTitles,
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
    // QA fix: no dejar worktrees/ramas huérfanos si se cierra el orquestador o el pane
    // especialista que estaba ejecutando una delegación en un worktree dedicado.
    void cleanupWorktreesForPane(paneId)
    setTimeout(() => {
      window.api.deleteScrollback(paneId)
      window.api.deleteAiChat(paneId)
      window.api.deleteCmdHistory(paneId)
      window.api.deleteInteractionsLog(paneId)
      window.api.deleteAgentChat(paneId)
    }, 0)
  }, [cleanupWorktreesForPane])

  const handlePickProjectFolder = useCallback(async (tabId: string): Promise<string | null> => {
    const tab = tabsRef.current.find(t => t.id === tabId)
    const result = await window.api.selectDirectory({
      title: t('tabs.projectFolderDialogTitle'),
      defaultPath: tab?.projectFolder?.trim() || undefined,
    })
    if (!result.ok) return null
    const path = result.path.trim()
    if (!path) return null

    const org = tab?.orgWorkspace
    const orgSlug = org?.slug?.trim() ?? ''
    const workspaceId = org?.workspaceId?.trim() ?? ''
    const isOrgBacked = Boolean(orgSlug && workspaceId)
    const previousLocalDir = org?.localDir?.trim() || ''

    if (isOrgBacked && org && path !== previousLocalDir) {
      const workspaceSlug = sanitizeSlugSegment(workspaceId)
      setOrgWorkspaceRequirement({ cloning: true })
      const covenant = getCovenantApi()
      let repos: Array<{ repoFullName: string; cloneUrl: string; folderName?: string }> = []
      if (covenant && hasCovenantWorkspaceReposApi(covenant)) {
        const reposResult = await covenant.workspaceReposList(orgSlug, workspaceId)
        if (reposResult.ok) {
          repos = reposResult.data.map(r => ({
            repoFullName: r.repoFullName,
            cloneUrl: r.cloneUrl,
            ...(r.folderName?.trim() ? { folderName: r.folderName.trim() } : {}),
          }))
        }
      }
      const res = await (covenant?.cloneOrgWorkspace
        ? covenant.cloneOrgWorkspace({
            orgSlug,
            workspaceSlug,
            repos,
            workspaceDir: path,
          })
        : Promise.resolve({
            ok: false as const,
            error: 'clone unavailable',
            failure: undefined,
          }))
      if (!res.ok) {
        if (res.error === 'missing-default-dir') {
          setOrgWorkspaceRequirement({ missingFolder: true })
        } else if (res.error === 'missing-token') {
          setOrgWorkspaceRequirement({ missingToken: true })
        } else {
          setOrgWorkspaceRequirement({ cloneError: res.error, cloneFailure: res.failure })
        }
        return null
      }
      setOrgWorkspaceRequirement(null)

      const next = tabsRef.current.map(t => (
        t.id === tabId
          ? {
              ...t,
              projectFolder: path,
              orgWorkspace: {
                slug: orgSlug,
                workspaceId,
                localDir: path,
              },
            }
          : t
      ))
      tabsRef.current = next
      setTabs(next)

      const explorerOpen = (explorerByTabRef.current[tabId] ?? DEFAULT_FILE_EXPLORER_STATE).open
      const updatedTab = next.find(item => item.id === tabId)
      const explorerSessionId = updatedTab ? resolveTabExplorerSessionId(updatedTab) : null
      if (explorerOpen && explorerSessionId) {
        void window.api.fileExplorerSetRoot(explorerSessionId, path)
      }

      await saveSessionNow()

      if (covenant && hasCovenantWorkspaceContentApi(covenant)) {
        setOrgWorkspaceRequirement({ syncing: true })
        try {
          await syncOrgWorkspaceContent(orgSlug, workspaceId, [tabId], { wipeLocal: false })
        } finally {
          setOrgWorkspaceRequirement(prev => (prev?.syncing ? null : prev))
        }
      }
      return path
    }

    const previousCwd = tab?.projectFolder?.trim() || ''
    const next = tabsRef.current.map(t => (t.id === tabId ? { ...t, projectFolder: path } : t))
    tabsRef.current = next
    setTabs(next)

    // Si el explorador está abierto, reanclar su raíz al nuevo projectFolder.
    const explorerOpen = (explorerByTabRef.current[tabId] ?? DEFAULT_FILE_EXPLORER_STATE).open
    const updatedTab = next.find(item => item.id === tabId)
    const explorerSessionId = updatedTab ? resolveTabExplorerSessionId(updatedTab) : null
    if (explorerOpen && explorerSessionId) {
      void window.api.fileExplorerSetRoot(explorerSessionId, path)
    }

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
  }, [refreshAndSyncProjectAgents, rememberProjectAgent, saveSessionNow, syncOrgWorkspaceContent, syncTabWithProjectAgents, t])

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
    name: string,
  ) => {
    const current = tabsRef.current.find(tab => tab.id === tabId)
    if (!current || current.paneIds.length >= MAX_PANES_PER_TAB) return
    const cwd = current.projectFolder?.trim() || ''
    const catalogKey = tabAgentCatalogKey(current)
    if (!cwd) return
    const existing = new Set(
      (projectAgentsByCwdRef.current[catalogKey] ?? []).map(agent => agent.id),
    )
    const definition = buildNewProjectAgentDefinition(provider, name, existing)
    const written = await window.api.upsertProjectAgent(cwd, definition)
    if (!written.ok) return
    const agent = written.agent
    rememberProjectAgent(catalogKey, agent)
    await window.api.ensureAiAgentResults({
      cwd,
      agentId: agent.id,
      agentName: agent.name ?? name.trim(),
    })
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
          [paneId]: { agentId: agent.id },
        },
      })
    }))
    scheduleSaveSession()
  }, [rememberPaneCwd, rememberProjectAgent, scheduleSaveSession])

  const bootstrapProjectAgents = useCallback(async (tabId: string) => {
    const current = tabsRef.current.find(tab => tab.id === tabId)
    if (!current) return
    const cwd = current.projectFolder?.trim() || ''
    const catalogKey = tabAgentCatalogKey(current)
    if (!cwd) return
    const catalog = projectAgentsByCwdRef.current[catalogKey] ?? []
    if (catalog.length > 0) return
    const hasAgentPane = (current.paneIds ?? []).some(
      paneId => current.paneKinds?.[paneId] === 'agent',
    )
    if (hasAgentPane) return

    const room = MAX_PANES_PER_TAB - current.paneIds.length
    if (room <= 0) return

    const existing = new Set(catalog.map(agent => agent.id))
    const definitions = buildBootstrapProjectAgentDefinitions('cursor', existing)
      .slice(0, room)

    for (const definition of definitions) {
      const tabNow = tabsRef.current.find(tab => tab.id === tabId)
      if (!tabNow || tabNow.paneIds.length >= MAX_PANES_PER_TAB) break

      const written = await window.api.upsertProjectAgent(cwd, definition)
      if (!written.ok) continue
      const agent = written.agent
      rememberProjectAgent(catalogKey, agent)
      await window.api.ensureAiAgentResults({
        cwd,
        agentId: agent.id,
        agentName: agent.name ?? definition.name ?? agent.id,
      })

      const paneId = crypto.randomUUID()
      rememberPaneCwd(paneId, cwd)
      setTabs(prev => prev.map(tab => {
        if (tab.id !== tabId || tab.paneIds.length >= MAX_PANES_PER_TAB) return tab
        const paneWindows = { ...(tab.paneWindows ?? {}) }
        paneWindows[paneId] = createPaneWindowState(paneWindows, false)
        const paneKinds: Record<string, PaneKind> = {
          ...(tab.paneKinds ?? {}),
          [paneId]: 'agent',
        }
        return normalizeTabSession({
          ...tab,
          paneIds: [...tab.paneIds, paneId],
          activePaneId: paneId,
          paneKinds,
          paneWindows,
          agentByPane: {
            ...(tab.agentByPane ?? {}),
            [paneId]: { agentId: agent.id },
          },
        })
      }))
    }
    scheduleSaveSession()
    void refreshAndSyncProjectAgents(cwd, tabId)
  }, [
    rememberPaneCwd,
    rememberProjectAgent,
    refreshAndSyncProjectAgents,
    scheduleSaveSession,
  ])

  /** Nuevo agente con la misma configuración (sin historial / sesión CLI). */
  const handleDuplicateAgentPane = useCallback(async (
    tabId: string,
    sourcePaneId: string,
  ) => {
    const current = tabsRef.current.find(tab => tab.id === tabId)
    if (!current || current.paneIds.length >= MAX_PANES_PER_TAB) return
    if (current.paneKinds?.[sourcePaneId] !== 'agent') return
    const cwd = current.projectFolder?.trim() || ''
    const catalogKey = tabAgentCatalogKey(current)
    if (!cwd) return
    const sourceMeta = resolveTabAgentMeta(current, sourcePaneId, projectAgentsByCwdRef.current)
    const existing = new Set(
      (projectAgentsByCwdRef.current[catalogKey] ?? []).map(agent => agent.id),
    )
    const clonedFields = cloneProjectAgentDefinition(
      sourceMeta,
      i18next.t('agentPane.duplicateNameSuffix'),
    )
    const agentId = allocateAgentSlug(clonedFields.name ?? sourceMeta.id, existing)
    const definition = {
      ...clonedFields,
      id: agentId,
      ...(sourceMeta.localOnly === true ? { localOnly: true } : {}),
    }
    const written = await window.api.upsertProjectAgent(cwd, definition)
    if (!written.ok) return
    const agent = written.agent
    rememberProjectAgent(catalogKey, agent)
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
          [paneId]: {
            agentId: agent.id,
            ...(agent.localOnly === true ? { localOnly: true } : {}),
          },
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

  /** Abre el picker de proveedor si hay carpeta de proyecto o workspace org. */
  const requestAddAgent = useCallback((
    tabId: string,
    fromPaneId?: string,
  ): void => {
    const tab = tabsRef.current.find(item => item.id === tabId)
    if (!tab || tab.paneIds.length >= MAX_PANES_PER_TAB) return
    const orgBacked = Boolean(tab.orgWorkspace?.slug?.trim() && tab.orgWorkspace?.workspaceId?.trim())
    if (!tab.projectFolder?.trim() && !orgBacked) return
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
    closeTabExplorer(tabId)
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
  }, [closeTabExplorer, scheduleSaveSession])

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

  const handleRenamePane = useCallback((tabId: string, paneId: string, title: string) => {
    setTabs(prev => {
      const nextTabs = prev.map(tab => (
        tab.id !== tabId || !tab.paneIds.includes(paneId)
          ? tab
          : { ...tab, paneTitles: setPaneTitle(tab.paneTitles, paneId, title) }
      ))
      tabsRef.current = nextTabs
      return nextTabs
    })
    void saveSessionNow()
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
    closeTabExplorer(tabId)
    void saveSessionNow()
    requestAnimationFrame(() => {
      const tab = tabsRef.current.find(item => item.id === tabId)
      for (const paneId of tab?.paneIds ?? []) {
        termRefs.current.get(paneId)?.refit?.()
      }
    })
  }, [closeTabExplorer, saveSessionNow])

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
    if (explorerByTabRef.current[tabId]?.open) {
      closeTabExplorer(tabId)
    }
    void saveSessionNow()
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const tab = tabsRef.current.find(item => item.id === tabId)
        for (const id of tab?.paneIds ?? []) {
          termRefs.current.get(id)?.refit?.()
        }
      })
    })
  }, [closeTabExplorer, saveSessionNow])

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
      if (isAgentOwnResultContext(previous.id, contextId)) return previous
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
      if (selected.has(contextId)) {
        selected.delete(contextId)
      } else if (isAgentOwnResultContext(previous.id, contextId)) {
        return previous
      } else {
        selected.add(contextId)
      }
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
    setPlaneContextsFocusId(null)
    setPlaneContextsCreate(false)
    setPlaneContextsModalTabId(tabId)
  }, [])

  const handleCreateContextFromPlane = useCallback((tabId: string) => {
    setPlaneContextsFocusId(null)
    setPlaneContextsCreate(true)
    setPlaneContextsModalTabId(tabId)
  }, [])

  const handleOpenContextFromPlane = useCallback((tabId: string, contextId: string) => {
    setPlaneContextsCreate(false)
    setPlaneContextsModalTabId(tabId)
    setPlaneContextsFocusId(contextId)
  }, [])

  const handleDeleteContextFromPlane = useCallback(async (tabId: string, contextId: string) => {
    const tab = tabsRef.current.find(item => item.id === tabId)
    if (!tab) return
    const contexts = tabContextsByTabRef.current[tabId] ?? []
    const context = contexts.find(item => item.id === contextId)
    if (!context) return

    const cwd = tab.projectFolder?.trim() || ''
    if (!cwd) return
    const result = await window.api.deleteTabContext({ context, cwd })
    if (!result.ok) return

    const agentPaneIds = (tab.paneIds ?? []).filter(id => tab.paneKinds?.[id] === 'agent')
    for (const paneId of agentPaneIds) {
      handleAgentMetaChangeRef.current(tabId, paneId, previous => {
        const nextIds = (previous.contextIds ?? []).filter(id => id !== contextId)
        if (nextIds.length === (previous.contextIds ?? []).length) return previous
        return { ...previous, contextIds: nextIds }
      })
    }

    await refreshTabContexts(tabId)
  }, [refreshTabContexts])

  const handleAgentPlaneStatusChange = useCallback((paneId: string, status: AgentPlaneStatus) => {
    setAgentPlaneStatus(prev => {
      const previous = prev[paneId]
      if (
        previous
        && previous.busy === status.busy
        && previous.activity === status.activity
        && previous.lastSnippet === status.lastSnippet
        && previous.activeAssistantId === status.activeAssistantId
        && previous.awaitingDelegations === status.awaitingDelegations
        && previous.delegationWorkActive === status.delegationWorkActive
        && previous.orchestratorBusy === status.orchestratorBusy
        && previous.orchestrationWorkStyle === status.orchestrationWorkStyle
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
      if (
        previous?.busy
        && !status.busy
        && !status.awaitingDelegations
        && !status.localLoopActive
      ) {
        const pending = findPendingDelegationByToPane(
          orchestrationJobsByPaneRef.current,
          paneId,
        )
        if (pending && canReconcileIdlePending(pending.sawBusy)) {
          reconcileIdleDelegationTargetRef.current(paneId, status.lastSnippet)
        }
      }
      if (status.busy) {
        markPendingSawBusyForPane(orchestrationJobsByPaneRef.current, paneId)
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
            viaLoop: true,
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
      orchestrationJobId?: string
      delegation?: {
        id: string
        fromPaneId: string
        toAgentId: string
      }
    },
  ) => {
    // Follow-ups de jobs superseded/missing no deben llegar a preferSend.
    if (payload.orchestrationFollowUp === true) {
      const jobId = payload.orchestrationJobId?.trim()
      if (jobId) {
        const jobsMap = orchestrationJobsByPaneRef.current.get(paneId)
        const job = jobsMap?.get(jobId)
        if (!job || job.superseded) return
      }
    }
    const queue = orchestrationFifoByPaneRef.current.get(paneId) ?? []
    queue.push({
      text: payload.text,
      images: payload.images ?? [],
      focusPane: payload.focusPane,
      ...(payload.orchestrationFollowUp ? { orchestrationFollowUp: true } : {}),
      ...(payload.allowDelegations === false ? { allowDelegations: false } : {}),
      ...(payload.orchestrationJobId?.trim()
        ? { orchestrationJobId: payload.orchestrationJobId.trim() }
        : {}),
      ...(payload.delegation ? { delegation: payload.delegation } : {}),
    })
    orchestrationFifoByPaneRef.current.set(paneId, queue)
    setOrchestrationFifoTick(n => n + 1)
  }, [])

  const orchestrationWorkStyleForPane = useCallback((paneId: string, tabId?: string) => {
    const tab = tabId
      ? tabsRef.current.find(item => item.id === tabId)
      : tabsRef.current.find(item => (item.paneIds ?? []).includes(paneId))
    if (!tab || tab.paneKinds?.[paneId] !== 'agent') return resolveOrchestrationWorkStyle(undefined)
    const meta = resolveTabAgentMeta(tab, paneId, projectAgentsByCwdRef.current)
    return resolveOrchestrationWorkStyle(meta.coordination, meta.orchestrationWorkStyle)
  }, [])

  const getOrCreateJobsMap = useCallback((fromPaneId: string) => {
    let jobs = orchestrationJobsByPaneRef.current.get(fromPaneId)
    if (!jobs) {
      jobs = new Map()
      orchestrationJobsByPaneRef.current.set(fromPaneId, jobs)
    }
    return jobs
  }, [])

  const resolveActiveJob = useCallback((fromPaneId: string, jobId?: string): OrchestrationJob => {
    const jobs = getOrCreateJobsMap(fromPaneId)
    const wanted = resolveOrchestrationJobIdForTurn(
      jobId,
      activeOrchestrationJobByPaneRef.current.get(fromPaneId),
    )
    if (wanted && jobs.has(wanted)) {
      const existing = jobs.get(wanted)!
      activeOrchestrationJobByPaneRef.current.set(fromPaneId, existing.jobId)
      return existing
    }
    // Linear: a lo sumo un job; reutiliza el existente si hay uno.
    const workStyle = orchestrationWorkStyleForPane(fromPaneId)
    if (workStyle !== 'turbo' && jobs.size === 1) {
      const only = [...jobs.values()][0]!
      activeOrchestrationJobByPaneRef.current.set(fromPaneId, only.jobId)
      return only
    }
    const job = createOrchestrationJob(fromPaneId, wanted)
    jobs.set(job.jobId, job)
    activeOrchestrationJobByPaneRef.current.set(fromPaneId, job.jobId)
    return job
  }, [getOrCreateJobsMap, orchestrationWorkStyleForPane])

  // abortOrchestrationRun se asigna abajo; ref evita ciclo begin↔abort.
  const abortOrchestrationRunRef = useRef<((fromPaneId: string) => void) | null>(null)

  const beginOrchestrationUserTurn = useCallback((fromPaneId: string) => {
    const workStyle = orchestrationWorkStyleForPane(fromPaneId)
    if (shouldAbortOnHumanTurn(workStyle)) {
      // Linear: awaiting bloquea humanos hasta cerrar la ola; esto es cleanup seguro.
      const priorJobs = orchestrationJobsByPaneRef.current.get(fromPaneId)
      if (priorJobs) supersedeOrchestrationJobsForHumanTurn(priorJobs)
      abortOrchestrationRunRef.current?.(fromPaneId)
    }
    const jobs = getOrCreateJobsMap(fromPaneId)
    if (workStyle !== 'turbo') {
      jobs.clear()
    }
    const job = createOrchestrationJob(fromPaneId)
    jobs.set(job.jobId, job)
    activeOrchestrationJobByPaneRef.current.set(fromPaneId, job.jobId)
  }, [getOrCreateJobsMap, orchestrationWorkStyleForPane])

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

  const handleOrchestratorDelegations = useCallback(async (
    fromPaneId: string,
    tabId: string,
    delegations: DelegateRequest[],
    orchestrationJobId?: string,
  ) => {
    if (!delegations.length) return
    const maxRounds = orchestrationMaxRoundsForPane(fromPaneId, tabId)
    const workStyle = orchestrationWorkStyleForPane(fromPaneId, tabId)
    // Turbo: atar la ola al job del turno que emitió, no al “activo” del pane.
    const job = resolveActiveJob(fromPaneId, orchestrationJobId)
    const previousRounds = job.round
    const nextRound = previousRounds + 1
    job.round = nextRound
    job.hasDelegated = true
    if (!isOrchestrationRoundsUnlimited(maxRounds) && nextRound > maxRounds) {
      enqueueOrchestrationSend(fromPaneId, {
        text: formatDelegationRoundCapFollowUp(maxRounds),
        focusPane: false,
        orchestrationFollowUp: true,
        allowDelegations: false,
        orchestrationJobId: job.jobId,
      })
      return
    }

    let tab = tabsRef.current.find(item => item.id === tabId)
    if (!tab) return
    const fromMeta = resolveTabAgentMeta(tab, fromPaneId, projectAgentsByCwdRef.current)
    const allowExpertReplicas = fromMeta.allowExpertReplicas === true || workStyle === 'turbo'
    const pending = job.pending
    const occupiedPaneIds = occupiedPaneIdsAcrossJobs(getOrCreateJobsMap(fromPaneId).values())
    const waveItems = job.waveItems
    const catalogKey = tabAgentCatalogKey(tab)
    const orgWorkspace = tab.orgWorkspace
    const isOrgBacked = Boolean(orgWorkspace?.slug?.trim() && orgWorkspace?.workspaceId?.trim())
    const baseCwd = tab.projectFolder?.trim() || ''

    for (const delegation of delegations) {
      tab = tabsRef.current.find(item => item.id === tabId)
      if (!tab) break
      const currentTab = tab

      const panes = (currentTab.paneIds ?? [])
        .filter(id => currentTab.paneKinds?.[id] === 'agent')
        .map(paneId => ({
          paneId,
          meta: resolveTabAgentMeta(currentTab, paneId, projectAgentsByCwdRef.current),
        }))
      const targets = listDelegationTargetsForMeta(panes, fromMeta, fromPaneId)
      const existingAgentIds = new Set(
        (projectAgentsByCwdRef.current[catalogKey] ?? []).map(agent => agent.id),
      )
      const decision = resolveExpertDelegationTarget({
        toAgentId: delegation.toAgentId,
        allowExpertReplicas,
        targets,
        occupiedPaneIds,
        existingAgentIds,
      })

      let toPaneId: string | null = null
      let routedAgentId = delegation.toAgentId
      let baseAgentId: string | undefined

      if (decision.kind === 'fail') {
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
            continuousProductOwner: fromMeta.coordination === 'productOwner',
          }),
          focusPane: false,
          orchestrationFollowUp: true,
          orchestrationJobId: job.jobId,
          allowDelegations: !orchestrationRoundsAtCap(nextRound, maxRounds),
        })
        continue
      }

      // Flag OFF + pane ocupado: FIFO — no worktree ni send hasta liberar el pane.
      if (decision.kind === 'defer') {
        job.deferred.push({
          tabId,
          delegation,
          toPaneId: decision.paneId,
          toAgentId: decision.agentId,
        })
        occupiedPaneIds.add(decision.paneId)
        upsertOrchestrationWaveItem(job, {
          delegationId: delegation.id,
          toAgentId: decision.agentId,
          toPaneId: decision.paneId,
          status: 'running',
        })
        continue
      }

      if (decision.kind === 'reuse') {
        toPaneId = decision.paneId
        routedAgentId = decision.agentId
      } else {
        // Spawn réplica efímera del experto base (catálogo + pane). Al completar o
        // abortar se dispose la réplica (pane+catálogo+chat); nunca el experto base.
        baseAgentId = decision.baseAgentId
        if (tab.paneIds.length >= MAX_PANES_PER_TAB) {
          enqueueOrchestrationSend(fromPaneId, {
            text: formatDelegationResultFollowUp({
              id: delegation.id,
              status: 'fail',
              summary: `Cannot spawn expert replica for "${decision.baseAgentId}": pane limit reached.`,
              toAgentId: delegation.toAgentId,
            }, {
              round: nextRound,
              maxRounds,
              batchRemaining: 0,
              continuousProductOwner: fromMeta.coordination === 'productOwner',
            }),
            focusPane: false,
            orchestrationFollowUp: true,
            orchestrationJobId: job.jobId,
            allowDelegations: !orchestrationRoundsAtCap(nextRound, maxRounds),
          })
          continue
        }
        if (!baseCwd && !isOrgBacked) {
          enqueueOrchestrationSend(fromPaneId, {
            text: formatDelegationResultFollowUp({
              id: delegation.id,
              status: 'fail',
              summary: `Cannot spawn expert replica for "${decision.baseAgentId}": no project folder.`,
              toAgentId: delegation.toAgentId,
            }, {
              round: nextRound,
              maxRounds,
              batchRemaining: 0,
              continuousProductOwner: fromMeta.coordination === 'productOwner',
            }),
            focusPane: false,
            orchestrationFollowUp: true,
            orchestrationJobId: job.jobId,
            allowDelegations: !orchestrationRoundsAtCap(nextRound, maxRounds),
          })
          continue
        }

        const baseDef = (projectAgentsByCwdRef.current[catalogKey] ?? [])
          .find(agent => agent.id === decision.baseAgentId)
        if (!baseDef) {
          enqueueOrchestrationSend(fromPaneId, {
            text: formatDelegationResultFollowUp({
              id: delegation.id,
              status: 'fail',
              summary: `No catalog definition for expert "${decision.baseAgentId}".`,
              toAgentId: delegation.toAgentId,
            }, {
              round: nextRound,
              maxRounds,
              batchRemaining: 0,
              continuousProductOwner: fromMeta.coordination === 'productOwner',
            }),
            focusPane: false,
            orchestrationFollowUp: true,
            orchestrationJobId: job.jobId,
            allowDelegations: !orchestrationRoundsAtCap(nextRound, maxRounds),
          })
          continue
        }

        const replicaDefinition = buildExpertReplicaDefinition(baseDef, decision.preferredSlug)
        const definition = isOrgBacked
          ? { ...replicaDefinition, localOnly: true }
          : replicaDefinition
        let agent = definition
        if (baseCwd) {
          const written = await window.api.upsertProjectAgent(baseCwd, definition)
          if (!written.ok) {
            enqueueOrchestrationSend(fromPaneId, {
              text: formatDelegationResultFollowUp({
                id: delegation.id,
                status: 'fail',
                summary: `Failed to persist expert replica "${definition.id}".`,
                toAgentId: delegation.toAgentId,
              }, {
                round: nextRound,
                maxRounds,
                batchRemaining: 0,
                continuousProductOwner: fromMeta.coordination === 'productOwner',
              }),
              focusPane: false,
              orchestrationFollowUp: true,
              orchestrationJobId: job.jobId,
              allowDelegations: !orchestrationRoundsAtCap(nextRound, maxRounds),
            })
            continue
          }
          agent = written.agent
        }
        rememberProjectAgent(catalogKey, agent)
        if (baseCwd) {
          await window.api.ensureAiAgentResults({
            cwd: baseCwd,
            agentId: agent.id,
            agentName: agent.name ?? agent.id,
          })
        }

        const paneId = crypto.randomUUID()
        if (baseCwd) rememberPaneCwd(paneId, baseCwd)
        setTabs(prev => prev.map(item => {
          if (item.id !== tabId || item.paneIds.length >= MAX_PANES_PER_TAB) return item
          const paneWindows = { ...(item.paneWindows ?? {}) }
          paneWindows[paneId] = createPaneWindowState(paneWindows, false)
          const paneKinds: Record<string, PaneKind> = { ...(item.paneKinds ?? {}), [paneId]: 'agent' }
          return normalizeTabSession({
            ...item,
            paneIds: [...item.paneIds, paneId],
            paneKinds,
            paneWindows,
            agentByPane: {
              ...(item.agentByPane ?? {}),
              [paneId]: {
                agentId: agent.id,
                ...(agent.localOnly === true ? { localOnly: true } : {}),
              },
            },
          })
        }))
        scheduleSaveSession()
        toPaneId = paneId
        routedAgentId = agent.id
        // Refresh local tab snapshot after spawn.
        tab = tabsRef.current.find(item => item.id === tabId) ?? tab
      }

      if (!toPaneId) continue
      pending.set(delegation.id, {
        toPaneId,
        toAgentId: routedAgentId,
        ...(baseAgentId ? { baseAgentId } : {}),
      })
      occupiedPaneIds.add(toPaneId)
      upsertOrchestrationWaveItem(job, {
        delegationId: delegation.id,
        toAgentId: routedAgentId,
        toPaneId,
        ...(baseAgentId ? { baseAgentId } : {}),
        status: 'running',
      })

      // Contrato: TODA delegación (base o réplica) se aísla en worktree si hay repo+rama.
      // Fallback sin worktree solo cuando es imposible (no git / sin rama base).
      if (baseCwd) {
        let branchInfo = baseBranchByOrchestratorRef.current.get(fromPaneId)
        if (!branchInfo || branchInfo.baseCwd !== baseCwd) {
          const branchResult = await window.api.gitCurrentBranch({ path: baseCwd })
          branchInfo = {
            baseCwd,
            isGitRepo: branchResult.ok,
            baseBranch: branchResult.ok ? branchResult.branch : '',
          }
          baseBranchByOrchestratorRef.current.set(fromPaneId, branchInfo)
        }
        if (shouldUseWorktreeForDelegation({
          isGitRepo: branchInfo.isGitRepo,
          hasBaseBranch: branchInfo.baseBranch.trim() !== '',
        })) {
          const branch = worktreeBranchFor(delegation.id)
          const relPath = worktreeRelPathFor(tabId, delegation.id)
          const worktreePath = `${baseCwd.replace(/\/+$/, '')}/${relPath}`
          const addResult = await window.api.gitWorktreeAdd({ path: baseCwd }, {
            worktreePath,
            branch,
            fromRef: branchInfo.baseBranch,
          })
          if (addResult.ok) {
            setPaneCwdOverride(toPaneId, worktreePath)
            worktreesByDelegationRef.current.set(delegation.id, {
              fromPaneId,
              toPaneId,
              worktreePath,
              branch,
              baseCwd,
              baseBranch: branchInfo.baseBranch,
              ...(baseAgentId ? { baseAgentId } : {}),
            })
          } else {
            const detail = addResult.error || addResult.stderr || 'unknown error'
            console.error(
              `[worktree] gitWorktreeAdd falló para la delegación ${delegation.id}; aislamiento obligatorio:`,
              detail,
            )
            pending.delete(delegation.id)
            occupiedPaneIds.delete(toPaneId)
            const waveIdx = waveItems.findIndex(item => item.delegationId === delegation.id)
            if (waveIdx >= 0) waveItems.splice(waveIdx, 1)
            enqueueOrchestrationSend(fromPaneId, {
              text: formatDelegationResultFollowUp({
                id: delegation.id,
                status: 'fail',
                summary: `Worktree isolation failed for "${routedAgentId}": ${detail}`,
                toAgentId: routedAgentId,
              }, {
                round: nextRound,
                maxRounds,
                batchRemaining: 0,
                continuousProductOwner: fromMeta.coordination === 'productOwner',
              }),
              focusPane: false,
              orchestrationFollowUp: true,
              orchestrationJobId: job.jobId,
              allowDelegations: !orchestrationRoundsAtCap(nextRound, maxRounds),
            })
            continue
          }
        }
      }

      const contextHint = delegation.contextIds?.length
        ? `\n\nPreferred context ids: ${delegation.contextIds.join(', ')}`
        : ''
      enqueueOrchestrationSend(toPaneId, {
        text: `${delegation.objective}${contextHint}`,
        focusPane: false,
        delegation: {
          id: delegation.id,
          fromPaneId,
          toAgentId: routedAgentId,
        },
      })
    }
    syncAwaitingFromPending()
  }, [
    enqueueOrchestrationSend,
    getOrCreateJobsMap,
    orchestrationMaxRoundsForPane,
    orchestrationWorkStyleForPane,
    rememberPaneCwd,
    rememberProjectAgent,
    resolveActiveJob,
    scheduleSaveSession,
    setPaneCwdOverride,
    syncAwaitingFromPending,
  ])

  /**
   * Arranca la siguiente delegación diferida (FIFO) para un pane recién liberado.
   * Un pane = un worktree activo: nunca encola send ni add si el pane sigue occupied.
   * Turbo: busca deferred en todos los jobs del orquestador.
   */
  const startNextDeferredForPane = useCallback(async (
    fromPaneId: string,
    freedPaneId: string,
  ): Promise<boolean> => {
    const jobsMap = orchestrationJobsByPaneRef.current.get(fromPaneId)
    if (!jobsMap?.size) return false
    const occupied = occupiedPaneIdsAcrossJobs(jobsMap.values())
    if (occupied.has(freedPaneId)) return false

    let job: OrchestrationJob | undefined
    let index = -1
    for (const candidate of jobsMap.values()) {
      const idx = candidate.deferred.findIndex(item => item.toPaneId === freedPaneId)
      if (idx >= 0) {
        job = candidate
        index = idx
        break
      }
    }
    if (!job || index < 0) return false
    const [next] = job.deferred.splice(index, 1)
    if (!next) return false

    const tab = tabsRef.current.find(item => item.id === next.tabId)
    const baseCwd = tab?.projectFolder?.trim() || ''
    job.pending.set(next.delegation.id, {
      toPaneId: next.toPaneId,
      toAgentId: next.toAgentId,
      ...(next.baseAgentId ? { baseAgentId: next.baseAgentId } : {}),
    })
    upsertOrchestrationWaveItem(job, {
      delegationId: next.delegation.id,
      toAgentId: next.toAgentId,
      toPaneId: next.toPaneId,
      ...(next.baseAgentId ? { baseAgentId: next.baseAgentId } : {}),
      status: 'running',
    })

    if (baseCwd) {
      let branchInfo = baseBranchByOrchestratorRef.current.get(fromPaneId)
      if (!branchInfo || branchInfo.baseCwd !== baseCwd) {
        const branchResult = await window.api.gitCurrentBranch({ path: baseCwd })
        branchInfo = {
          baseCwd,
          isGitRepo: branchResult.ok,
          baseBranch: branchResult.ok ? branchResult.branch : '',
        }
        baseBranchByOrchestratorRef.current.set(fromPaneId, branchInfo)
      }
      if (shouldUseWorktreeForDelegation({
        isGitRepo: branchInfo.isGitRepo,
        hasBaseBranch: branchInfo.baseBranch.trim() !== '',
      })) {
        const branch = worktreeBranchFor(next.delegation.id)
        const relPath = worktreeRelPathFor(next.tabId, next.delegation.id)
        const worktreePath = `${baseCwd.replace(/\/+$/, '')}/${relPath}`
        const addResult = await window.api.gitWorktreeAdd({ path: baseCwd }, {
          worktreePath,
          branch,
          fromRef: branchInfo.baseBranch,
        })
        if (addResult.ok) {
          setPaneCwdOverride(next.toPaneId, worktreePath)
          worktreesByDelegationRef.current.set(next.delegation.id, {
            fromPaneId,
            toPaneId: next.toPaneId,
            worktreePath,
            branch,
            baseCwd,
            baseBranch: branchInfo.baseBranch,
          })
        } else {
          const detail = addResult.error || addResult.stderr || 'unknown error'
          console.error(
            `[worktree] gitWorktreeAdd falló para delegación diferida ${next.delegation.id}:`,
            detail,
          )
          job.pending.delete(next.delegation.id)
          const waveIdx = job.waveItems.findIndex(item => item.delegationId === next.delegation.id)
          if (waveIdx >= 0) job.waveItems.splice(waveIdx, 1)
          const maxRounds = orchestrationMaxRoundsForPane(fromPaneId, next.tabId)
          const round = job.round || 1
          enqueueOrchestrationSend(fromPaneId, {
            text: formatDelegationResultFollowUp({
              id: next.delegation.id,
              status: 'fail',
              summary: `Worktree isolation failed for "${next.toAgentId}": ${detail}`,
              toAgentId: next.toAgentId,
            }, {
              round,
              maxRounds,
              batchRemaining: 0,
              orchestrationJobId: job.jobId,
              workStyle: orchestrationWorkStyleForPane(fromPaneId, next.tabId),
            }),
            focusPane: false,
            orchestrationFollowUp: true,
            orchestrationJobId: job.jobId,
            allowDelegations: !orchestrationRoundsAtCap(round, maxRounds),
          })
          syncAwaitingFromPending()
          return startNextDeferredForPane(fromPaneId, freedPaneId)
        }
      }
    }

    const contextHint = next.delegation.contextIds?.length
      ? `\n\nPreferred context ids: ${next.delegation.contextIds.join(', ')}`
      : ''
    enqueueOrchestrationSend(next.toPaneId, {
      text: `${next.delegation.objective}${contextHint}`,
      focusPane: false,
      delegation: {
        id: next.delegation.id,
        fromPaneId,
        toAgentId: next.toAgentId,
      },
    })
    syncAwaitingFromPending()
    return true
  }, [
    enqueueOrchestrationSend,
    orchestrationMaxRoundsForPane,
    orchestrationWorkStyleForPane,
    setPaneCwdOverride,
    syncAwaitingFromPending,
  ])

  /**
   * Fase 4: al completarse una delegación que usó un worktree dedicado, comitea el
   * trabajo del especialista y mergea a la rama base. Los merges (y su commit previo)
   * se serializan por orquestador (fromPaneId) encadenando promesas en
   * mergeQueueByOrchestratorRef — la entrada se registra de forma SÍNCRONA (antes de
   * cualquier await) para que el wake en handleDelegationTurnComplete pueda esperarla
   * de forma fiable aunque no se haga `await` sobre esta llamada. En conflicto: aborta
   * el merge, re-encola la delegación como pendiente y pide al especialista resolver en
   * el worktree (que se conserva para el reintento). En éxito: limpia el override de cwd
   * y borra el worktree. Devuelve la promesa encadenada (para integrarla en el wake).
   */
  const finalizeDelegationWorktree = useCallback((
    fromPaneId: string,
    result: DelegateResult,
    info: {
      toPaneId: string
      worktreePath: string
      branch: string
      baseCwd: string
      baseBranch: string
      baseAgentId?: string
    },
  ): Promise<void> => {
    const previousOp = mergeQueueByOrchestratorRef.current.get(fromPaneId) ?? Promise.resolve()
    const chainedOp = previousOp.catch(() => {}).then(async () => {
      const tab = tabsRef.current.find(item => (item.paneIds ?? []).includes(fromPaneId))
      const fromMeta = tab
        ? resolveTabAgentMeta(tab, fromPaneId, projectAgentsByCwdRef.current)
        : undefined
      const objectiveFirstLine = (result.summary || '').split(/\r?\n/)[0] || ''
      const commitMessage = buildMergeCommitMessage({
        agentId: fromMeta?.id || '',
        toAgentId: result.toAgentId,
        objectiveFirstLine,
        delegationId: result.id,
      })

      await window.api.gitStageAll({ path: info.worktreePath })
      // El commit del worktree es trabajo del agente delegado, no de la persona:
      // se le atribuye a él para que aparezca en su fila del roster de Pulse.
      const commitResult = await window.api.gitCommit({ path: info.worktreePath }, commitMessage, {
        ...(result.toAgentId ? { agentId: result.toAgentId } : {}),
        ...(pulseWorkspaceTag(tab?.orgWorkspace) ? { workspace: pulseWorkspaceTag(tab?.orgWorkspace)! } : {}),
      })
      if (!commitResult.ok && !/nothing to commit/i.test(commitResult.stderr || '')) {
        console.warn(`[worktree] gitCommit falló para la delegación ${result.id}:`, commitResult.stderr)
      }

      const mergeResult = await window.api.gitWorktreeMerge({ path: info.baseCwd }, {
        branch: info.branch,
        message: commitMessage,
      })
      if (mergeResult.conflicted) {
        await window.api.gitWorktreeAbortMerge({ path: info.baseCwd })
        // Deja el worktree intacto para el reintento y re-encola la delegación como pendiente.
        const jobsMap = orchestrationJobsByPaneRef.current.get(fromPaneId)
        const job = jobsMap
          ? findJobByDelegation(jobsMap.values(), result.id) ?? [...jobsMap.values()][0]
          : undefined
        if (job) {
          job.pending.set(result.id, {
            toPaneId: info.toPaneId,
            toAgentId: result.toAgentId ?? '',
            ...(info.baseAgentId ? { baseAgentId: info.baseAgentId } : {}),
          })
        }
        syncAwaitingFromPending()
        enqueueOrchestrationSend(info.toPaneId, {
          text: buildConflictFollowUp({ conflictFiles: mergeResult.conflictFiles, branch: info.branch }),
          focusPane: false,
          delegation: { id: result.id, fromPaneId, toAgentId: result.toAgentId ?? '' },
        })
        return
      }
      if (!mergeResult.ok) {
        console.warn(`[worktree] gitWorktreeMerge falló para la delegación ${result.id}:`, mergeResult.stderr)
        return
      }
      clearPaneCwdOverride(info.toPaneId)
      await window.api.gitWorktreeRemove({ path: info.baseCwd }, {
        worktreePath: info.worktreePath,
        branch: info.branch,
        force: true,
      })
      worktreesByDelegationRef.current.delete(result.id)
      // Réplica efímera: dispose tras merge ok (no en conflict retry).
      if (shouldDisposeReplicaOnComplete({
        toAgentId: result.toAgentId ?? '',
        baseAgentId: info.baseAgentId,
      })) {
        const replicaTab = tabsRef.current.find(item => (item.paneIds ?? []).includes(info.toPaneId))
        if (replicaTab) handleClosePane(replicaTab.id, info.toPaneId)
      }
    })
    mergeQueueByOrchestratorRef.current.set(fromPaneId, chainedOp)
    return chainedOp
  }, [clearPaneCwdOverride, enqueueOrchestrationSend, handleClosePane, syncAwaitingFromPending])

  const handleDelegationTurnComplete = useCallback(async (result: DelegateResult) => {
    let fromPaneId: string | undefined
    let job: OrchestrationJob | undefined
    for (const [paneId, jobsMap] of orchestrationJobsByPaneRef.current.entries()) {
      const found = findJobByDelegation(jobsMap.values(), result.id)
      if (found && found.pending.has(result.id)) {
        fromPaneId = paneId
        job = found
        break
      }
    }
    if (!fromPaneId || !job) return
    const completedMeta = job.pending.get(result.id)
    const freedPaneId = completedMeta?.toPaneId
    const disposeReplica = Boolean(
      completedMeta
      && shouldDisposeReplicaOnComplete(completedMeta),
    )
    job.pending.delete(result.id)
    let remaining = job.pending.size
    job.completedResults.push(result)
    syncAwaitingFromPending()

    const worktreeInfo = worktreesByDelegationRef.current.get(result.id)
    const canFinalize = Boolean(
      worktreeInfo
      && shouldFinalizeWorktreeFromOrchestrator({
        orchestratorPaneId: fromPaneId,
        worktreeOwnerPaneId: worktreeInfo.fromPaneId,
      }),
    )
    const deferredForFreedPane = Boolean(
      freedPaneId
      && job.deferred.some(item => item.toPaneId === freedPaneId),
    )

    if (deferredForFreedPane && freedPaneId) {
      if (canFinalize && worktreeInfo) {
        void finalizeDelegationWorktree(fromPaneId, result, {
          toPaneId: worktreeInfo.toPaneId,
          worktreePath: worktreeInfo.worktreePath,
          branch: worktreeInfo.branch,
          baseCwd: worktreeInfo.baseCwd,
          baseBranch: worktreeInfo.baseBranch,
          ...(worktreeInfo.baseAgentId ? { baseAgentId: worktreeInfo.baseAgentId } : {}),
        })
        await (mergeQueueByOrchestratorRef.current.get(fromPaneId) ?? Promise.resolve())
      }
      await startNextDeferredForPane(fromPaneId, freedPaneId)
      remaining = job.pending.size
      const deferredLeft = job.deferred.length
      if (remaining > 0 || deferredLeft > 0) return
    } else if (canFinalize && worktreeInfo) {
      job.pendingMerges.push({
        delegationId: result.id,
        completedAt: Date.now(),
        result,
        info: worktreeInfo,
      })
    } else if (disposeReplica && freedPaneId) {
      const replicaTab = tabsRef.current.find(item => (item.paneIds ?? []).includes(freedPaneId))
      if (replicaTab) handleClosePane(replicaTab.id, freedPaneId)
    }

    const deferredLeft = job.deferred.length
    if (deferredLeft > 0) return
    if (!shouldWakeJob(remaining, deferredLeft)) return
    if (!shouldWakeOrchestratorOnDelegationComplete(remaining)) return

    const mergeBatch = job.pendingMerges.splice(0, job.pendingMerges.length)
    const mergeOrder = planWorktreeMergeOrder(
      mergeBatch.map(item => ({
        delegationId: item.delegationId,
        completedAt: item.completedAt,
      })),
    )
    for (const delegationId of mergeOrder) {
      const item = mergeBatch.find(entry => entry.delegationId === delegationId)
      if (!item) continue
      void finalizeDelegationWorktree(fromPaneId, item.result, item.info)
    }

    await (mergeQueueByOrchestratorRef.current.get(fromPaneId) ?? Promise.resolve())

    // Job superseded / eliminado por un turno humano nuevo: no encolar resultados viejos.
    const liveJobs = orchestrationJobsByPaneRef.current.get(fromPaneId)
    if (!shouldDeliverOrchestrationJobFollowUp(liveJobs, job)) return

    const batchResults = job.completedResults.splice(0, job.completedResults.length)
    const round = job.round || 1
    const maxRounds = orchestrationMaxRoundsForPane(fromPaneId)
    const atCap = orchestrationRoundsAtCap(round, maxRounds)
    const tab = tabsRef.current.find(item => (item.paneIds ?? []).includes(fromPaneId))
    const fromMeta = tab
      ? resolveTabAgentMeta(tab, fromPaneId, projectAgentsByCwdRef.current)
      : undefined
    const workStyle = orchestrationWorkStyleForPane(fromPaneId)
    activeOrchestrationJobByPaneRef.current.set(fromPaneId, job.jobId)
    enqueueOrchestrationSend(fromPaneId, {
      text: buildBatchedDelegationFollowUp(batchResults, {
        round,
        maxRounds,
        continuousProductOwner: fromMeta?.coordination === 'productOwner',
        orchestrationJobId: job.jobId,
        workStyle,
      }),
      focusPane: false,
      orchestrationFollowUp: true,
      orchestrationJobId: job.jobId,
      allowDelegations: !atCap,
    })
  }, [
    enqueueOrchestrationSend,
    finalizeDelegationWorktree,
    handleClosePane,
    orchestrationMaxRoundsForPane,
    orchestrationWorkStyleForPane,
    startNextDeferredForPane,
    syncAwaitingFromPending,
  ])

  reconcileIdleDelegationTargetRef.current = (paneId, summary) => {
    if (reconcilingIdleDelegationPaneIdsRef.current.has(paneId)) return
    const found = findPendingDelegationByToPane(orchestrationJobsByPaneRef.current, paneId)
    if (!found) return
    // No cerrar con snippet viejo antes de que el especialista arranque el turno nuevo.
    if (!canReconcileIdlePending(found.sawBusy)) return
    // Mid-orquestador con olas propias vivas: no liberar el hold del padre.
    if (listJobsForPane(orchestrationJobsByPaneRef.current, paneId).some(isJobAwaiting)) return
    reconcilingIdleDelegationPaneIdsRef.current.add(paneId)
    void window.api.isAgentTurnActive(paneId).catch(() => false).then(turnActive => {
      if (turnActive) return
      const still = findPendingDelegationByToPane(orchestrationJobsByPaneRef.current, paneId)
      if (!still || still.delegationId !== found.delegationId) return
      if (!canReconcileIdlePending(still.sawBusy)) return
      if (listJobsForPane(orchestrationJobsByPaneRef.current, paneId).some(isJobAwaiting)) return
      void handleDelegationTurnComplete({
        id: found.delegationId,
        status: 'ok',
        summary: summary.trim() || i18next.t('agentPane.delegationEmptySummary'),
        toAgentId: found.toAgentId,
        toPaneId: paneId,
      })
    }).finally(() => {
      reconcilingIdleDelegationPaneIdsRef.current.delete(paneId)
    })
  }

  const requestPlaneStop = useCallback((paneId: string) => {
    setPlaneStopPaneIds(previous => {
      if (previous.has(paneId)) return previous
      const next = new Set(previous)
      next.add(paneId)
      return next
    })
  }, [])

  const abortOrchestrationRun = useCallback((fromPaneId: string) => {
    const jobsMap = orchestrationJobsByPaneRef.current.get(fromPaneId)
    const allPending = jobsMap
      ? [...jobsMap.values()].flatMap(job => [...job.pending.values()])
      : []
    const runningTargets = [...new Set(allPending.map(item => item.toPaneId))]
    const replicaPaneIds = [...new Set(
      allPending
        .filter(item => shouldDisposeReplicaOnComplete(item))
        .map(item => item.toPaneId),
    )]
    orchestrationJobsByPaneRef.current.delete(fromPaneId)
    activeOrchestrationJobByPaneRef.current.delete(fromPaneId)
    // No reinyectar follow-ups ni subtareas pendientes de este orquestador.
    orchestrationFifoByPaneRef.current.delete(fromPaneId)
    for (const [paneId, queue] of [...orchestrationFifoByPaneRef.current.entries()]) {
      const next = queue.filter(item => item.delegation?.fromPaneId !== fromPaneId)
      if (next.length) orchestrationFifoByPaneRef.current.set(paneId, next)
      else orchestrationFifoByPaneRef.current.delete(paneId)
    }
    // preferSend ya ofrecido: no debe consumirse tras el abort.
    setPlaneSendByPane(prev => clearPlaneSendsForOrchestrationAbort(prev, fromPaneId))
    for (const controls of planeQueueControlsByPaneRef.current.values()) {
      controls.cancelDelegationsFrom(fromPaneId)
    }
    for (const paneId of runningTargets) {
      requestPlaneStop(paneId)
    }
    // Réplicas efímeras: dispose completo (pane+catálogo+chat); el experto base queda.
    for (const paneId of replicaPaneIds) {
      const tab = tabsRef.current.find(item => (item.paneIds ?? []).includes(paneId))
      if (tab) handleClosePane(tab.id, paneId)
    }
    setOrchestrationFifoTick(n => n + 1)
    syncAwaitingFromPending()
    // QA fix: no dejar worktrees/ramas huérfanos de este orquestador al abortar.
    void cleanupWorktreesForPane(fromPaneId)
  }, [cleanupWorktreesForPane, handleClosePane, requestPlaneStop, syncAwaitingFromPending])
  abortOrchestrationRunRef.current = abortOrchestrationRun

  /**
   * Stop por fila en Waiting: cancela solo esa delegación (no el Stop rojo del composer).
   */
  const abortSingleDelegation = useCallback(async (
    fromPaneId: string,
    delegationId: string,
  ) => {
    const id = delegationId.trim()
    if (!id) return
    const jobsMap = orchestrationJobsByPaneRef.current.get(fromPaneId)
    if (!jobsMap?.size) return
    const job = findJobByDelegation(jobsMap.values(), id)
    if (!job) return

    const abort = abortOneDelegationInJob(job, id)
    if (!abort.ok) return

    for (const [paneId, queue] of [...orchestrationFifoByPaneRef.current.entries()]) {
      const next = queue.filter(item => item.delegation?.id !== id)
      if (next.length) orchestrationFifoByPaneRef.current.set(paneId, next)
      else orchestrationFifoByPaneRef.current.delete(paneId)
    }
    setPlaneSendByPane(prev => clearPlaneSendsForSingleDelegationAbort(prev, id))
    for (const controls of planeQueueControlsByPaneRef.current.values()) {
      controls.cancelDelegation(id)
    }

    const toPaneId = abort.toPaneId
    if (abort.wasPending && toPaneId) {
      requestPlaneStop(toPaneId)
    }

    const worktreeInfo = worktreesByDelegationRef.current.get(id)
    if (worktreeInfo) {
      try {
        clearPaneCwdOverride(worktreeInfo.toPaneId)
        await window.api.gitWorktreeRemove({ path: worktreeInfo.baseCwd }, {
          worktreePath: worktreeInfo.worktreePath,
          branch: worktreeInfo.branch,
          force: true,
        })
      } catch (err) {
        console.warn(`[worktree] cleanup falló al abortar delegación ${id}:`, err)
      } finally {
        worktreesByDelegationRef.current.delete(id)
      }
    }

    if (
      toPaneId
      && shouldDisposeReplicaOnComplete({
        toAgentId: abort.toAgentId ?? '',
        ...(abort.baseAgentId ? { baseAgentId: abort.baseAgentId } : {}),
      })
    ) {
      const replicaTab = tabsRef.current.find(item => (item.paneIds ?? []).includes(toPaneId))
      if (replicaTab) handleClosePane(replicaTab.id, toPaneId)
    }

    if (abort.wasPending) {
      job.completedResults.push({
        id,
        status: 'aborted',
        summary: i18next.t('agentPane.delegationAbortedSummary'),
        ...(abort.toAgentId ? { toAgentId: abort.toAgentId } : {}),
        ...(toPaneId ? { toPaneId } : {}),
      })
    }

    setOrchestrationFifoTick(n => n + 1)
    syncAwaitingFromPending()

    if (abort.wasPending && toPaneId) {
      const deferredForFreed = job.deferred.some(item => item.toPaneId === toPaneId)
      if (deferredForFreed) {
        await startNextDeferredForPane(fromPaneId, toPaneId)
      }
    }

    const remaining = job.pending.size
    const deferredLeft = job.deferred.length
    if (!shouldWakeJob(remaining, deferredLeft)) return
    if (!shouldWakeOrchestratorOnDelegationComplete(remaining)) return

    const mergeBatch = job.pendingMerges.splice(0, job.pendingMerges.length)
    const mergeOrder = planWorktreeMergeOrder(
      mergeBatch.map(item => ({
        delegationId: item.delegationId,
        completedAt: item.completedAt,
      })),
    )
    for (const mergeId of mergeOrder) {
      const item = mergeBatch.find(entry => entry.delegationId === mergeId)
      if (!item) continue
      void finalizeDelegationWorktree(fromPaneId, item.result, item.info)
    }

    await (mergeQueueByOrchestratorRef.current.get(fromPaneId) ?? Promise.resolve())

    const liveJobs = orchestrationJobsByPaneRef.current.get(fromPaneId)
    if (!shouldDeliverOrchestrationJobFollowUp(liveJobs, job)) return

    const batchResults = job.completedResults.splice(0, job.completedResults.length)
    if (batchResults.length === 0) return
    const round = job.round || 1
    const maxRounds = orchestrationMaxRoundsForPane(fromPaneId)
    const atCap = orchestrationRoundsAtCap(round, maxRounds)
    const tab = tabsRef.current.find(item => (item.paneIds ?? []).includes(fromPaneId))
    const fromMeta = tab
      ? resolveTabAgentMeta(tab, fromPaneId, projectAgentsByCwdRef.current)
      : undefined
    const workStyle = orchestrationWorkStyleForPane(fromPaneId)
    activeOrchestrationJobByPaneRef.current.set(fromPaneId, job.jobId)
    enqueueOrchestrationSend(fromPaneId, {
      text: buildBatchedDelegationFollowUp(batchResults, {
        round,
        maxRounds,
        continuousProductOwner: fromMeta?.coordination === 'productOwner',
        orchestrationJobId: job.jobId,
        workStyle,
      }),
      focusPane: false,
      orchestrationFollowUp: true,
      orchestrationJobId: job.jobId,
      allowDelegations: !atCap,
    })
  }, [
    clearPaneCwdOverride,
    enqueueOrchestrationSend,
    finalizeDelegationWorktree,
    handleClosePane,
    orchestrationMaxRoundsForPane,
    orchestrationWorkStyleForPane,
    requestPlaneStop,
    startNextDeferredForPane,
    syncAwaitingFromPending,
  ])

  const handleOrchestratorStop = useCallback((fromPaneId: string) => {
    abortOrchestrationRun(fromPaneId)
  }, [abortOrchestrationRun])

  // Drena FIFO de orquestación: ofrece preferSend si el pane está idle.
  useEffect(() => {
    const queues = orchestrationFifoByPaneRef.current
    const pendingIds = pendingOrchestratorIdsFromJobs(orchestrationJobsByPaneRef.current)
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
      // Descartar subtareas de orquestadores ya abortados (sin pending).
      while (queue.length && shouldDiscardAbortedDelegationFifoHead(queue[0], pendingIds)) {
        queue.shift()
      }
      if (!queue.length) {
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
        if (head.orchestrationJobId?.trim()) {
          activeOrchestrationJobByPaneRef.current.set(paneId, head.orchestrationJobId.trim())
        }
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

  const handlePlaneMergeQueuedTurns = useCallback((paneId: string) => {
    planeQueueControlsByPaneRef.current.get(paneId)?.merge()
  }, [])

  const handleAgentMetaChange = useCallback(async (
    tabId: string,
    paneId: string,
    meta: AgentPaneMeta | ((previous: AgentPaneMeta) => AgentPaneMeta),
  ): Promise<boolean> => {
    const tab = tabsRef.current.find(item => item.id === tabId)
    if (!tab || tab.paneKinds?.[paneId] !== 'agent') return false
    const projectFolder = tab.projectFolder?.trim() || ''
    const catalogKey = tabAgentCatalogKey(tab)
    const orgWorkspace = tab.orgWorkspace
    // Catálogo local-first bajo projectFolder; orgWorkspace solo marca sync/upload.
    const orgSlug = orgWorkspace?.slug?.trim() ?? ''
    const orgWorkspaceId = orgWorkspace?.workspaceId?.trim() ?? ''
    const isOrgBacked = Boolean(orgSlug && orgWorkspaceId)
    const previous = resolveTabAgentMeta(tab, paneId, projectAgentsByCwdRef.current)
    const next = typeof meta === 'function' ? meta(previous) : meta
    const previousId = normalizeAgentSlug(previous.id, 'agent')
    const nextId = normalizeAgentSlug(next.id, previousId) || previousId
    const idChanged = previousId !== nextId
    const bindingRaw = agentBindingFromMeta({ ...next, id: nextId })
    // Org: no persistir cliSessionId en agentByPane (sesión CLI local al usuario).
    const binding = isOrgBacked && bindingRaw.cliSessionId
      ? (() => {
          const { cliSessionId: _dropped, ...rest } = bindingRaw
          return rest
        })()
      : bindingRaw
    const previousDefinition = agentDefinitionFromMeta({ ...previous, id: previousId })
    const nextWithRemappedResults: AgentPaneMeta = {
      ...next,
      id: nextId,
      ...(idChanged
        ? {
            contextIds: remapAgentResultContextIds(next.contextIds, previousId, nextId),
          }
        : {}),
    }
    const definition = agentDefinitionFromMeta(nextWithRemappedResults)

    const replaceCatalogAfterSlugChange = (
      removeId: string,
      agent: ProjectAgentDefinition,
      fromSlug: string,
      toSlug: string,
    ): void => {
      setProjectAgentsByCwd(prev => {
        const remapped = remapAgentResultIdsInCatalog(prev[catalogKey] ?? [], fromSlug, toSlug)
          .filter(item => item.id !== removeId && item.id !== agent.id)
        const nextCatalog = {
          ...prev,
          [catalogKey]: upsertAgentInList(remapped, agent),
        }
        projectAgentsByCwdRef.current = nextCatalog
        return nextCatalog
      })
    }

    const applyBindings = (fromId: string, toId: string, paneBinding: typeof binding): void => {
      setTabs(prev => {
        const base = catalogKey && fromId !== toId
          ? remapAgentBindingsInTabs(prev, catalogKey, fromId, toId)
          : prev
        const nextTabs = base.map(item => {
          if (item.id !== tabId) return item
          return {
            ...item,
            agentByPane: {
              ...(item.agentByPane ?? {}),
              [paneId]: { ...paneBinding, agentId: toId },
            },
          }
        })
        tabsRef.current = nextTabs
        return nextTabs
      })
    }

    const applyResultContextRemapInUi = (fromSlug: string, toSlug: string): void => {
      setTabContextsByTab(prev => {
        let changed = false
        const nextMap: Record<string, TabContext[]> = { ...prev }
        for (const item of tabsRef.current) {
          if (tabAgentCatalogKey(item) !== catalogKey) continue
          const list = prev[item.id]
          if (!list?.length) continue
          const remapped = remapAgentResultTabContexts(list, fromSlug, toSlug)
          if (remapped.some((context, index) => context !== list[index])) {
            nextMap[item.id] = remapped
            changed = true
          }
        }
        return changed ? nextMap : prev
      })
      setContextsRevisionByCwd(prev => ({
        ...prev,
        [catalogKey]: (prev[catalogKey] ?? 0) + 1,
      }))
    }

    applyBindings(previousId, nextId, binding)
    if (catalogKey && idChanged) {
      replaceCatalogAfterSlugChange(previousId, definition, previousId, nextId)
      applyResultContextRemapInUi(previousId, nextId)
    } else {
      rememberProjectAgent(catalogKey, definition)
    }
    void saveSessionNow()

    const definitionUnchanged = !idChanged
      && JSON.stringify(previousDefinition) === JSON.stringify(definition)

    const revertOptimistic = (): void => {
      const previousBindingRaw = agentBindingFromMeta({ ...previous, id: previousId })
      const previousBinding = isOrgBacked && previousBindingRaw.cliSessionId
        ? (() => {
            const { cliSessionId: _dropped, ...rest } = previousBindingRaw
            return rest
          })()
        : previousBindingRaw
      applyBindings(nextId, previousId, previousBinding)
      if (idChanged) {
        replaceCatalogAfterSlugChange(nextId, previousDefinition, nextId, previousId)
        applyResultContextRemapInUi(nextId, previousId)
      } else {
        rememberProjectAgent(catalogKey, previousDefinition)
      }
      void saveSessionNow()
    }

    const failOrgUpdate = (error: string): false => {
      revertOptimistic()
      setOrgWorkspaceRequirement(prev => prev ?? { agentUpdateError: error })
      return false
    }

    // Sin carpeta de proyecto: solo sesión local (optimistic); no hay upsert a disco.
    if (!projectFolder) return true
    if (definitionUnchanged) return true

    if (idChanged) {
      const renamed = await window.api.renameProjectAgent(projectFolder, previousId, definition)
      if (!renamed.ok) {
        if (isOrgBacked) return failOrgUpdate(renamed.error ?? 'unknown')
        revertOptimistic()
        return false
      }
      replaceCatalogAfterSlugChange(previousId, renamed.agent, previousId, renamed.toId)
      await refreshProjectAgents(projectFolder)
      if (!contextIdsEqual(previousDefinition.contextIds, renamed.agent.contextIds)) {
        void refreshTabContexts(tabId)
      }
      return true
    }

    const upserted = await window.api.upsertProjectAgent(projectFolder, definition)
    if (!upserted.ok) {
      if (isOrgBacked) return failOrgUpdate(upserted.error ?? 'unknown')
      revertOptimistic()
      return false
    }
    rememberProjectAgent(catalogKey, upserted.agent)
    if (!contextIdsEqual(previousDefinition.contextIds, upserted.agent.contextIds)) {
      void refreshTabContexts(tabId)
    }
    return true
  }, [refreshProjectAgents, refreshTabContexts, rememberProjectAgent, saveSessionNow])
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
      if (t.orgWorkspace?.slug?.trim() && t.orgWorkspace?.workspaceId?.trim()) return t
      return { ...t, title }
    }))
  }, [])

  const canRenameTab = useCallback((tab: TabSession): boolean => {
    const org = tab.orgWorkspace
    const slug = org?.slug?.trim() ?? ''
    const workspaceId = org?.workspaceId?.trim() ?? ''
    if (!slug || !workspaceId) return true
    const entry = findOrgWorkspaceCatalogEntry(orgWorkspaceCatalogRef.current, slug, workspaceId)
    return entry?.canRename === true
  }, [])

  const handleRenameTab = useCallback((id: string, name: string) => {
    const next = name.trim().slice(0, 40)
    if (!next) return
    const tab = tabsRef.current.find(t => t.id === id)
    if (!tab) return

    const org = tab.orgWorkspace
    const slug = org?.slug?.trim() ?? ''
    const workspaceId = org?.workspaceId?.trim() ?? ''
    if (!slug || !workspaceId) {
      setTabs(prev => {
        const mapped = prev.map(t => (t.id === id ? { ...t, title: next, titleLocked: true } : t))
        tabsRef.current = mapped
        return mapped
      })
      return
    }

    if (!canRenameTab(tab)) {
      setOrgWorkspaceRequirement({
        workspaceRenameError: t('tabs.tabNameLockedOrgHint'),
      })
      return
    }
    if (next === tab.title.trim()) return

    const covenant = getCovenantApi()
    if (!covenant || !hasCovenantWorkspacesApi(covenant)) {
      setOrgWorkspaceRequirement({
        workspaceRenameError: t('organizations.unavailable'),
      })
      return
    }

    void (async () => {
      const result = await covenant.workspaceRename(slug, workspaceId, next)
      if (!result.ok) {
        setOrgWorkspaceRequirement({ workspaceRenameError: result.error })
        return
      }
      const canonical = result.data.name?.trim() || next
      setTabs(prev => {
        const mapped = prev.map(t => {
          const o = t.orgWorkspace
          if (o?.slug?.trim() === slug && o?.workspaceId?.trim() === workspaceId) {
            return { ...t, title: canonical, titleLocked: true }
          }
          return t
        })
        tabsRef.current = mapped
        return mapped
      })
      const patched = patchOrgWorkspaceCatalogName(
        orgWorkspaceCatalogRef.current,
        slug,
        workspaceId,
        canonical,
        true,
      )
      if (patched && patched !== orgWorkspaceCatalogRef.current) {
        applyOrgWorkspaceCatalog(patched)
        void persistOrgWorkspaceCatalogCache(patched)
      }
    })()
  }, [applyOrgWorkspaceCatalog, canRenameTab, persistOrgWorkspaceCatalogCache, t])

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
      if (!(focus instanceof HTMLElement)) return false
      return focus.closest('.tab-file-explorer, .terminal-file-explorer') !== null
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

      // ⌘, / Ctrl+, : Ajustes. Convención de macOS y de VS Code en Windows/Linux.
      // Sin guardas de foco a propósito: se espera que funcione desde cualquier
      // parte, incluida la terminal (con accel pulsado xterm no escribe la coma).
      if (e.key === ',' || e.code === 'Comma') {
        e.preventDefault()
        e.stopPropagation()
        setSettingsOpen(true)
        return
      }

      // ⌘E / Ctrl+E: explorador de archivos (abrir/cerrar en la tab activa).
      // Si el foco está en el explorador, FileExplorerSidebar ya togglea; no duplicar.
      if (e.key === 'e' || e.key === 'E' || e.code === 'KeyE') {
        if (isFocusInFileExplorer()) return
        if (shouldBlockExplorerToggleShortcut(e.target as HTMLElement | null)) return
        e.preventDefault()
        e.stopPropagation()
        const aid = activeTabIdRef.current
        if (!aid) return
        toggleTabExplorer(aid)
        return
      }

      // ⌘G / Ctrl+G: panel Git (abrir/cerrar). Con foco en xterm lo maneja TerminalPane.
      if (e.key === 'g' || e.key === 'G' || e.code === 'KeyG') {
        const target = e.target as HTMLElement | null
        if (target?.closest('.xterm')) return
        if (target) {
          const tag = target.tagName
          if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
          if (target.isContentEditable) return
        }
        e.preventDefault()
        e.stopPropagation()
        const aid = activeTabIdRef.current
        if (!aid) return
        void openTabGitPanel(aid)
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
  }, [handleAddTab, openTabGitPanel, toggleTabExplorer])

  const renderPaneContent = (tab: TabSession, paneId: string): React.ReactElement => {
    const isAgent = tab.paneKinds?.[paneId] === 'agent'
    const registerClose = (openConfirm: () => void) =>
      registerPaneShortcutCloseIntercept(paneId, openConfirm)
    const chainLoopActive = activeLoopChainPaneIds(tab.planeLoopChains ?? []).has(paneId)
    const paneCatalogKey = tabAgentCatalogKey(tab)

    if (isAgent) {
      return (
        <AgentPane
          paneId={paneId}
          meta={resolveTabAgentMeta(tab, paneId, projectAgentsByCwd)}
          cwd={tab.projectFolder?.trim() ?? ''}
          cwdOverride={
            paneCwdOverrideTick >= 0 ? paneCwdOverrideRef.current.get(paneId) : undefined
          }
          projectAgents={projectAgentsByCwd[paneCatalogKey] ?? []}
          contextsRevision={contextsRevisionByCwd[paneCatalogKey] ?? 0}
          tabContexts={tabContextsByTab[tab.id] ?? []}
          orgWorkspace={tab.orgWorkspace}
          onProjectContextsChanged={() => { void refreshTabContexts(tab.id) }}
          tabActive={tab.id === activeTabId}
          isActivePane={tab.id === activeTabId && tab.activePaneId === paneId}
          windowOpen={Boolean(tab.paneWindows?.[paneId]?.open)}
          chainLoopActive={chainLoopActive}
          awaitingDelegations={awaitingDelegationPaneIds.has(paneId)}
          orchestrationAwaiting={orchestrationAwaitingByPane.get(paneId) ?? null}
          delegationWorkActive={delegationTargetPaneIds.has(paneId)}
          systemFollowUpsPending={
            orchestrationFifoTick >= 0
            && (orchestrationFifoByPaneRef.current.get(paneId)?.length ?? 0) > 0
          }
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
            const selfMeta = resolveTabAgentMeta(tab, paneId, projectAgentsByCwdRef.current)
            return listDelegationTargetsForMeta(panes, selfMeta, paneId)
          }}
          peerAgents={(tab.paneIds ?? [])
            .filter(id => id !== paneId && tab.paneKinds?.[id] === 'agent')
            .map(id => {
              const peerMeta = resolveTabAgentMeta(tab, id, projectAgentsByCwd)
              return {
                id: peerMeta.id,
                name: peerMeta.name?.trim() || peerMeta.id,
                coordination: peerMeta.coordination ?? 'none',
              }
            })}
          onOrchestratorDelegations={(delegations, orchestrationJobId) => {
            handleOrchestratorDelegations(paneId, tab.id, delegations, orchestrationJobId)
          }}
          onOrchestratorStop={() => handleOrchestratorStop(paneId)}
          onAbortDelegation={delegationId => {
            void abortSingleDelegation(paneId, delegationId)
          }}
          onDelegationTurnComplete={handleDelegationTurnComplete}
          onOrchestrationUserTurn={() => beginOrchestrationUserTurn(paneId)}
          getOrchestrationRound={() => {
            const activeId = activeOrchestrationJobByPaneRef.current.get(paneId)
            const jobs = orchestrationJobsByPaneRef.current.get(paneId)
            const job = activeId ? jobs?.get(activeId) : undefined
            const workStyle = orchestrationWorkStyleForPane(paneId, tab.id)
            return {
              round: job?.round ?? 0,
              maxRounds: orchestrationMaxRoundsForPane(paneId, tab.id),
              ...(job ? { jobId: job.jobId } : {}),
              workStyle,
            }
          }}
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
        tabActive={tab.id === activeTabId}
        isActivePane={tab.id === activeTabId && tab.activePaneId === paneId}
        initialPtyCwd={splitSpawnCwdRef.current.get(paneId) || cwdsRef.current[paneId] || undefined}
        onPtyCwdInitialized={rememberPaneCwd}
        onPaneCwdChanged={persistPaneCwdOnCd}
        explorerOpen={(explorerByTab[tab.id] ?? DEFAULT_FILE_EXPLORER_STATE).open}
        explorerEnabled={Boolean(tab.projectFolder?.trim())}
        onToggleExplorer={() => toggleTabExplorer(tab.id)}
        onExplorerRevealFile={(relPath) => revealTabExplorerFile(tab.id, relPath)}
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
        onRequestGitPanel={() => { void openTabGitPanel(tab.id) }}
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
        onOpenOrganizations={() => setOrgModalOpen(true)}
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
        canRenameTab={canRenameTab}
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
                  || agentCliSpec(meta?.provider ?? 'claude').label
                )
                : (
                  tab.paneTitles?.[paneId]?.trim()
                  || `${t('tabs.nodeTerminal')} ${terminalIndex || index + 1}`
                )

              if (kind === 'agent') {
                const status = agentPlaneStatus[paneId]
                const delegationWorkActive = delegationTargetPaneIds.has(paneId)
                const visuallyBusy = busyPanes.has(paneId) || delegationWorkActive
                const assignedIds = meta?.contextIds ?? []
                const assignedContexts = resolveAssignedContextChips(
                  assignedIds,
                  discoveredContexts,
                  contextUsage,
                  contextKind => t(`tabContexts.kind_${contextKind}`),
                )
                return {
                  paneId,
                  kind,
                  title,
                  monogram: meta?.monogram,
                  busy: visuallyBusy,
                  provider: meta?.provider ?? 'claude',
                  coordination: (meta?.coordination === 'orchestrator'
                    || meta?.coordination === 'productOwner'
                    ? meta.coordination
                    : 'none') as 'none' | 'orchestrator' | 'productOwner',
                  snippet: status?.activity?.trim()
                    || (delegationWorkActive ? t('agentPane.awaitingStatusRunning') : '')
                    || status?.lastSnippet
                    || '',
                  agentId: meta?.id,
                  delegationWorkActive,
                  contextIds: assignedIds,
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
                customTitle: tab.paneTitles?.[paneId]?.trim() || undefined,
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
                {(() => {
                  const explorerState = explorerByTab[tab.id] ?? DEFAULT_FILE_EXPLORER_STATE
                  const explorerSessionId = resolveTabExplorerSessionId(tab)
                  const projectCwd = tab.projectFolder?.trim() || ''
                  const agentCatalogKey = tabAgentCatalogKey(tab)
                  const catalogEmpty = (projectAgentsByCwd[agentCatalogKey] ?? []).length === 0
                  const noAgentPanes = !(tab.paneIds ?? []).some(
                    paneId => tab.paneKinds?.[paneId] === 'agent',
                  )
                  const showBootstrapAgents = catalogEmpty && noAgentPanes
                  const orgBacked = Boolean(
                    tab.orgWorkspace?.slug?.trim() && tab.orgWorkspace?.workspaceId?.trim(),
                  )
                  const canBootstrapAgents = showBootstrapAgents && (Boolean(projectCwd) || orgBacked)
                  return (
                      <div className="tab-terminal-group__main">
                <TabAgenticPlane
                  emptyTitle={t('tabs.planeEmptyTitle')}
                  emptyHint={t('tabs.planeEmptyHint')}
                  tabActive={tab.id === activeTabId}
                  agentFabTitle={
                    projectCwd || orgBacked
                      ? t('tabs.fabAgent')
                      : t('agentPane.projectFolderRequired')
                  }
                  terminalFabTitle={
                    projectCwd || orgBacked
                      ? t('tabs.fabTerminal')
                      : t('agentPane.projectFolderRequired')
                  }
                  idleAgentLabel={t('tabs.planeIdleAgent')}
                  contextPoolTitle={t('tabs.planeContextPoolTitle')}
                  contextPoolConfigureLabel={t('tabContexts.manage')}
                  contextPoolCreateLabel={t('tabContexts.createTitle')}
                  contextPoolChipHint={t('tabs.planeContextPoolChipHint')}
                  contextPoolAssignLabel={t('tabs.planeContextPoolAssign')}
                  contextPoolAssignEmptyHint={t('tabs.planeContextPoolAssignEmpty')}
                  contextPoolAssignedCountLabel={(count: number) => (
                    t('tabs.planeContextPoolAssigned', { count })
                  )}
                  contextPoolEditLabel={t('tabContexts.edit')}
                  contextPoolDeleteLabel={t('tabs.planeDeletePane')}
                  contextPoolDeleteConfirmMessage={(name: string) => (
                    t('tabs.planeConfirmDeleteContextMessage', { name })
                  )}
                  contextPoolDeleteConfirmDetail={t('tabs.planeConfirmDeleteContextDetail')}
                  contextPoolTrashDropLabel={t('tabs.planeContextPoolTrashDrop')}
                  chatPlaceholder={t('tabs.planeChatPlaceholder')}
                  chatEmptyAgents={t('tabs.planeChatEmptyAgents')}
                  chatSendLabel={t('tabs.planeChatSend')}
                  gitRepos={gitReposByTab[tab.id] ?? []}
                  onOpenRepoGit={(repoPath: string) => openTabGitModal(tab.id, repoPath)}
                  onRefreshRepos={() => { void refreshPlaneGitRepos() }}
                  tabContexts={tabContextBadges}
                  contextCatalog={discoveredContexts}
                  onToggleAgentContext={(paneId, contextId) => {
                    handleToggleAgentContext(tab.id, paneId, contextId)
                  }}
                  onAutoImproveChange={(paneId, enabled) => {
                    handleAgentAutoImproveChange(tab.id, paneId, enabled)
                  }}
                  onToggleLoop={handlePlaneToggleLoop}
                  onRemoveQueuedTurn={handlePlaneRemoveQueuedTurn}
                  onUpdateQueuedTurn={handlePlaneUpdateQueuedTurn}
                  onMergeQueuedTurns={handlePlaneMergeQueuedTurns}
                  canAdd={tab.paneIds.length < MAX_PANES_PER_TAB}
                  canAddAgent={Boolean(projectCwd) || orgBacked}
                  canAddTerminal={Boolean(projectCwd) || orgBacked}
                  bootstrapAgentsLabel={t('tabs.bootstrapAgents')}
                  bootstrapAgentsTitle={t('tabs.bootstrapAgentsTitle')}
                  bootstrapAgentsDisabledTitle={t('tabs.bootstrapAgentsNeedFolder')}
                  showBootstrapAgents={showBootstrapAgents}
                  canBootstrapAgents={canBootstrapAgents}
                  onBootstrapAgents={() => { void bootstrapProjectAgents(tab.id) }}
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
                  onCreateContext={() => handleCreateContextFromPlane(tab.id)}
                  onOpenContext={contextId => {
                    handleOpenContextFromPlane(tab.id, contextId)
                  }}
                  onDeleteContext={contextId => {
                    void handleDeleteContextFromPlane(tab.id, contextId)
                  }}
                  onAssignContext={(paneId, contextId) => {
                    handleAssignContextToAgent(tab.id, paneId, contextId)
                  }}
                  onOpenResultsPreview={contextId => {
                    const discovered = tabContextsByTabRef.current[tab.id] ?? []
                    const context = resolveTabContextById(contextId, discovered)
                    if (!context) return
                    setResultsPreview({ tabId: tab.id, context })
                  }}
                  openChatAgentId={tab.planeOpenChatAgentId ?? null}
                  onOpenChatAgentChange={paneId => handlePlaneOpenChatAgent(tab.id, paneId)}
                  onSendChat={(paneId, text, images, contextIds) => {
                    yieldChainOfferForUserSend(paneId)
                    setPlaneSendByPane(prev => ({
                      ...prev,
                      [paneId]: {
                        text,
                        images,
                        focusPane: true,
                        ...(contextIds.length ? { extraContextIds: contextIds } : {}),
                      },
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
                    const pendingDelegation = findPendingDelegationByToPane(
                      orchestrationJobsByPaneRef.current,
                      paneId,
                    )
                    if (pendingDelegation) {
                      void abortSingleDelegation(
                        pendingDelegation.fromPaneId,
                        pendingDelegation.delegationId,
                      )
                      return
                    }
                    requestPlaneStop(paneId)
                    stopChainsForPane(tab.id, paneId)
                  }}
                  onAbortDelegation={(fromPaneId, delegationId) => {
                    void abortSingleDelegation(fromPaneId, delegationId)
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
                  projectFolderRevealLabel={t('fileExplorer.contextMenu.revealInFinder')}
                  onSelectProjectFolder={() => { void handlePickProjectFolder(tab.id) }}
                  onRevealProjectFolder={tab.projectFolder?.trim()
                    ? () => { window.api.openFolder(tab.projectFolder!.trim()) }
                    : undefined}
                  canResyncWorkspace={Boolean(
                    tab.orgWorkspace?.slug?.trim() && tab.orgWorkspace?.workspaceId?.trim(),
                  )}
                  resyncWorkspaceLabel={t('tabs.resyncWorkspaceButton')}
                  resyncWorkspaceBusy={resyncingWorkspaceTabs.has(tab.id) || uploadingWorkspaceTabs.has(tab.id)}
                  onResyncWorkspace={() => { void handleResyncOrgWorkspace(tab) }}
                  canUploadWorkspace={canUploadOrgWorkspaceChanges(
                    findOrgWorkspaceCatalogEntry(
                      orgWorkspaceCatalog,
                      tab.orgWorkspace?.slug?.trim() ?? '',
                      tab.orgWorkspace?.workspaceId?.trim() ?? '',
                    )?.canRename,
                  )}
                  uploadWorkspaceLabel={t('tabs.uploadWorkspaceButton')}
                  uploadWorkspaceBusy={uploadingWorkspaceTabs.has(tab.id) || resyncingWorkspaceTabs.has(tab.id)}
                  onUploadWorkspace={() => { void handleUploadOrgWorkspace(tab) }}
                  loopsOpen={Boolean(planeLoopsOpenByTab[tab.id])}
                  onLoopsOpenChange={open => {
                    setPlaneLoopsOpenByTab(prev => ({ ...prev, [tab.id]: open }))
                  }}
                  loopsButtonLabel={t('tabs.loopsButton')}
                  brainstormNeedFolderHint={t('tabs.brainstormNeedFolder')}
                  canOpenBrainstorm={Boolean(tab.projectFolder?.trim())}
                  brainstormsListOpen={Boolean(brainstormListOpenByTab[tab.id])}
                  onBrainstormsListOpenChange={open => {
                    setBrainstormListOpenByTab(prev => ({ ...prev, [tab.id]: open }))
                  }}
                  brainstormsListButtonLabel={t('tabs.brainstormsListButton')}
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
                  onRenamePane={(paneId, title) => handleRenamePane(tab.id, paneId, title)}
                  onToggleFullscreen={paneId => handleTogglePaneFullscreen(tab.id, paneId)}
                  onReorderPanes={(kind, orderedPaneIds) => {
                    handleReorderPanes(tab.id, kind, orderedPaneIds)
                  }}
                  reorderAriaLabel={t('tabs.planeReorderAriaLabel')}
                  renderPane={paneId => renderPaneContent(tab, paneId)}
                  explorerSessionId={explorerSessionId}
                  explorerState={explorerState}
                  explorerTitle={t('fileExplorer.ariaLabel')}
                  explorerButtonLabel={t('paneToolbar.explorerTitle')}
                  explorerZIndex={APP_OVERLAY_MODAL_Z}
                  explorerThemeId={config.themeId}
                  explorerCwd={projectCwd}
                  onExplorerStateChange={patch => {
                    const current = explorerByTabRef.current[tab.id]
                      ?? DEFAULT_FILE_EXPLORER_STATE
                    handleFileExplorerChange(tab.id, { ...current, ...patch })
                  }}
                  onToggleExplorer={() => toggleTabExplorer(tab.id)}
                  canOpenGitPanel={Boolean(tab.projectFolder?.trim())}
                  gitButtonDisabled={(gitUiByTab[tab.id]?.repos.length ?? 0) === 0}
                  gitButtonLabel={t('paneToolbar.gitTitle')}
                  gitButtonDisabledTitle={t('git.noReposTooltip')}
                  gitPickerOpen={Boolean(gitUiByTab[tab.id]?.pickerOpen)}
                  onGitButtonClick={() => { void handleTabGitButtonClick(tab.id) }}
                  explorerHostRef={handle => {
                    if (handle) tabExplorerHostByTabRef.current.set(tab.id, handle)
                    else tabExplorerHostByTabRef.current.delete(tab.id)
                  }}
                />
                <BrainstormListModal
                  open={Boolean(brainstormListOpenByTab[tab.id]) && !brainstormRoomByTab[tab.id]}
                  active={activeTabId === tab.id}
                  cwd={tab.projectFolder ?? ''}
                  onClose={() => {
                    setBrainstormListOpenByTab(prev => ({ ...prev, [tab.id]: false }))
                  }}
                  onCreate={() => {
                    setBrainstormListOpenByTab(prev => ({ ...prev, [tab.id]: false }))
                    setBrainstormSetupOpenByTab(prev => ({ ...prev, [tab.id]: true }))
                  }}
                  onOpenRoom={room => {
                    setBrainstormListOpenByTab(prev => ({ ...prev, [tab.id]: false }))
                    setBrainstormRoomByTab(prev => ({ ...prev, [tab.id]: room }))
                  }}
                />
                <BrainstormRoomModal
                  open={Boolean(brainstormSetupOpenByTab[tab.id]) && !brainstormRoomByTab[tab.id]}
                  active={activeTabId === tab.id}
                  cwd={tab.projectFolder ?? ''}
                  agents={filterBrainstormInvitableAgents(
                    projectAgentsByCwd[agentCatalogKey] ?? [],
                  )}
                  onClose={() => {
                    setBrainstormSetupOpenByTab(prev => ({ ...prev, [tab.id]: false }))
                  }}
                  onStarted={room => {
                    setBrainstormSetupOpenByTab(prev => ({ ...prev, [tab.id]: false }))
                    setBrainstormRoomByTab(prev => ({ ...prev, [tab.id]: room }))
                  }}
                />
                {brainstormRoomByTab[tab.id] ? (
                  <BrainstormRoomView
                    open
                    active={activeTabId === tab.id}
                    room={brainstormRoomByTab[tab.id]!}
                    cwd={tab.projectFolder ?? ''}
                    agents={filterBrainstormInvitableAgents(
                      projectAgentsByCwd[agentCatalogKey] ?? [],
                    )}
                    onClose={() => {
                      setBrainstormRoomByTab(prev => ({ ...prev, [tab.id]: null }))
                    }}
                  />
                ) : null}
                      </div>
                  )
                })()}
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
        const catalogKey = tabAgentCatalogKey(modalTab)
        return (
          <TabContextsModal
            open={planeContextsModalTabId === activeTabId}
            contexts={tabContextsByTab[modalTab.id] ?? []}
            agents={projectAgentsByCwd[catalogKey] ?? []}
            cwd={cwd}
            focusContextId={planeContextsFocusId}
            onFocusContextConsumed={() => setPlaneContextsFocusId(null)}
            openCreate={planeContextsCreate}
            onRefresh={() => { void refreshTabContexts(modalTab.id) }}
            onClose={() => {
              setPlaneContextsModalTabId(null)
              setPlaneContextsFocusId(null)
              setPlaneContextsCreate(false)
              void refreshTabContexts(modalTab.id)
            }}
          />
        )
      })()}

      {(() => {
        if (!resultsPreview) return null
        const previewTab = tabs.find(item => item.id === resultsPreview.tabId)
        if (!previewTab) return null
        return (
          <ContextContentPreviewModal
            open={resultsPreview.tabId === activeTabId}
            context={resultsPreview.context}
            cwd={previewTab.projectFolder?.trim() || ''}
            onClose={() => setResultsPreview(null)}
          />
        )
      })()}

      {tabs.map(tab => {
        const gitUi = gitUiByTab[tab.id]
        if (!gitUi) return null
        const isActive = tab.id === activeTabId
        return (
          <React.Fragment key={`git-ui-${tab.id}`}>
            <GitRepoPickerModal
              open={isActive && Boolean(gitUi.pickerOpen) && gitUi.repos.length > 1}
              repos={gitUi.repos}
              onSelect={path => handleSelectGitRepo(tab.id, path)}
              onClose={() => closeTabGitPicker(tab.id)}
            />
            {gitUi.modalOpen && gitUi.repoPath ? (
              <GitPanelModal
                open={isActive}
                target={{ path: gitUi.repoPath }}
                config={config}
                workspace={pulseWorkspaceTag(tab.orgWorkspace) ?? undefined}
                onClose={() => closeTabGitModal(tab.id)}
              />
            ) : null}
          </React.Fragment>
        )
      })}

      <AppModals
        config={config}
        settingsOpen={settingsOpen}
        orgModalOpen={orgModalOpen}
        orgWorkspacePickerOpen={orgWorkspacePickerOpen}
        orgWorkspaceCatalogEntries={orgWorkspaceCatalog?.entries}
        themePickerOpen={themePickerOpen}
        agentPicker={agentPicker}
        agentCreate={agentCreate}
        agentCloneSources={agentCloneSources}
        onCloseSettings={() => {
          setSettingsOpen(false)
          focusActiveTerminalTextarea()
        }}
        onCloseOrganizations={() => {
          setOrgModalOpen(false)
          focusActiveTerminalTextarea()
        }}
        onOrgWorkspacesMutated={handleOrgWorkspacesMutated}
        onCloseOrgWorkspacePicker={() => {
          setOrgWorkspacePickerOpen(false)
          focusActiveTerminalTextarea()
        }}
        onConfirmOrgWorkspacePicker={handleOrgWorkspaceTabConfirm}
        onCloseThemePicker={() => {
          setThemePickerOpen(false)
          focusActiveTerminalTextarea()
        }}
        onCloseAgentPicker={() => {
          setAgentPicker(null)
          focusActiveTerminalTextarea()
        }}
        onCloseAgentCreate={() => {
          setAgentCreate(null)
          focusActiveTerminalTextarea()
        }}
        onConfigSaved={handleConfigSaved}
        onThemeChange={handleThemeChange}
        onAgentProviderSelect={provider => {
          const pending = agentPicker
          setAgentPicker(null)
          if (pending) {
            setAgentCreate({
              tabId: pending.tabId,
              fromPaneId: pending.fromPaneId,
              provider,
            })
          }
        }}
        onAgentCreateConfirm={name => {
          const pending = agentCreate
          setAgentCreate(null)
          if (pending) {
            void handleAddAgentPane(
              pending.tabId,
              pending.fromPaneId,
              pending.provider,
              name,
            )
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

      <OrgWorkspaceRequirementModal
        open={orgWorkspaceRequirement !== null}
        missingFolder={orgWorkspaceRequirement?.missingFolder}
        missingToken={orgWorkspaceRequirement?.missingToken}
        cloneError={orgWorkspaceRequirement?.cloneError}
        cloneFailure={orgWorkspaceRequirement?.cloneFailure}
        cloning={orgWorkspaceRequirement?.cloning}
        syncing={orgWorkspaceRequirement?.syncing}
        uploading={orgWorkspaceRequirement?.uploading}
        agentDeleteError={orgWorkspaceRequirement?.agentDeleteError}
        agentUpdateError={orgWorkspaceRequirement?.agentUpdateError}
        workspaceRenameError={orgWorkspaceRequirement?.workspaceRenameError}
        uploadError={orgWorkspaceRequirement?.uploadError}
        onClose={() => setOrgWorkspaceRequirement(null)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <QuitConfirmModal
        open={quitConfirmOpen}
        terminals={termRefs.current.size}
        agents={busyPanes.size}
        onCancel={() => setQuitConfirmOpen(false)}
        onConfirm={() => {
          setQuitConfirmOpen(false)
          window.api.sendQuitConfirmed()
        }}
      />
    </div>
  )
}
