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
import { addAgentContextId } from '@shared/tabContextAgentUsage'
import { contextIconName } from './agent/tabContextKindIcons'
import type { PresenceSnapshot } from './presence'
import { setDiscordPresenceEnabled, startDiscordPresence } from './presence'
import type { GitListedRepo } from '@shared/gitSessionTypes'
import { TabBar, type TabBarHandle } from './components/TabBar'
import { TerminalPane } from './terminal/TerminalPane'
import { AgentPane } from './agent/AgentPane'
import { TabContextsModal } from './agent/TabContextsModal'
import { addFileContextsFromPicker } from './agent/addFileContexts'
import { AppModals } from './components/AppModals'
import { HeroConfirmOverlay } from './components/HeroConfirmOverlay'
import { type OrgWorkspaceSelection } from './components/OrgWorkspaceTabPickerModal'
import { clisAllMissing, mapCliRows, type OnboardingCliRow } from './onboardingGate'
import { ONBOARDING_VERSION, type OrchestratorPath } from '@shared/onboarding'
import {
  canCompleteOnboarding,
  isOnboardingActive,
  isOnboardingGuideActive,
  isOnboardingIncomplete,
  onboardingChromeHidden,
  onboardingLockedSurface,
  shouldAutoCompleteFromPanes,
  resolveComposerSendBlock,
  shouldPersistOnboardingCompleted,
} from '@shared/onboardingFlow'
import {
  resolveOnboardingGuideStep,
  isDismissibleGuideStep,
  type OnboardingGuideStep,
} from '@shared/onboardingGuideFlow'
import {
  resolveContextAssignOutcome,
  shouldPersistAssignedContext,
} from '@shared/onboardingContextAssign'
import {
  buildGuideResolveArgs,
  composerEngineMissingForTab,
  shouldCompleteByGuideExhausted,
} from './onboardingAppWiring'
import type { OrgWorkspaceCatalogMap } from '../shared/orgWorkspaceCatalog'
import {
  buildOrgWorkspaceCatalog,
  canAccessOrgWorkspace,
  canRenameOrgWorkspace,
  canUploadOrgWorkspaceFromCatalog,
  catalogForAccount,
  catalogHasWorkspaces,
  findOrgWorkspaceCatalogEntry,
  type OrgWorkspaceCatalog,
  type OrgWorkspaceCatalogEntry,
  isCatalogFresh,
  orgWorkspaceTokenMissing,
  parseOrgWorkspaceCatalogMap,
  patchOrgWorkspaceCatalogName,
  sameGithubLogin,
  syncTabTitlesFromOrgWorkspaceCatalog,
  upsertAccountCatalog,
} from '../shared/orgWorkspaceCatalog'
import { GitPanelModal } from './components/GitPanelModal'
import { GitRepoPickerModal } from './components/GitRepoPickerModal'
import { TabAgenticPlane } from './workspace/TabAgenticPlane'
import {
  buildDelegationMiniNodes,
  buildPlaneThreadNodes,
  mergePlaneMiniThreadRows,
} from './workspace/planeThreadNodes'
import { claimPlaneSendSlot, releasePlaneSendSlot } from './planeSendSlot'
import { markSplashUiReady } from './splash'
import { BrainstormStartModal } from './workspace/BrainstormStartModal'
import { BrainstormRoomView } from './workspace/BrainstormRoomView'
import { BrainstormRoomsView } from './workspace/BrainstormRoomsView'
import {
  createBrainstormLiveSummary,
  tabIdsWithRunningBrainstorm,
  type BrainstormLiveSummary,
} from './workspace/brainstormLiveState'
import { isBrainstormLive } from './workspace/brainstormViewClose'
import {
  filterBrainstormInvitableAgents,
  type BrainstormRoom,
} from '../shared/brainstormRoom'
import type { TabFileExplorerWindowHandle } from './workspace/TabFileExplorerWindow'
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
import { buildTerminalInsertPayload } from '@shared/terminalInsertPayload'
import { APP_OVERLAY_MODAL_Z, QUIT_CONFIRM_Z } from '@shared/overlayZIndex'
import {
  computeBusyForGate,
  mergePaneReportedRunningThreadIds,
  type AgentPlaneStatus,
  type AgentPlaneQueueControls,
  type PlaneSendDelegation,
} from './agent/AgentPane'
import {
  isHumanQueuedTurn,
  queuedTurnSourceSendIds,
  shouldClearPlaneSendForRemovedQueuedTurn,
} from './agent/queuedTurnDedup'
import { mergeQueuedTurns } from './agent/mergeQueuedTurns'
import {
  planeThreadGatingFieldsEqual,
  queuedTurnsPlaneStatusEqual,
  runningThreadActivitiesEqual,
} from './agent/agentPlaneStatusIdle'
import { collectBusyTabIds, collectTabActivityDots } from './agent/paneWorkActive'
import { collectRendererVitalsStats, setRendererVitalsStatsProvider } from './rendererVitals'
import type { TerminalRef } from './terminal/TerminalPane'
import {
  listDelegationTargetsForMeta,
} from './workspace/orchestrationBridge'
import {
  formatDelegationResultFollowUp,
  formatDelegationRoundCapFollowUp,
  buildDelegateWarningFollowUp,
  buildBatchedDelegationFollowUp,
  isDuplicateOrchestrationQueueItem,
  orchestrationFollowUpKey,
  resolveOrchestrationMaxRounds,
  resolveOrchestrationWorkStyle,
  isOrchestrationRoundsUnlimited,
  orchestrationRoundsAtCap,
  shouldAbortOnHumanTurn,
} from '@shared/agentOrchestration'
import type { DelegateRequest, DelegateResult } from '@shared/agentOrchestration'
import {
  buildDelegationTurnSummary,
  isDelegationSummaryPlaceholder,
} from '@shared/delegationTurnSummary'
import {
  awaitingOrchestratorPaneIds,
  awaitingOrchestratorThreadIdsByPane,
  abortOneDelegationInJob,
  abortOrchestrationJob,
  cancelDeferredDelegationsForStoppedPane,
  canReconcileIdlePending,
  createOrchestrationJob,
  decideJobForTurn,
  findJobByDelegation,
  findPendingDelegationByToPane,
  flattenAwaitingItemsFromJobs,
  isJobAwaiting,
  listJobsForPane,
  markPendingSawBusyForPane,
  occupiedTargetPaneIdsAcrossAllJobs,
  occupiedTargetThreadIdsByPane,
  orchestratorPanesWithDeferredForPane,
  orchestratorAwaitingHasLegacyByPane,
  specialistPendingHasLegacyByPane,
  pendingOrchestratorIdsFromJobs,
  resolveIdleReconcileOutcome,
  shouldDeliverOrchestrationJobFollowUp,
  shouldWakeJob,
  supersedeOrchestrationJobsForHumanTurn,
  upsertOrchestrationWaveItem,
  laneDelegationForJob,
  findTrackedDelegationThreadId,
  delegationDispatchKey,
  type OrchestrationJob,
} from '@shared/orchestrationJobs'
import {
  canWakeOrchestratorForJob,
  clearCompletedResultsIfDelivered,
  prepareOrchestratorWakeBatch,
} from '@shared/orchestrationJobWake'
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
  shouldFinalizeWorktreeFromOrchestrator,
} from '@shared/delegationTargets'
import {
  MAX_LANES_PER_PANE,
  resolveDelegationLane,
} from '@shared/delegationLanes'
import {
  buildOrchestrationAwaitingView,
  orchestrationAwaitingSignature,
  type OrchestrationAwaitingView,
} from '@shared/orchestrationAwaiting'
import {
  attachDelegationWorktree,
  deleteDelegationRuntime,
  getDelegationRuntime,
  markDelegationRuntimeStatus,
  registerDelegationRuntime,
  resolveDelegationDelivery,
  type DelegationRuntimeEntry,
  type DelegationRuntimeRegistry,
} from '@shared/delegationRuntimeRegistry'
import {
  buildDuplicateDelegationFollowUp,
  buildRepeatedDispatchFollowUp,
  findDuplicateDelegation,
} from '@shared/delegationDuplicateGuard'
import {
  drainHumanSendFifoForPane,
  enqueueHumanSendForThread,
  MAX_VISIBLE_QUEUED_TURNS,
  purgeFifoBySendId,
} from '@shared/planeHumanSendFifo'
import {
  describeOrchestrationFifoSkip,
  isSystemFollowUpsPendingForPane,
  preferSendSlotIsSystemWork,
  shouldPromoteHumanSendToVisibleQueue,
  threadScopedFlag,
} from './agent/agentInputGuards'
import { countQueuedTurnsForThread } from './agent/countQueuedTurnsForThread'
import {
  applyDelegationLaneStop,
  clearPlaneSendsForOrchestrationAbort,
  clearPlaneSendsForSingleDelegationAbort,
  collectOrchestratorPendingLaneStops,
  resolveSingleDelegationLaneStop,
  shouldDiscardAbortedDelegationFifoHead,
} from './orchestrationAbort'
import { syncReduceMotionDomFlag } from './reduceMotion'
import { isNewTerminalShortcut } from './newTerminalShortcut'
import { platformId } from './platform'
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
import { appendTabToTabsRef } from './appendTabToTabsRef'
import {
  resolveTabAgentMeta,
  syncTabAgentsFromCatalog,
  upsertAgentInList,
} from './projectAgentsStore'
import {
  agentChatRefFor,
  planAgentChatCleanupForRemovedPanes,
  type AgentChatScope,
} from '../shared/agentChatPersistence'
import { composerHistoryFromEntries } from '@shared/composerHistory'
import './styles/app.css'
import { pruneDelegationThreadsForJob } from './delegationThreadPrune'
import { COVENANT_REQUEST_LIMIT, mapWithConcurrency } from '@shared/boundedMap'

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
  agentResultContextIdForSlug,
  buildNewProjectAgentDefinition,
  cloneProjectAgentDefinition,
  isAgentOwnResultContext,
  normalizeAgentSlug,
  remapAgentBindingsInTabs,
  remapAgentResultContextIds,
  remapAgentResultIdsInCatalog,
  remapAgentResultTabContexts,
  threadStateOf,
  type ProjectAgentDefinition,
} from '../shared/projectAgentCatalog'
import {
  DEFAULT_THREAD_ID,
  renameThread,
  resolvePreferredHumanThreadId,
  sanitizeThreadState,
  selectThreadOpened,
  threadPatch,
} from '../shared/agentThreads'
import { buildBootstrapProjectAgentDefinitions } from '../shared/projectAgentBootstrap'
import {
  covenantWorkspaceCatalogKey,
  tabAgentCatalogKey,
} from '../shared/covenantTypes'
import {
  getCovenantApi,
  hasCovenantOrgAdminsApi,
  hasCovenantStatusAllApi,
  hasCovenantWikiApi,
  hasCovenantWorkspaceContentApi,
  hasCovenantWorkspaceReposApi,
  hasCovenantWorkspacesApi,
  type CovenantApi,
} from './covenantApi'
import {
  clearOrgWikiSyncScope,
  seedOrgWikiSyncScope,
  syncOrgWikiPush,
} from './orgWikiSync'
import { retryCovenantResult } from '../shared/covenantRetry'
import { sanitizeSlugSegment } from '../shared/orgWorkspaceContent'
import { orderedAgentIdsFromTab } from '../shared/orgWorkspaceLocalSync'
import {
  downloadOrgWorkspaceToLocal,
  planOrgWorkspaceUpload,
  uploadOrgWorkspaceFromLocal,
  type OrgWorkspaceMaterializeDeps,
  type OrgWorkspaceSyncPhase,
} from './orgWorkspaceMaterialize'
import {
  promoteLocalWorkspaceToOrg,
  promoteReposFromDetected,
  type PromotePhase,
} from './orgWorkspacePromote'
import type {
  PromoteWorkspaceConfirmPayload,
  PromoteWorkspaceOrgOption,
  PromoteWorkspaceRepoOption,
} from './components/PromoteWorkspaceModal'
import {
  OrgWorkspaceRequirementModal,
  type OrgWorkspaceRequirementState,
} from './components/OrgWorkspaceRequirementModal'
import {
  OrgSyncScopeModal,
  type OrgSyncScopePlan,
} from './components/OrgSyncScopeModal'
import {
  removeAgentFromLoopChains,
  planeLoopChainsForPersist,
} from '../shared/planeLoopChain'

export type { TabSession, TabSplitSizes } from '../shared/tabSession'

function reorderPaneIdsAfterClose(paneIds: string[], closedPaneId: string): string[] {
  return paneIds.filter(id => id !== closedPaneId)
}

function releaseDelegateDispatchKeyForJob(
  delegateDispatchKeysByJobRef: React.MutableRefObject<Map<string, Map<string, string>>>,
  jobId: string,
  delegationId: string,
): void {
  const keysByJob = delegateDispatchKeysByJobRef.current.get(jobId)
  if (!keysByJob) return
  for (const [key, value] of keysByJob.entries()) {
    if (value === delegationId) keysByJob.delete(key)
  }
}

/** Marca que las pestañas ya fueron cargadas desde persistencia (o se creó la primera). */
type SessionReady = { loaded: boolean }

let tabCounter = 0
const NO_THREAD_IDS: readonly string[] = []
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

function countActiveLanesByPane(
  jobsByPane: ReadonlyMap<string, ReadonlyMap<string, OrchestrationJob>>,
): Map<string, number> {
  const map = new Map<string, number>()
  for (const jobsMap of jobsByPane.values()) {
    for (const job of jobsMap.values()) {
      for (const meta of job.pending.values()) {
        map.set(meta.toPaneId, (map.get(meta.toPaneId) ?? 0) + 1)
      }
    }
  }
  return map
}

function liveLaneThreadIdsForPane(
  paneId: string,
  jobsByPane: ReadonlyMap<string, ReadonlyMap<string, OrchestrationJob>>,
): Set<string> {
  const ids = new Set<string>()
  for (const jobsMap of jobsByPane.values()) {
    for (const job of jobsMap.values()) {
      for (const meta of job.pending.values()) {
        if (meta.toPaneId === paneId && meta.toThreadId) {
          ids.add(meta.toThreadId)
        }
      }
    }
  }
  return ids
}

export type OrgWorkspaceUploadGateResult =
  | { proceed: true }
  | { proceed: false; uploadError: string }

/** Gate de subida org: entrada que deniega → error; sin entrada → el server decide. */
export function resolveOrgWorkspaceUploadGate(
  entry: OrgWorkspaceCatalogEntry | undefined,
): OrgWorkspaceUploadGateResult {
  if (entry && entry.canRename !== true) {
    return { proceed: false, uploadError: 'not allowed to publish this workspace' }
  }
  return { proceed: true }
}

/** Cuenta Covenant de una pestaña org: persistida o resuelta por carpeta. */
export function orgAccountIdForTab(
  tab: TabSession,
  resolveAccountId: (cwd: string | undefined | null) => string,
): string {
  return tab.orgWorkspace?.accountId?.trim()
    || resolveAccountId(tab.projectFolder ?? tab.orgWorkspace?.localDir ?? '')
}

/** Cuenta Covenant para un cwd org: pestaña coincidente o fallback por carpeta. */
export function orgAccountIdForCwd(
  tabs: readonly TabSession[],
  cwd: string,
  resolveAccountId: (cwd: string | undefined | null) => string,
): string {
  const normalized = cwd.trim()
  if (!normalized) return resolveAccountId(cwd)
  const tab = tabs.find(item => {
    const localDir = item.orgWorkspace?.localDir?.trim()
    const projectFolder = item.projectFolder?.trim()
    return localDir === normalized || projectFolder === normalized
  })
  const persisted = tab?.orgWorkspace?.accountId?.trim()
  if (persisted) return persisted
  return resolveAccountId(cwd)
}

/** Catálogo org de la cuenta dueña de la pestaña. */
export function orgCatalogForTab(
  map: OrgWorkspaceCatalogMap | null,
  tab: TabSession,
  resolveAccountId: (cwd: string | undefined | null) => string,
): OrgWorkspaceCatalog | null {
  return catalogForAccount(map, orgAccountIdForTab(tab, resolveAccountId))
}

function removeAccountCatalog(
  map: OrgWorkspaceCatalogMap | null | undefined,
  accountId: string,
): OrgWorkspaceCatalogMap | null {
  if (!map) return null
  const key = accountId.trim()
  if (!(key in map.byAccount)) return map
  const byAccount = { ...map.byAccount }
  delete byAccount[key]
  return Object.keys(byAccount).length ? { byAccount } : null
}

function syncAllOrgTabTitlesFromMap(
  tabs: readonly TabSession[],
  map: OrgWorkspaceCatalogMap | null,
  resolveAccountId: (cwd: string | undefined | null) => string,
): TabSession[] | null {
  let merged = tabs
  let changed = false
  for (const tab of tabs) {
    if (!tab.orgWorkspace) continue
    const cat = orgCatalogForTab(map, tab, resolveAccountId)
    const synced = syncTabTitlesFromOrgWorkspaceCatalog([tab], cat)
    if (!synced) continue
    merged = merged.map(item => (item.id === tab.id ? synced[0]! : item))
    changed = true
  }
  return changed ? merged : null
}

function catalogEntryChanged(
  prev: OrgWorkspaceCatalog | undefined,
  next: OrgWorkspaceCatalog,
): boolean {
  if (!prev) return true
  if (prev.login !== next.login || prev.entries.length !== next.entries.length) return true
  return prev.entries.some((e, i) => {
    const n = next.entries[i]!
    return (
      e.slug !== n.slug
      || e.orgName !== n.orgName
      || e.workspaceId !== n.workspaceId
      || e.name !== n.name
      || e.canRename !== n.canRename
    )
  })
}

export function findPendingDelegationForThread(
  jobsByPane: ReadonlyMap<string, ReadonlyMap<string, OrchestrationJob>>,
  paneId: string,
  threadId: string,
): { delegationId: string } | undefined {
  for (const jobsMap of jobsByPane.values()) {
    for (const job of jobsMap.values()) {
      for (const [delegationId, meta] of job.pending.entries()) {
        if (meta.toPaneId === paneId && meta.toThreadId === threadId) {
          return { delegationId }
        }
      }
    }
  }
  return undefined
}

/** Updater de `onSelectThread` del plano: registra hilos de delegación pendientes. */
export function applyPlaneSelectThreadMeta(
  previous: AgentPaneMeta,
  paneId: string,
  threadId: string,
  now: number,
  jobsByPane: ReadonlyMap<string, ReadonlyMap<string, OrchestrationJob>>,
): AgentPaneMeta {
  const protectedIds = liveLaneThreadIdsForPane(paneId, jobsByPane)
  const sanitized = sanitizeThreadState(
    previous.threads,
    previous.activeThreadId,
    undefined,
    protectedIds,
  )
  const existsInCatalog = (previous.threads ?? []).some(thread => thread.id === threadId)
  let state = sanitized
  if (!existsInCatalog) {
    const pending = findPendingDelegationForThread(jobsByPane, paneId, threadId)
    if (pending) {
      state = {
        ...sanitized,
        threads: [
          ...sanitized.threads,
          {
            id: threadId,
            title: '',
            updatedAt: now,
            origin: 'delegation',
            delegationId: pending.delegationId,
          },
        ],
      }
    }
  }
  return {
    ...previous,
    ...threadPatch(selectThreadOpened(state, threadId, now)),
  }
}

/** Filas de CLI para el guard async de envío del plano durante onboarding. */
export async function resolveOnboardingSendGuardCliRows(
  guideLocked: boolean,
  cachedClis: OnboardingCliRow[],
  refreshOnboardingClis: () => Promise<OnboardingCliRow[]>,
): Promise<OnboardingCliRow[]> {
  if (guideLocked) {
    return refreshOnboardingClis()
  }
  return cachedClis.length > 0 ? cachedClis : refreshOnboardingClis()
}

/** Decide si persistir onboardingSentFirstMessage tras encolar un envío humano del plano. */
export async function evaluateOnboardingPlaneSendPersistGuard(args: {
  guideLocked: boolean
  cachedClis: OnboardingCliRow[]
  refreshOnboardingClis: () => Promise<OnboardingCliRow[]>
  orchestratorPath: OrchestratorPath | ''
  paneId: string
  paneKinds?: Record<string, unknown>
  resolveProvider: (paneId: string) => string | undefined
}): Promise<boolean> {
  const rows = await resolveOnboardingSendGuardCliRows(
    args.guideLocked,
    args.cachedClis,
    args.refreshOnboardingClis,
  )
  const cliAllMissing = clisAllMissing(rows)
  return resolveComposerSendBlock({
    incomplete: args.guideLocked,
    path: args.orchestratorPath,
    cliAllMissing,
    engineMissing: composerEngineMissingForTab(
      {
        planeOpenChatAgentId: args.paneId,
        paneKinds: args.paneKinds,
      },
      args.resolveProvider,
    ),
  }) === 'none'
}

export const App: React.FC = () => {
  const { t } = useT()
  const [tabs, setTabs] = useState<TabSession[]>([])
  const [activeTabId, setActiveTabId] = useState<string>('')
  const [config, setConfig] = useState<AppConfig>(CONFIG_DEFAULTS)
  const [configReady, setConfigReady] = useState(false)
  const [sessionReady, setSessionReady] = useState<SessionReady>({ loaded: false })
  /** Splash: sin animar ranuras hasta el primer layout estable del plano. */
  const splashLayoutPendingRef = useRef(true)
  const [splashLayoutPending, setSplashLayoutPending] = useState(true)
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
  const [workspaceAccountByCwd, setWorkspaceAccountByCwd] = useState<Record<string, string>>({})
  const workspaceAccountByCwdRef = useRef(workspaceAccountByCwd)
  workspaceAccountByCwdRef.current = workspaceAccountByCwd
  const accountIdForCwd = useCallback((cwd: string | undefined | null): string => {
    const key = cwd?.trim() ?? ''
    if (!key) return ''
    return workspaceAccountByCwdRef.current[key] ?? ''
  }, [])
  const resolveOrgAccountIdForCwd = useCallback((cwd: string) => (
    orgAccountIdForCwd(tabsRef.current, cwd, accountIdForCwd)
  ), [accountIdForCwd])
  const handleGithubAccountChanged = useCallback((cwd: string, accountId: string | null) => {
    const key = cwd.trim()
    if (!key) return
    const id = accountId ?? ''
    setWorkspaceAccountByCwd(prev => (prev[key] === id ? prev : { ...prev, [key]: id }))
  }, [])
  const handleGithubAccountDeleted = useCallback((accountId: string) => {
    const setFn = window.api?.githubWorkspaceAccountSet
    for (const [cwd, boundId] of Object.entries(workspaceAccountByCwdRef.current)) {
      if (boundId !== accountId) continue
      if (typeof setFn === 'function') void setFn(cwd, null)
      handleGithubAccountChanged(cwd, null)
    }
  }, [handleGithubAccountChanged])
  const [busyPanes, setBusyPanes] = useState<Set<string>>(new Set())
  const busyPanesRef = useRef(busyPanes)
  busyPanesRef.current = busyPanes
  const [settingsOpen, setSettingsOpen] = useState(false)
  /** Confirm de salida pedido por main (⌘Q / botón rojo). */
  const [quitConfirmOpen, setQuitConfirmOpen] = useState(false)
  const [onboardingClis, setOnboardingClis] = useState<OnboardingCliRow[]>([])
  const [onboardingClisMissing, setOnboardingClisMissing] = useState(false)
  const [brainstormSetupDraftByTab, setBrainstormSetupDraftByTab] = useState<
    Record<string, { goalFilled: boolean; participantCount: number }>
  >({})
  const [brainstormHumanSpokeByRoom, setBrainstormHumanSpokeByRoom] = useState<
    Record<string, boolean>
  >({})
  const onboardingClisRefreshOnceRef = useRef(false)
  const onboardingClisMissingLockedRef = useRef(false)
  const onboardingCompletedVersionRef = useRef<string>(config.onboardingCompletedVersion ?? '')
  const [orgModalOpen, setOrgModalOpen] = useState(false)
  const [orgWorkspacePickerOpen, setOrgWorkspacePickerOpen] = useState(false)
  const [promoteWorkspaceTab, setPromoteWorkspaceTab] = useState<TabSession | null>(null)
  const [promoteWorkspaceOrgs, setPromoteWorkspaceOrgs] = useState<PromoteWorkspaceOrgOption[]>([])
  const [promoteWorkspaceOrgsReason, setPromoteWorkspaceOrgsReason] = useState<
    'signedOut' | 'noAdminOrg' | undefined
  >()
  const [promoteWorkspaceRepos, setPromoteWorkspaceRepos] = useState<PromoteWorkspaceRepoOption[]>([])
  const [promoteWorkspaceBusy, setPromoteWorkspaceBusy] = useState(false)
  const [promoteWorkspacePhase, setPromoteWorkspacePhase] = useState<PromotePhase | undefined>()
  const [promoteWorkspaceError, setPromoteWorkspaceError] = useState<string | undefined>()
  /** Tabs org cuyo resync manual está en curso. */
  const [resyncingWorkspaceTabs, setResyncingWorkspaceTabs] = useState<Set<string>>(() => new Set())
  const [uploadingWorkspaceTabs, setUploadingWorkspaceTabs] = useState<Set<string>>(() => new Set())
  const [workspaceUploadProgressByTab, setWorkspaceUploadProgressByTab] = useState<
    Record<string, number>
  >({})
  /** Snapshot Cmd+T: null = aún no hidratado / sin sesión. */
  const [orgWorkspaceCatalogMap, setOrgWorkspaceCatalogMap] = useState<OrgWorkspaceCatalogMap | null>(null)
  const orgWorkspaceCatalogMapRef = useRef<OrgWorkspaceCatalogMap | null>(null)
  const orgWorkspaceCatalogLoadingRef = useRef(false)
  const orgWorkspaceCatalogLoadGenRef = useRef(0)
  const [orgWorkspaceRequirement, setOrgWorkspaceRequirement] =
    useState<OrgWorkspaceRequirementState | null>(null)

  const reportOrgSyncPhase = useCallback((phase: OrgWorkspaceSyncPhase) => {
    setOrgWorkspaceRequirement(prev => (
      prev?.syncing ? { ...prev, syncPhase: phase } : prev
    ))
  }, [])
  const reportWorkspaceUploadProgress = useCallback((tabId: string, percent: number) => {
    const clamped = Math.min(100, Math.max(0, Math.round(percent)))
    setWorkspaceUploadProgressByTab(prev => ({ ...prev, [tabId]: clamped }))
  }, [])
  const clearWorkspaceUploadProgress = useCallback((tabId: string) => {
    setWorkspaceUploadProgressByTab(prev => {
      if (!(tabId in prev)) return prev
      const next = { ...prev }
      delete next[tabId]
      return next
    })
  }, [])
  /** Invalida sync/upload en curso al cancelar con Espacio. */
  const orgWorkspaceSyncUploadGenRef = useRef(0)
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
  const planeQueueControlsByPaneRef = useRef(new Map<string, AgentPlaneQueueControls>())
  const [tabContextsByTab, setTabContextsByTab] = useState<Record<string, TabContext[]>>({})
  /** Fuerza rediscovery de contextos en AgentPane tras rename de results. */
  const [contextsRevisionByCwd, setContextsRevisionByCwd] = useState<Record<string, number>>({})
  /** Catálogo `.gravity/agents` indexado por projectFolder. */
  const [projectAgentsByCwd, setProjectAgentsByCwd] = useState<Record<string, ProjectAgentDefinition[]>>({})
  const projectAgentsByCwdRef = useRef(projectAgentsByCwd)
  projectAgentsByCwdRef.current = projectAgentsByCwd
  const resyncOrgWorkspaceRef = useRef<(
    tab: TabSession,
    options?: { includeAgents?: boolean },
  ) => Promise<void>>(async () => {})
  const syncOrgWorkspaceContentRef = useRef<(
    slug: string,
    workspaceId: string,
    tabIds: string[],
    options?: { wipeLocal?: boolean; includeAgents?: boolean },
  ) => Promise<{ agentsOk: boolean; contextsOk: boolean; wikiError?: string }>>(async () => ({
    agentsOk: false,
    contextsOk: false,
  }))
  const [orgSyncScopeTab, setOrgSyncScopeTab] = useState<TabSession | null>(null)
  const [orgUploadScopeTab, setOrgUploadScopeTab] = useState<TabSession | null>(null)
  const [orgUploadPlan, setOrgUploadPlan] = useState<OrgSyncScopePlan | null>(null)
  const [orgUploadPlanLoading, setOrgUploadPlanLoading] = useState(false)
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
    /** Identidad del envío: el pane consume una sola vez por sendId. */
    sendId?: string
    focusPane?: boolean
    /** Contextos adjuntos solo a este turno (drop en el composer). */
    extraContextIds?: string[]
    orchestrationFollowUp?: boolean
    allowDelegations?: boolean
    orchestrationJobId?: string
    delegation?: PlaneSendDelegation
  }>>({})
  type PlaneSendSlots = typeof planeSendByPane
  /**
   * Espejo síncrono del buzón. El drenaje necesita saber en el acto si pudo
   * tomar el hueco: leer un booleano puesto dentro del updater de `setState`
   * mentía (el updater corre después) y el envío terminaba duplicado — en el
   * buzón y de vuelta en la FIFO —, que es lo que dejaba la cola humana
   * congelada para siempre. El ref manda; el estado es el espejo para pintar.
   */
  const planeSendByPaneRef = useRef<PlaneSendSlots>(planeSendByPane)
  const updatePlaneSendByPane = useCallback((
    updater: (prev: PlaneSendSlots) => PlaneSendSlots,
  ): PlaneSendSlots => {
    const next = updater(planeSendByPaneRef.current)
    planeSendByPaneRef.current = next
    setPlaneSendByPane(next)
    return next
  }, [])
  const [planeStopPaneIds, setPlaneStopPaneIds] = useState<ReadonlySet<string>>(() => new Set())
  const [planeClearPaneId, setPlaneClearPaneId] = useState<string | null>(null)
  const [planeNewThreadPaneId, setPlaneNewThreadPaneId] = useState<string | null>(null)
  const [planeQueueFullNotice, setPlaneQueueFullNotice] = useState<{
    paneId: string
    text: string
    at: number
  } | null>(null)
  const planeNewThreadPaneIdRef = useRef(planeNewThreadPaneId)
  planeNewThreadPaneIdRef.current = planeNewThreadPaneId
  const [planeLoopsOpenByTab, setPlaneLoopsOpenByTab] = useState<Record<string, boolean>>({})
  /**
   * Salas por tab, en orden de convocatoria. Son varias a la vez: main ya
   * lleva un runner por `roomId`, así que el límite era solo del renderer.
   */
  const [brainstormRoomsByTab, setBrainstormRoomsByTab] = useState<Record<string, BrainstormRoom[]>>({})
  /**
   * Qué mira el usuario dentro del módulo: la biblioteca, el alta, o una sala
   * por su id. Estado de vista, no de sesión —cerrar no detiene nada—, y por eso
   * las tres vistas comparten un solo campo en vez de tres booleanos que podían
   * quedar abiertos a la vez.
   */
  const [brainstormViewByTab, setBrainstormViewByTab] = useState<
    Record<string, 'rooms' | 'setup' | string | null>
  >({})
  /** Actas en disco por tab: decide si el botón abre la biblioteca o el alta. */
  const [brainstormSavedCountByTab, setBrainstormSavedCountByTab] = useState<Record<string, number>>({})
  const [brainstormDockOpenByTab, setBrainstormDockOpenByTab] = useState<Record<string, boolean>>({})
  /** Estado vivo por sala: la clave es el `roomId`, no el tab. */
  const [brainstormLiveByRoomId, setBrainstormLiveByRoomId] = useState<Record<string, BrainstormLiveSummary>>({})
  const [orchestrationFifoTick, setOrchestrationFifoTick] = useState(0)
  const [humanSendFifoTick, setHumanSendFifoTick] = useState(0)
  /** Override efímero de cwd por-pane (paneId → worktree absoluto); Fase 3, no persistido. */
  const [paneCwdOverrideTick, setPaneCwdOverrideTick] = useState(0)
  const paneCwdOverrideRef = useRef(new Map<string, string>())
  /** Cola de envíos de orquestación (delegaciones + follow-ups) por pane. */
  const orchestrationFifoByPaneRef = useRef(new Map<string, Array<{
    text: string
    images: AgentCliImageAttachment[]
    sendId?: string
    focusPane?: boolean
    orchestrationFollowUp?: boolean
    allowDelegations?: boolean
    orchestrationJobId?: string
    delegation?: PlaneSendDelegation
  }>>())
  /** Un warn por (pane, motivo) mientras la FIFO de orquestación no se ofrece. */
  const loggedOrchestrationSkipKeysRef = useRef(new Set<string>())
  const humanDirectDrainInFlightRef = useRef(new Set<string>())
  const humanSendFifoByPaneRef = useRef(new Map<string, Array<{
    text: string
    images: AgentCliImageAttachment[]
    sendId?: string
    focusPane?: boolean
    extraContextIds?: string[]
    threadId?: string
    orchestrationFollowUp?: boolean
    allowDelegations?: boolean
    delegation?: PlaneSendDelegation
  }>>())
  /**
   * Follow-ups de orquestación ya despachados por pane (clave job+texto). Sin
   * esto, un follow-up ya consumido se reencola idéntico sin tope; un turno
   * humano en el pane limpia la memoria.
   */
  const dispatchedOrchestrationFollowUpsByPaneRef = useRef(new Map<string, Set<string>>())
  /**
   * Jobs de orquestación por pane (linear ≤1; turbo N).
   * Reemplaza pending/deferred/wave/rounds/completed por-mapa plano.
   */
  const orchestrationJobsByPaneRef = useRef(new Map<string, Map<string, OrchestrationJob>>())
  /** Líneas de warning de delegate ya encoladas por job (dedupe L6). */
  const delegateWarningsSeenByJobRef = useRef(new Map<string, Set<string>>())
  /** Claves de despacho ya minteadas por job (idempotencia ante delegate duplicado). */
  const delegateDispatchKeysByJobRef = useRef(new Map<string, Map<string, string>>())
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
    toThreadId: string
    worktreePath: string
    branch: string
    baseCwd: string
    baseBranch: string
  }>())
  /** Fase 4: cola de merges serializada por orquestador (encadena promesas, evita carreras git). */
  const mergeQueueByOrchestratorRef = useRef(new Map<string, Promise<void>>())
  /**
   * Registry central de delegaciones por delegationId. Fuente de verdad para
   * cleanup terminal cuando el job "oficial" en `orchestrationJobsByPaneRef`
   * ya no está (superseded, remount, resultado tardío). Ver
   * `src/shared/delegationRuntimeRegistry.ts` para el racional.
   */
  const delegationRuntimeByIdRef = useRef<DelegationRuntimeRegistry>(new Map())
  const [awaitingDelegationPaneIds, setAwaitingDelegationPaneIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const [delegationTargetPaneIds, setDelegationTargetPaneIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const [delegationThreadIdsByPane, setDelegationThreadIdsByPane] = useState<
    ReadonlyMap<string, string[]>
  >(() => new Map())
  const [awaitingDelegationThreadIdsByPane, setAwaitingDelegationThreadIdsByPane] = useState<
    ReadonlyMap<string, string[]>
  >(() => new Map())
  const [awaitingDelegationLegacyFallbackPaneIds, setAwaitingDelegationLegacyFallbackPaneIds] =
    useState<ReadonlySet<string>>(() => new Set())
  const [delegationWorkLegacyFallbackPaneIds, setDelegationWorkLegacyFallbackPaneIds] =
    useState<ReadonlySet<string>>(() => new Set())
  /** Especialista idle con pending huérfano → completar (notify perdido / remount). */
  const closeOrchestrationStateForPaneRef = useRef<(paneId: string) => void>(() => {})
  const reconcileIdleDelegationTargetRef = useRef<(
    paneId: string,
    summary: string,
    failed: boolean,
  ) => void>(() => undefined)
  const reconcilingIdleDelegationPaneIdsRef = useRef(new Set<string>())
  const syncAwaitingFromPending = useCallback(() => {
    const byPane = orchestrationJobsByPaneRef.current
    setAwaitingDelegationPaneIds(awaitingOrchestratorPaneIds(byPane))
    setDelegationTargetPaneIds(occupiedTargetPaneIdsAcrossAllJobs(byPane))
    setDelegationThreadIdsByPane(occupiedTargetThreadIdsByPane(byPane))
    setAwaitingDelegationThreadIdsByPane(awaitingOrchestratorThreadIdsByPane(byPane))
    setAwaitingDelegationLegacyFallbackPaneIds(orchestratorAwaitingHasLegacyByPane(byPane))
    setDelegationWorkLegacyFallbackPaneIds(specialistPendingHasLegacyByPane(byPane))

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
      const tab = tabsRef.current.find(item => (item.paneIds ?? []).includes(fromPaneId))
      const catalogKey = tab ? tabAgentCatalogKey(tab) : ''
      const catalog = catalogKey ? (projectAgentsByCwdRef.current[catalogKey] ?? []) : []
      const view = buildOrchestrationAwaitingView(flat, { catalog })
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
      if (!status || status.busy || status.awaitingDelegations) continue
      const pending = findPendingDelegationByToPane(byPane, toPaneId)
      if (!pending || !canReconcileIdlePending(pending.sawBusy, {
        startedAt: pending.startedAt,
        nowMs: Date.now(),
      })) continue
      reconcileIdleDelegationTargetRef.current(
        toPaneId,
        status.lastSnippet,
        status.lastTurnFailed === true,
      )
    }
  }, [])
  /**
   * La salida por antigüedad de `canReconcileIdlePending` solo sirve si algo la
   * vuelve a mirar: un especialista parado no publica estado, así que sin este
   * latido el pending envejecido no se revisaría nunca.
   */
  useEffect(() => {
    // También con la ola ya cerrada: un pending huérfano sin nadie awaiting
    // mantiene `delegationWorkActive` en su target y le congela la cola humana
    // (el chip se queda "en cola" con el pane idle). Ahí el latido es la única
    // salida, porque ese pane tampoco vuelve a publicar estado.
    if (awaitingDelegationPaneIds.size === 0 && delegationTargetPaneIds.size === 0) return
    const timer = window.setInterval(() => { syncAwaitingFromPending() }, 15_000)
    return () => window.clearInterval(timer)
  }, [awaitingDelegationPaneIds, delegationTargetPaneIds, syncAwaitingFromPending])

  const [planeContextsModalTabId, setPlaneContextsModalTabId] = useState<string | null>(null)
  const [planeContextsFocusId, setPlaneContextsFocusId] = useState<string | null>(null)
  const [planeContextsCreate, setPlaneContextsCreate] = useState(false)
  const [resultsPreview, setResultsPreview] = useState<{
    tabId: string
    context: TabContext
  } | null>(null)
  const termRefs = useRef<Map<string, TerminalRef>>(new Map())
  const pendingTerminalInsertRef = useRef<{ tabId: string; payload: string } | null>(null)
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

  // Contadores para `crash-diagnostics.log`: lee de refs cuando el muestreo lo
  // pide (cada 20 s), no en cada render.
  useEffect(() => {
    setRendererVitalsStatsProvider(() => collectRendererVitalsStats(
      tabsRef.current,
      busyPanesRef.current,
      agentPlaneStatusRef.current,
    ))
    return () => setRendererVitalsStatsProvider(null)
  }, [])

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
  const cleanupRemovedAgentPanes = useCallback((
    paneIds: string[],
    options?: {
      removedAgentByPane?: Record<string, string>
      catalogAgentIds?: ReadonlySet<string>
      scope?: AgentChatScope
    },
  ) => {
    for (const paneId of paneIds) {
      window.api.stopAgentTurn(paneId)
      termRefs.current.delete(paneId)
      splitSpawnCwdRef.current.delete(paneId)
      delete cwdsRef.current[paneId]
      planeQueueControlsByPaneRef.current.delete(paneId)
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
    updatePlaneSendByPane(prev => {
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
    const chatActions = planAgentChatCleanupForRemovedPanes(
      paneIds.map(paneId => ({
        paneId,
        agentId: options?.removedAgentByPane?.[paneId],
      })),
      options?.catalogAgentIds ?? new Set(),
      options?.scope ?? {},
    )
    setTimeout(() => {
      for (const paneId of paneIds) {
        window.api.deleteScrollback(paneId)
        window.api.deleteAiChat(paneId)
        window.api.deleteCmdHistory(paneId)
        window.api.deleteInteractionsLog(paneId)
      }
      for (const action of chatActions) {
        if (action.type === 'preserve') {
          // Migra legacy paneId → clave estable; no borra el transcript. Solo
          // el hilo inicial: es el único que pudo escribirse antes de threads.
          void window.api.loadAgentChat(action.ref, DEFAULT_THREAD_ID)
          continue
        }
        window.api.deleteAgentChat(action.ref)
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
    const synced = syncTabAgentsFromCatalog(current, agents, {
      createPaneId: () => crypto.randomUUID(),
      createWindow: (paneWindows, open) => createPaneWindowState(paneWindows, open),
      // Las sesiones CLI viven en memoria (también en org) para --resume entre
      // turnos. Al persistir/cargar session.json, stripOrgTabAgentCliSessionIds
      // las quita para que no viajen en el snapshot compartido.
    })
    if (!synced.changed) return
    if (synced.removedPaneIds.length) {
      const removedAgentByPane: Record<string, string> = {}
      for (const paneId of synced.removedPaneIds) {
        const agentId = current.agentByPane?.[paneId]?.agentId?.trim()
        if (agentId) removedAgentByPane[paneId] = agentId
      }
      const orgSlug = current.orgWorkspace?.slug?.trim() ?? ''
      const orgWorkspaceId = current.orgWorkspace?.workspaceId?.trim() ?? ''
      cleanupRemovedAgentPanes(synced.removedPaneIds, {
        removedAgentByPane,
        catalogAgentIds: new Set(agents.map(agent => agent.id)),
        scope: {
          ...(current.projectFolder?.trim()
            ? { projectFolder: current.projectFolder.trim() }
            : {}),
          ...(orgSlug && orgWorkspaceId
            ? { orgWorkspace: { slug: orgSlug, workspaceId: orgWorkspaceId } }
            : {}),
        },
      })
    }
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
    options: {
      wipeLocal?: boolean
      includeAgents?: boolean
      cancelGen?: number
      onPhase?: (phase: OrgWorkspaceSyncPhase) => void
    } = {},
  ): Promise<{ agentsOk: boolean; contextsOk: boolean; wikiError?: string; cancelled?: boolean }> => {
    const targets = tabsRef.current.filter(tab => tabIds.includes(tab.id))
    const folders = [...new Set(
      targets
        .map(tab => tab.projectFolder?.trim() || tab.orgWorkspace?.localDir?.trim() || '')
        .filter(Boolean),
    )]
    if (!folders.length) {
      return { agentsOk: false, contextsOk: false }
    }

    const isCancelled = options.cancelGen !== undefined
      ? () => options.cancelGen !== orgWorkspaceSyncUploadGenRef.current
      : undefined
    if (isCancelled?.()) {
      return { agentsOk: true, contextsOk: true, cancelled: true }
    }

    const buildDeps = (cwd: string, covenant: CovenantApi): OrgWorkspaceMaterializeDeps => ({
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
      // Pull de wiki org + seed del caché de push (no re-pushear lo bajado).
      ...(hasCovenantWikiApi(covenant) && typeof window.api.syncReplaceWikiPages === 'function'
        ? {
            listRemoteWikiPages: () => (
              retryCovenantResult(() => covenant.listWikiPages(slug, workspaceId))
            ),
            replaceLocalWikiPages: (root, pages) => window.api.syncReplaceWikiPages(root, pages),
            ...(typeof window.api.syncReplaceWikiLog === 'function'
              ? {
                  listRemoteWikiLog: () => (
                    retryCovenantResult(() => covenant.listWikiLog(slug, workspaceId))
                  ),
                  replaceLocalWikiLog: (
                    root: string,
                    entries: Array<{ entry: string; createdBy?: string | null; createdAt?: number }>,
                  ) => window.api.syncReplaceWikiLog(root, entries),
                }
              : {}),
            onWikiPagesReplaced: (
              pages: Parameters<typeof seedOrgWikiSyncScope>[1],
              logEntryCount: number | null,
            ) => (
              seedOrgWikiSyncScope({ orgSlug: slug, workspaceId }, pages, logEntryCount)
            ),
          }
        : {}),
    })

    let agentsOk = true
    let contextsOk = true
    let wikiError: string | undefined
    for (const cwd of folders) {
      if (isCancelled?.()) {
        return { agentsOk: true, contextsOk: true, cancelled: true }
      }
      const covenant = getCovenantApi(resolveOrgAccountIdForCwd(cwd))
      if (!covenant || !hasCovenantWorkspaceContentApi(covenant)) {
        agentsOk = false
        contextsOk = false
        continue
      }
      const preferredAgentIds = targets
        .filter(tab => (
          (tab.projectFolder?.trim() || tab.orgWorkspace?.localDir?.trim() || '') === cwd
        ))
        .flatMap(tab => orderedAgentIdsFromTab(tab))
      const result = await downloadOrgWorkspaceToLocal(cwd, buildDeps(cwd, covenant), {
        wipeLocal: options.wipeLocal === true,
        ...(options.includeAgents !== undefined ? { includeAgents: options.includeAgents } : {}),
        ...(preferredAgentIds.length ? { preferredAgentIds } : {}),
        orgWorkspaceScope: {
          orgSlug: slug,
          slug,
          workspaceId,
          localDir: cwd,
        },
        ...(options.onPhase ? { onPhase: options.onPhase } : {}),
        ...(isCancelled ? { isCancelled } : {}),
      })
      if (result.cancelled) {
        return { agentsOk: true, contextsOk: true, cancelled: true }
      }
      if (!result.agentsOk) agentsOk = false
      if (!result.contextsOk) contextsOk = false
      if (result.wikiError && !wikiError) wikiError = result.wikiError
      if (isCancelled?.()) {
        return { agentsOk: true, contextsOk: true, cancelled: true }
      }
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
    if (wikiError) {
      const cancelled = options.cancelGen !== undefined
        && options.cancelGen !== orgWorkspaceSyncUploadGenRef.current
      if (!cancelled) {
        setOrgWorkspaceRequirement(prev => {
          if (!prev) return { wikiError }
          const {
            syncing: _syncing,
            cloning: _cloning,
            uploading: _uploading,
            ...rest
          } = prev
          return { ...rest, wikiError }
        })
      }
    }
    return { agentsOk, contextsOk, ...(wikiError ? { wikiError } : {}) }
  }, [resolveOrgAccountIdForCwd, refreshProjectAgents, syncTabWithProjectAgents])
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

      const map = parseOrgWorkspaceCatalogMap(cfg.orgWorkspaceCatalogCache)
      orgWorkspaceCatalogMapRef.current = map
      setOrgWorkspaceCatalogMap(map)
      setConfigReady(true)
    })
  }, [])

  const applyOrgWorkspaceCatalogMap = useCallback((next: OrgWorkspaceCatalogMap | null) => {
    orgWorkspaceCatalogMapRef.current = next
    setOrgWorkspaceCatalogMap(next)
    const synced = syncAllOrgTabTitlesFromMap(tabsRef.current, next, accountIdForCwd)
    if (synced) {
      tabsRef.current = synced
      setTabs(synced)
    }
  }, [accountIdForCwd])

  const applyOrgWorkspaceCatalogForAccount = useCallback((
    accountId: string,
    cat: OrgWorkspaceCatalog | null,
  ) => {
    const next = cat
      ? upsertAccountCatalog(orgWorkspaceCatalogMapRef.current, accountId, cat)
      : removeAccountCatalog(orgWorkspaceCatalogMapRef.current, accountId)
    orgWorkspaceCatalogMapRef.current = next
    setOrgWorkspaceCatalogMap(next)
    const synced = syncAllOrgTabTitlesFromMap(tabsRef.current, next, accountIdForCwd)
    if (synced) {
      tabsRef.current = synced
      setTabs(synced)
    }
  }, [accountIdForCwd])

  const persistOrgWorkspaceCatalogCache = useCallback(async (
    next: OrgWorkspaceCatalogMap | null,
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
      const accountIds = new Set<string>([''])
      const defaultApi = getCovenantApi()
      if (defaultApi && hasCovenantStatusAllApi(defaultApi)) {
        const allStatus = await defaultApi.statusAll()
        if (gen !== orgWorkspaceCatalogLoadGenRef.current) return
        if (allStatus.ok) {
          for (const [id, statusRow] of Object.entries(allStatus.data)) {
            if (statusRow.signedIn) accountIds.add(id)
          }
        }
      }
      for (const tab of tabsRef.current) {
        if (!tab.orgWorkspace) continue
        accountIds.add(orgAccountIdForTab(tab, accountIdForCwd))
      }

      let map = orgWorkspaceCatalogMapRef.current
      let structuralChanged = false

      for (const accountId of accountIds) {
        const covenant = getCovenantApi(accountId)
        if (!covenant) {
          const removed = removeAccountCatalog(map, accountId)
          if (removed !== map) {
            map = removed
            structuralChanged = true
          }
          continue
        }
        const status = await covenant.status()
        if (gen !== orgWorkspaceCatalogLoadGenRef.current) return
        if (!status.ok || !status.data.signedIn) {
          const removed = removeAccountCatalog(map, accountId)
          if (removed !== map) {
            map = removed
            structuralChanged = true
          }
          continue
        }
        const login = status.data.login?.trim() ?? ''
        if (!login) {
          const removed = removeAccountCatalog(map, accountId)
          if (removed !== map) {
            map = removed
            structuralChanged = true
          }
          continue
        }

        const current = catalogForAccount(map, accountId)
        const renameFlagsReady = !current
          || current.entries.every(e => typeof e.canRename === 'boolean')
        if (
          !force
          && isCatalogFresh(current, CATALOG_TTL_MS, Date.now())
          && renameFlagsReady
        ) {
          continue
        }

        if (!hasCovenantWorkspacesApi(covenant)) {
          const empty = buildOrgWorkspaceCatalog(login, [], {}, Date.now())
          if (gen !== orgWorkspaceCatalogLoadGenRef.current) return
          if (catalogEntryChanged(current ?? undefined, empty)) {
            map = upsertAccountCatalog(map, accountId, empty)
            structuralChanged = true
          }
          continue
        }

        const orgsResult = await covenant.orgsList()
        if (gen !== orgWorkspaceCatalogLoadGenRef.current) return
        if (!orgsResult.ok) continue

        const workspacesByOrg: Record<string, Array<{
          id: string
          name: string
          canRename: boolean
        }>> = {}
        const orgAdminsApi = hasCovenantOrgAdminsApi(covenant)
        type OrgListResult = Awaited<ReturnType<typeof covenant.workspacesList>>
        const orgRows = await mapWithConcurrency(
          orgsResult.data,
          COVENANT_REQUEST_LIMIT,
          async org => {
            const slug = org.slug?.trim() ?? ''
            if (!slug) {
              return { slug: '', list: null as OrgListResult | null, isOrgAdmin: false }
            }
            const list = await covenant.workspacesList(slug)
            if (!list.ok) return { slug, list, isOrgAdmin: false }
            const orgRole = org.role?.trim() ?? ''
            let isOrgAdmin = orgRole === 'owner' || orgRole === 'admin'
            if (!isOrgAdmin && orgAdminsApi) {
              const adminsResult = await covenant.orgAdminsList(slug)
              if (adminsResult.ok) {
                isOrgAdmin = adminsResult.data.some(a => sameGithubLogin(a, login))
              }
            }
            return { slug, list, isOrgAdmin }
          },
        )
        if (gen !== orgWorkspaceCatalogLoadGenRef.current) return
        for (let i = 0; i < orgRows.length; i++) {
          const org = orgsResult.data[i]!
          const { slug, list, isOrgAdmin } = orgRows[i]!
          if (!slug) continue
          if (!list || !list.ok) continue
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

        if (catalogEntryChanged(current ?? undefined, built)) {
          map = upsertAccountCatalog(map, accountId, built)
          structuralChanged = true
        }
      }

      if (gen !== orgWorkspaceCatalogLoadGenRef.current) return
      applyOrgWorkspaceCatalogMap(map)
      if (structuralChanged) await persistOrgWorkspaceCatalogCache(map)
    } catch {
      /* red falló: conservar snapshot en memoria */
    } finally {
      if (gen === orgWorkspaceCatalogLoadGenRef.current) {
        orgWorkspaceCatalogLoadingRef.current = false
      }
    }
  }, [accountIdForCwd, applyOrgWorkspaceCatalogMap, persistOrgWorkspaceCatalogCache])

  // Stale-while-revalidate tras boot (red en background; Cmd+T ya usa el snapshot).
  useEffect(() => {
    if (!configReady) return
    void loadOrgWorkspaceCatalog(false)
  }, [configReady, loadOrgWorkspaceCatalog])

  // Catálogo y sesión cargan en paralelo: alinear títulos org cuando ambos estén listos.
  useEffect(() => {
    if (!sessionReady.loaded || !orgWorkspaceCatalogMap) return
    const synced = syncAllOrgTabTitlesFromMap(tabsRef.current, orgWorkspaceCatalogMap, accountIdForCwd)
    if (!synced) return
    tabsRef.current = synced
    setTabs(synced)
  }, [sessionReady.loaded, orgWorkspaceCatalogMap, accountIdForCwd])

  // Tab org sin `canRename` en catálogo: refrescar permisos (admin recién promovido, caché vieja).
  const orgCatalogPermissionRefreshRef = useRef<string | null>(null)
  useEffect(() => {
    if (!sessionReady.loaded || !activeTabId) return
    const tab = tabsRef.current.find(item => item.id === activeTabId)
    const slug = tab?.orgWorkspace?.slug?.trim() ?? ''
    const workspaceId = tab?.orgWorkspace?.workspaceId?.trim() ?? ''
    if (!slug || !workspaceId) {
      orgCatalogPermissionRefreshRef.current = null
      return
    }
    const entry = findOrgWorkspaceCatalogEntry(
      orgCatalogForTab(orgWorkspaceCatalogMap, tab!, accountIdForCwd),
      slug,
      workspaceId,
    )
    if (entry && typeof entry.canRename === 'boolean') {
      orgCatalogPermissionRefreshRef.current = null
      return
    }
    const key = `${slug}/${workspaceId}`
    if (orgCatalogPermissionRefreshRef.current === key) return
    orgCatalogPermissionRefreshRef.current = key
    void loadOrgWorkspaceCatalog(true)
  }, [activeTabId, sessionReady.loaded, orgWorkspaceCatalogMap, loadOrgWorkspaceCatalog, accountIdForCwd])

  useEffect(() => {
    document.documentElement.dataset.platform = platformId || 'unknown'
  }, [])

  useEffect(() => {
    if (!configReady) return
    const theme = getTheme(config.themeId)
    applyTheme(theme)
    window.api?.setTitleBarOverlay?.(theme.vars['--bg'], theme.vars['--text'])
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
        const orphanPaneIds = [...new Set(sanitized.orphanPaneIds)]
        const keptPaneIds = new Set(sanitized.tabs.flatMap(t => t.paneIds))
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
        tabCounter = deriveTabCounter(sanitized.tabs)
        const activeTabId = sanitized.tabs.some(t => t.id === sanitized.activeTabId)
          ? sanitized.activeTabId
          : sanitized.tabs[0]!.id
        const layoutTabs = sanitized.tabs.map(tab => normalizeTabSession(ensureTabPaneLayout(tab)))
        setTabs(layoutTabs)
        tabsRef.current = layoutTabs
        setActiveTabId(activeTabId)
        // Agentes + contextos antes de pintar el plano (evita re-apilar tras el splash).
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

          await Promise.all(layoutTabs.map(async tab => {
            const cwd = tab.projectFolder?.trim() || ''
            if (!cwd) {
              setTabContextsByTab(prev => ({ ...prev, [tab.id]: [] }))
              return
            }
            try {
              const result = await window.api.discoverTabContexts({ cwd })
              if (result.ok) {
                setTabContextsByTab(prev => ({ ...prev, [tab.id]: result.contexts }))
              } else {
                setTabContextsByTab(prev => ({ ...prev, [tab.id]: [] }))
              }
            } catch (err) {
              console.warn('[boot] discoverTabContexts falló:', err)
              setTabContextsByTab(prev => ({ ...prev, [tab.id]: [] }))
            }
          }))

          setSessionReady({ loaded: true })

          // GC / clone de org: no bloquean el splash (pueden tardar mucho).
          void (async () => {
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
            if (reposByWorkspace.size) {
              let firstCloneError: string | null = null
              let firstCloneFailure: OrgWorkspaceRequirementState['cloneFailure']
              await Promise.all([...reposByWorkspace.values()].map(async ws => {
                const covenant = getCovenantApi(resolveOrgAccountIdForCwd(ws.localDir))
                if (
                  !covenant
                  || !hasCovenantWorkspaceReposApi(covenant)
                  || typeof covenant.cloneOrgWorkspace !== 'function'
                ) return
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
                setOrgWorkspaceRequirement(prev => (prev === null ? requirement : prev))
              }
            }

            const snapshot = buildSessionSnapshot()
            if (snapshot) await window.api.saveSession(snapshot)
          })()
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
        setSessionReady({ loaded: true })
      }
    }).catch(() => {
      const tab = newTab(t('tabs.defaultTitle', { n: ++tabCounter }))
      setTabs([tab])
      setActiveTabId(tab.id)
      setSessionReady({ loaded: true })
    })
    // Solo al montar: sync via closures actuales (no re-cargar session).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Splash boot: cualquier plano con tabActive puede marcar ready (callback
  // siempre montado). Si el usuario cambia activeTabId durante boot, el tab
  // nuevo reengancha el effect en PlaneMap; el tope sigue siendo
  // SPLASH_READY_TIMEOUT_MS vía race en dismissSplash.
  const handlePlaneFirstLayoutReady = useCallback(() => {
    if (!splashLayoutPendingRef.current) return
    splashLayoutPendingRef.current = false
    setSplashLayoutPending(false)
    markSplashUiReady()
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

  /** Estado busy previo por pane; detecta el cierre de turno (true→false). */
  const paneBusyForWikiPushRef = useRef(new Map<string, boolean>())

  /**
   * Un push en vuelo por scope + una única pasada de cola. `syncOrgWikiPush`
   * lee el grafo entero y va detrás de la cola HTTP de covenant (4 en paralelo,
   * timeout 30s): sin este colapso, un disparador que repita rápido apila
   * llamadas suspendidas y cada una deja el grafo pinchado en el heap.
   */
  const wikiPushInFlightRef = useRef(
    new Map<string, Promise<{ ok: true } | { ok: false; error: string }>>(),
  )
  const wikiPushTrailingRef = useRef(new Set<string>())
  const pushOrgWikiForScopeRef = useRef<
    (orgSlug: string, workspaceId: string, cwd: string) =>
      Promise<{ ok: true } | { ok: false; error: string }>
  >(async () => ({ ok: true }))

  /**
   * Push org de la wiki para un scope (post-turno, upload, curador, CTA mapa).
   * Seed en frío con listRemotePages/listRemoteLog para propagar deletes y
   * líneas de log locales faltantes tras reinicio.
   */
  const runOrgWikiPush = useCallback(async (
    slug: string,
    ws: string,
    root: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    const covenant = getCovenantApi(resolveOrgAccountIdForCwd(root))
    if (!covenant || !hasCovenantWikiApi(covenant)) return { ok: true }
    try {
      await syncOrgWikiPush({
        scope: { orgSlug: slug, workspaceId: ws },
        cwd: root,
        getWikiGraph: path => window.api.getWikiGraph(path),
        upsertWikiPage: (pageSlug, payload) => (
          covenant.upsertWikiPage(slug, ws, pageSlug, payload)
        ),
        deleteWikiPage: pageSlug => covenant.deleteWikiPage(slug, ws, pageSlug),
        appendWikiLog: entry => covenant.appendWikiLog(slug, ws, entry),
        listRemotePages: () => covenant.listWikiPages(slug, ws),
        listRemoteLog: () => covenant.listWikiLog(slug, ws),
      })
      return { ok: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn('[orgWikiSync] push falló:', message)
      return { ok: false, error: message }
    }
  }, [resolveOrgAccountIdForCwd])

  const pushOrgWikiForScope = useCallback(async (
    orgSlug: string,
    workspaceId: string,
    cwd: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    const slug = orgSlug.trim()
    const ws = workspaceId.trim()
    const root = cwd.trim()
    if (!slug || !ws || !root) return { ok: true }
    const key = `${slug}${ws}${root}`

    const inFlight = wikiPushInFlightRef.current.get(key)
    if (inFlight) {
      // Colapsa: basta una pasada más al terminar la actual para recoger los
      // cambios que llegaron mientras corría.
      wikiPushTrailingRef.current.add(key)
      return inFlight
    }

    const run = (async () => {
      try {
        return await runOrgWikiPush(slug, ws, root)
      } finally {
        wikiPushInFlightRef.current.delete(key)
        if (wikiPushTrailingRef.current.delete(key)) {
          void pushOrgWikiForScopeRef.current(slug, ws, root)
        }
      }
    })()
    wikiPushInFlightRef.current.set(key, run)
    return run
  }, [runOrgWikiPush])

  pushOrgWikiForScopeRef.current = pushOrgWikiForScope

  /** Push org de la wiki tras el turno: resuelve tab/pane y delega al helper. */
  const pushOrgWikiAfterTurn = useCallback((paneId: string) => {
    const tab = tabsRef.current.find(item => item.paneIds.includes(paneId))
    if (!tab || tab.paneKinds?.[paneId] !== 'agent') return
    const orgSlug = tab.orgWorkspace?.slug?.trim() ?? ''
    const workspaceId = tab.orgWorkspace?.workspaceId?.trim() ?? ''
    const cwd = tab.projectFolder?.trim() || tab.orgWorkspace?.localDir?.trim() || ''
    if (!orgSlug || !workspaceId || !cwd) return
    void pushOrgWikiForScope(orgSlug, workspaceId, cwd)
  }, [pushOrgWikiForScope])

  /** Curador applied → push wiki org (mismo patrón de suscripción por cwd). */
  useEffect(() => {
    const unsubs: Array<() => void> = []
    for (const tab of tabs) {
      const org = tab.orgWorkspace
      const slug = org?.slug?.trim() ?? ''
      const workspaceId = org?.workspaceId?.trim() ?? ''
      const cwd = tab.projectFolder?.trim() || org?.localDir?.trim() || ''
      if (!slug || !workspaceId || !cwd) continue
      unsubs.push(window.api.onWikiCuratorEvent(cwd, event => {
        if (event.type === 'applied') void pushOrgWikiForScope(slug, workspaceId, cwd)
      }))
    }
    return () => {
      for (const unsub of unsubs) unsub()
    }
  }, [tabs, pushOrgWikiForScope])

  const handleBusyChange = useCallback((paneId: string, busy: boolean) => {
    const wasBusy = paneBusyForWikiPushRef.current.get(paneId) === true
    paneBusyForWikiPushRef.current.set(paneId, busy)
    if (wasBusy && !busy) pushOrgWikiAfterTurn(paneId)
    setBusyPanes(prev => {
      const hasPid = prev.has(paneId)
      if (busy === hasPid) return prev
      const next = new Set(prev)
      if (busy) next.add(paneId)
      else next.delete(paneId)
      return next
    })
  }, [pushOrgWikiAfterTurn])

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
        await window.api.gitWorktreeRemove({ path: info.baseCwd }, {
          worktreePath: info.worktreePath,
          branch: info.branch,
          force: true,
        })
      } catch (err) {
        console.warn('[orchestration] worktree cleanup failed', {
          delegationId,
          fromPaneId: info.fromPaneId,
          toPaneId: info.toPaneId,
          reason: 'pane_cleanup_failed',
          error: err instanceof Error ? err.message : String(err),
        })
      } finally {
        worktreesByDelegationRef.current.delete(delegationId)
      }
    }
  }, [])

  const busyTabIds = useMemo(
    () => {
      const ids = collectBusyTabIds(tabs, busyPanes, delegationTargetPaneIds, agentPlaneStatus)
      for (const id of tabIdsWithRunningBrainstorm(brainstormRoomsByTab, brainstormLiveByRoomId)) {
        ids.add(id)
      }
      return ids
    },
    [tabs, busyPanes, delegationTargetPaneIds, agentPlaneStatus, brainstormRoomsByTab, brainstormLiveByRoomId],
  )

  const tabActivityDots = useMemo(
    () => collectTabActivityDots(
      tabs,
      busyPanes,
      delegationTargetPaneIds,
      awaitingDelegationPaneIds,
      agentPlaneStatus,
    ),
    [tabs, busyPanes, delegationTargetPaneIds, awaitingDelegationPaneIds, agentPlaneStatus],
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

  useEffect(() => {
    const folders = [...new Set(
      tabsRef.current
        .map(tab => tab.projectFolder?.trim() ?? '')
        .filter(Boolean),
    )]
    const getFn = window.api?.githubWorkspaceAccountGet
    if (typeof getFn !== 'function') return
    for (const cwd of folders) {
      void getFn(cwd).then(result => {
        if (!result.ok) return
        const id = result.accountId ?? ''
        setWorkspaceAccountByCwd(prev => (prev[cwd] === id ? prev : { ...prev, [cwd]: id }))
      })
    }
  }, [projectFolderKey])

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

  const persistOnboardingCompleted = useCallback((version: string) => {
    if (!shouldPersistOnboardingCompleted(onboardingCompletedVersionRef.current, version)) return
    onboardingCompletedVersionRef.current = version
    void window.api.setConfig({ onboardingCompletedVersion: version })
    setConfig(prev => ({ ...prev, onboardingCompletedVersion: version }))
  }, [])

  const persistOnboardingSignals = useCallback((partial: {
    onboardingSentFirstMessage?: boolean
    onboardingAssignedContext?: boolean
    onboardingGuideDone?: string[]
  }) => {
    if (!isOnboardingIncomplete(config.onboardingCompletedVersion)) return
    const next: typeof partial = {}
    if (
      partial.onboardingSentFirstMessage !== undefined
      && partial.onboardingSentFirstMessage !== config.onboardingSentFirstMessage
    ) {
      next.onboardingSentFirstMessage = partial.onboardingSentFirstMessage
    }
    if (
      partial.onboardingAssignedContext !== undefined
      && partial.onboardingAssignedContext !== config.onboardingAssignedContext
    ) {
      next.onboardingAssignedContext = partial.onboardingAssignedContext
    }
    if (partial.onboardingGuideDone !== undefined) {
      const current = config.onboardingGuideDone ?? []
      const incoming = partial.onboardingGuideDone
      const same = current.length === incoming.length
        && current.every((step, i) => step === incoming[i])
      if (!same) next.onboardingGuideDone = incoming
    }
    if (
      next.onboardingSentFirstMessage === undefined
      && next.onboardingAssignedContext === undefined
      && next.onboardingGuideDone === undefined
    ) {
      return
    }
    void window.api.setConfig(next)
    setConfig(prev => ({ ...prev, ...next }))
  }, [
    config.onboardingCompletedVersion,
    config.onboardingSentFirstMessage,
    config.onboardingAssignedContext,
    config.onboardingGuideDone,
  ])

  const handleAddTab = useCallback(() => {
    if (isOnboardingActive({
      incomplete: isOnboardingIncomplete(config.onboardingCompletedVersion),
      tabs: tabsRef.current,
    })) return
    const map = orgWorkspaceCatalogMapRef.current
    if (map && Object.values(map.byAccount).some(catalogHasWorkspaces)) {
      void loadOrgWorkspaceCatalog(false)
      setOrgWorkspacePickerOpen(true)
      return
    }
    if (map === null) {
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
  }, [t, loadOrgWorkspaceCatalog, config.onboardingCompletedVersion])

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
    if (canCompleteOnboarding({
      incomplete: isOnboardingIncomplete(config.onboardingCompletedVersion),
      path: config.orchestratorPath,
      trigger: 'org_workspace_tab',
      cliAllMissing: clisAllMissing(onboardingClis),
    })) {
      persistOnboardingCompleted(ONBOARDING_VERSION)
    }
    const pickerAccountId = selection.accountId?.trim() || accountIdForCwd(
      tabsRef.current.find(item => item.id === activeTabIdRef.current)?.projectFolder,
    )
    if (org.canPublish !== undefined) {
      const currentCat = catalogForAccount(orgWorkspaceCatalogMapRef.current, pickerAccountId)
      const patched = patchOrgWorkspaceCatalogName(
        currentCat,
        org.slug,
        org.workspaceId,
        org.name?.trim() ?? '',
        org.canPublish,
      )
      if (patched && patched !== currentCat) {
        applyOrgWorkspaceCatalogForAccount(pickerAccountId, patched)
        void persistOrgWorkspaceCatalogCache(orgWorkspaceCatalogMapRef.current)
      }
    }
    const cfg = await window.api.getConfig()
    const missingFolder = !cfg.defaultWorkspacesDir?.trim()
    const missingToken = orgWorkspaceTokenMissing(cfg)
    if (missingFolder || missingToken) {
      setOrgWorkspaceRequirement({ missingFolder, missingToken })
      return
    }

    const workspaceSlug = sanitizeSlugSegment(org.name || org.workspaceId)
      || sanitizeSlugSegment(org.workspaceId)
    const opGen = ++orgWorkspaceSyncUploadGenRef.current
    setOrgWorkspaceRequirement({ syncing: true, syncPhase: 'repos' })

    const covenant = getCovenantApi(pickerAccountId)
    try {
      let repos: Array<{ repoFullName: string; cloneUrl: string; folderName?: string }> = []
      if (covenant && hasCovenantWorkspaceReposApi(covenant)) {
        const reposResult = await covenant.workspaceReposList(org.slug, org.workspaceId)
        if (opGen !== orgWorkspaceSyncUploadGenRef.current) return
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
      if (opGen !== orgWorkspaceSyncUploadGenRef.current) return
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

      const title = org.name?.trim() || t('tabs.defaultTitle', { n: ++tabCounter })
      const tab = newTab(title)
      tab.titleLocked = true
      tab.projectFolder = res.workspaceDir
      tab.orgWorkspace = {
        slug: org.slug,
        workspaceId: org.workspaceId,
        localDir: res.workspaceDir,
        accountId: pickerAccountId,
      }
      setExplorerByTab(prev => {
        const next = { ...prev, [tab.id]: { ...DEFAULT_FILE_EXPLORER_STATE } }
        explorerByTabRef.current = next
        return next
      })
      const nextTabs = appendTabToTabsRef(tabsRef.current, tab)
      tabsRef.current = nextTabs
      setTabs(nextTabs)
      setActiveTabId(tab.id)

      if (covenant && hasCovenantWorkspaceContentApi(covenant)) {
        try {
          const result = await syncOrgWorkspaceContent(org.slug, org.workspaceId, [tab.id], {
            wipeLocal: false,
            includeAgents: true,
            cancelGen: opGen,
            onPhase: reportOrgSyncPhase,
          })
          if (result.cancelled || opGen !== orgWorkspaceSyncUploadGenRef.current) return
          if (!result.agentsOk || !result.contextsOk) {
            setOrgWorkspaceRequirement(prev => prev ?? {
              agentUpdateError: result.wikiError ?? 'sync failed',
            })
          }
        } catch (err) {
          if (opGen !== orgWorkspaceSyncUploadGenRef.current) return
          console.warn('[org tab sync]', org.slug, org.workspaceId, err)
          setOrgWorkspaceRequirement(prev => prev ?? {
            agentUpdateError: err instanceof Error ? err.message : 'sync failed',
          })
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
    } finally {
      if (opGen === orgWorkspaceSyncUploadGenRef.current) {
        setOrgWorkspaceRequirement(prev => (prev?.syncing ? null : prev))
      }
    }
  }, [
    accountIdForCwd,
    applyOrgWorkspaceCatalogForAccount,
    persistOrgWorkspaceCatalogCache,
    refreshAndSyncProjectAgents,
    rememberProjectAgent,
    reportOrgSyncPhase,
    syncOrgWorkspaceContent,
    syncTabWithProjectAgents,
    t,
    persistOnboardingCompleted,
    config.onboardingCompletedVersion,
    config.orchestratorPath,
    onboardingClis,
  ])

  const cancelOrgWorkspaceSyncOrUpload = useCallback(() => {
    orgWorkspaceSyncUploadGenRef.current += 1
    setOrgWorkspaceRequirement(prev => {
      if (!prev?.syncing) return prev
      return null
    })
    setResyncingWorkspaceTabs(new Set())
    setUploadingWorkspaceTabs(new Set())
    setWorkspaceUploadProgressByTab({})
  }, [])

  const handleResyncOrgWorkspace = useCallback(async (
    tab: TabSession,
    options: { includeAgents: boolean } = { includeAgents: true },
  ) => {
    const org = tab.orgWorkspace
    if (!org?.slug?.trim() || !org.workspaceId?.trim()) return
    const covenant = getCovenantApi(orgAccountIdForTab(tab, accountIdForCwd))
    if (!covenant) return

    const opGen = ++orgWorkspaceSyncUploadGenRef.current
    setResyncingWorkspaceTabs(prev => {
      const next = new Set(prev)
      next.add(tab.id)
      return next
    })
    setOrgWorkspaceRequirement({ syncing: true, syncPhase: 'repos' })
    try {
      try {
        if (
          hasCovenantWorkspaceReposApi(covenant)
          && typeof covenant.cloneOrgWorkspace === 'function'
        ) {
          const localDir = tab.projectFolder?.trim() || org.localDir?.trim() || ''
          if (localDir) {
            const reposResult = await covenant.workspaceReposList(org.slug, org.workspaceId)
            if (opGen !== orgWorkspaceSyncUploadGenRef.current) return
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

      if (opGen !== orgWorkspaceSyncUploadGenRef.current) return

      try {
        const result = await syncOrgWorkspaceContent(org.slug, org.workspaceId, [tab.id], {
          wipeLocal: false,
          includeAgents: options.includeAgents,
          cancelGen: opGen,
          onPhase: reportOrgSyncPhase,
        })
        if (result.cancelled || opGen !== orgWorkspaceSyncUploadGenRef.current) return
      } catch (err) {
        if (opGen !== orgWorkspaceSyncUploadGenRef.current) return
        console.warn('[resync agents/contexts]', org.slug, org.workspaceId, err)
        setOrgWorkspaceRequirement(prev => prev ?? {
          agentUpdateError: err instanceof Error ? err.message : 'resync failed',
        })
      }
    } finally {
      if (opGen === orgWorkspaceSyncUploadGenRef.current) {
        setOrgWorkspaceRequirement(prev => (prev?.syncing ? null : prev))
      }
      setResyncingWorkspaceTabs(prev => {
        const next = new Set(prev)
        next.delete(tab.id)
        return next
      })
    }
  }, [accountIdForCwd, reportOrgSyncPhase, syncOrgWorkspaceContent])
  resyncOrgWorkspaceRef.current = handleResyncOrgWorkspace

  const buildOrgWorkspaceUploadDeps = useCallback((
    covenant: NonNullable<ReturnType<typeof getCovenantApi>>,
    orgSlug: string,
    workspaceId: string,
  ): OrgWorkspaceMaterializeDeps => ({
    listRemoteAgents: () => retryCovenantResult(
      () => covenant.workspaceAgentsList(orgSlug, workspaceId),
    ),
    listRemoteContexts: () => retryCovenantResult(
      () => covenant.workspaceContextsList(orgSlug, workspaceId),
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
      covenant.workspaceAgentUpsert(orgSlug, workspaceId, agentId, definition)
    ),
    deleteRemoteAgent: agentId => (
      covenant.workspaceAgentDelete(orgSlug, workspaceId, agentId)
    ),
    upsertRemoteContext: (contextId, payload) => (
      covenant.workspaceContextUpsert(orgSlug, workspaceId, contextId, payload)
    ),
    deleteRemoteContext: contextId => (
      covenant.workspaceContextDelete(orgSlug, workspaceId, contextId)
    ),
  }), [])

  const loadOrgUploadPlan = useCallback(async (
    tab: TabSession,
    includeAgents: boolean,
  ) => {
    const org = tab.orgWorkspace
    if (!org?.slug?.trim() || !org.workspaceId?.trim()) return
    const cwd = tab.projectFolder?.trim() || org.localDir?.trim() || ''
    if (!cwd) return
    const covenant = getCovenantApi(orgAccountIdForTab(tab, accountIdForCwd))
    if (!covenant || !hasCovenantWorkspaceContentApi(covenant)) return

    setOrgUploadPlanLoading(true)
    try {
      const deps = buildOrgWorkspaceUploadDeps(covenant, org.slug, org.workspaceId)
      const result = await planOrgWorkspaceUpload(cwd, deps, { includeAgents })
      if (result.ok) {
        setOrgUploadPlan({
          agentIdsToDelete: result.plan.agentIdsToDelete,
          contextIdsToDelete: result.plan.contextIdsToDelete,
        })
      } else {
        setOrgUploadPlan(null)
      }
    } catch {
      setOrgUploadPlan(null)
    } finally {
      setOrgUploadPlanLoading(false)
    }
  }, [accountIdForCwd, buildOrgWorkspaceUploadDeps])

  const executeUploadOrgWorkspace = useCallback(async (
    tab: TabSession,
    options: { includeAgents: boolean } = { includeAgents: true },
  ) => {
    const org = tab.orgWorkspace
    if (!org?.slug?.trim() || !org.workspaceId?.trim()) return
    const cwd = tab.projectFolder?.trim() || org.localDir?.trim() || ''
    if (!cwd) {
      setOrgWorkspaceRequirement({ uploadError: 'missing project folder' })
      return
    }
    const covenant = getCovenantApi(orgAccountIdForTab(tab, accountIdForCwd))
    if (!covenant || !hasCovenantWorkspaceContentApi(covenant)) {
      setOrgWorkspaceRequirement({ uploadError: 'Covenant API unavailable' })
      return
    }

    setUploadingWorkspaceTabs(prev => {
      const next = new Set(prev)
      next.add(tab.id)
      return next
    })
    reportWorkspaceUploadProgress(tab.id, 0)
    const opGen = ++orgWorkspaceSyncUploadGenRef.current
    try {
      const deps = buildOrgWorkspaceUploadDeps(covenant, org.slug, org.workspaceId)
      const orderedAgentIds = orderedAgentIdsFromTab(tab)
      const result = await uploadOrgWorkspaceFromLocal(cwd, deps, {
        ...(orderedAgentIds.length ? { orderedAgentIds } : {}),
        includeAgents: options.includeAgents,
        onProgress: percent => reportWorkspaceUploadProgress(tab.id, percent),
        shouldCancel: () => opGen !== orgWorkspaceSyncUploadGenRef.current,
      })
      if (result.cancelled) return
      if (opGen !== orgWorkspaceSyncUploadGenRef.current) return
      if (!result.ok) {
        setOrgWorkspaceRequirement({ uploadError: result.error ?? 'upload failed' })
        return
      }
      if (hasCovenantWikiApi(covenant)) {
        reportWorkspaceUploadProgress(tab.id, 90)
        const wikiPush = await pushOrgWikiForScope(org.slug, org.workspaceId, cwd)
        if (opGen !== orgWorkspaceSyncUploadGenRef.current) return
        if (!wikiPush.ok) {
          setOrgWorkspaceRequirement({ wikiError: wikiPush.error })
          return
        }
      }
      reportWorkspaceUploadProgress(tab.id, 100)
      setOrgWorkspaceRequirement(null)
    } catch (err) {
      if (opGen !== orgWorkspaceSyncUploadGenRef.current) return
      setOrgWorkspaceRequirement({
        uploadError: err instanceof Error ? err.message : 'upload failed',
      })
    } finally {
      if (opGen === orgWorkspaceSyncUploadGenRef.current) {
        clearWorkspaceUploadProgress(tab.id)
        setUploadingWorkspaceTabs(prev => {
          const next = new Set(prev)
          next.delete(tab.id)
          return next
        })
      }
    }
  }, [
    accountIdForCwd,
    buildOrgWorkspaceUploadDeps,
    clearWorkspaceUploadProgress,
    pushOrgWikiForScope,
    reportWorkspaceUploadProgress,
  ])

  const handleUploadOrgWorkspace = useCallback((tab: TabSession) => {
    const org = tab.orgWorkspace
    if (!org?.slug?.trim() || !org.workspaceId?.trim()) return
    const entry = findOrgWorkspaceCatalogEntry(
      orgCatalogForTab(orgWorkspaceCatalogMapRef.current, tab, accountIdForCwd),
      org.slug,
      org.workspaceId,
    )
    const uploadGate = resolveOrgWorkspaceUploadGate(entry)
    if (!uploadGate.proceed) {
      setOrgWorkspaceRequirement({ uploadError: uploadGate.uploadError })
      return
    }
    const cwd = tab.projectFolder?.trim() || org.localDir?.trim() || ''
    if (!cwd) {
      setOrgWorkspaceRequirement({ uploadError: 'missing project folder' })
      return
    }
    const covenant = getCovenantApi(orgAccountIdForTab(tab, accountIdForCwd))
    if (!covenant || !hasCovenantWorkspaceContentApi(covenant)) {
      setOrgWorkspaceRequirement({ uploadError: 'Covenant API unavailable' })
      return
    }

    setOrgUploadPlan(null)
    setOrgUploadScopeTab(tab)
    void loadOrgUploadPlan(tab, true)
  }, [accountIdForCwd, loadOrgUploadPlan])

  useEffect(() => {
    if (!promoteWorkspaceTab) {
      setPromoteWorkspaceOrgs([])
      setPromoteWorkspaceRepos([])
      setPromoteWorkspaceBusy(false)
      setPromoteWorkspacePhase(undefined)
      setPromoteWorkspaceError(undefined)
      setPromoteWorkspaceOrgsReason(undefined)
      return
    }
    const folder = promoteWorkspaceTab.projectFolder?.trim() ?? ''
    setPromoteWorkspaceError(undefined)
    setPromoteWorkspacePhase(undefined)
    let cancelled = false
    void (async () => {
      const nextOrgs: PromoteWorkspaceOrgOption[] = []
      let reason: 'signedOut' | 'noAdminOrg' = 'noAdminOrg'
      const covenant = getCovenantApi(accountIdForCwd(folder))
      if (covenant && hasCovenantWorkspacesApi(covenant)) {
        const status = await covenant.status()
        if (cancelled) return
        const login = status.ok ? (status.data.login?.trim() ?? '') : ''
        if (status.ok && status.data.signedIn && login) {
          const orgsResult = await covenant.orgsList()
          if (cancelled) return
          if (orgsResult.ok) {
            for (const org of orgsResult.data) {
              const slug = org.slug?.trim()
              if (!slug) continue
              const orgRole = org.role?.trim() ?? ''
              let isOrgAdmin = orgRole === 'owner' || orgRole === 'admin'
              if (!isOrgAdmin && hasCovenantOrgAdminsApi(covenant)) {
                const admins = await covenant.orgAdminsList(slug)
                if (cancelled) return
                if (admins.ok) isOrgAdmin = admins.data.some(a => sameGithubLogin(a, login))
              }
              if (!isOrgAdmin) continue
              nextOrgs.push({ slug, name: org.name?.trim() || slug })
            }
          } else {
            reason = 'signedOut'
          }
        } else {
          reason = 'signedOut'
        }
      } else {
        reason = 'signedOut'
      }
      let nextRepos: PromoteWorkspaceRepoOption[] = []
      if (folder) {
        try {
          const detected = await window.api.gitListReposWithRemote(folder)
          if (!cancelled) {
            nextRepos = detected.map(repo => ({
              path: repo.path,
              name: repo.name,
              repoFullName: repo.repoFullName,
              hasRemote: Boolean(repo.remoteUrl.trim() && repo.repoFullName.trim()),
            }))
          }
        } catch {
          nextRepos = []
        }
      }
      if (cancelled) return
      setPromoteWorkspaceOrgs(nextOrgs)
      setPromoteWorkspaceOrgsReason(reason)
      setPromoteWorkspaceRepos(nextRepos)
    })()
    return () => {
      cancelled = true
    }
  }, [promoteWorkspaceTab])

  const handlePromoteLocalWorkspace = useCallback(async (
    payload: PromoteWorkspaceConfirmPayload,
  ) => {
    const tab = promoteWorkspaceTab
    const cwd = tab?.projectFolder?.trim() ?? ''
    if (!tab || !cwd || promoteWorkspaceBusy) return
    const covenant = getCovenantApi(orgAccountIdForTab(tab, accountIdForCwd))
    if (!covenant || !hasCovenantWorkspacesApi(covenant) || !hasCovenantWorkspaceContentApi(covenant)) {
      setPromoteWorkspaceError('Covenant API unavailable')
      return
    }
    setPromoteWorkspaceBusy(true)
    setPromoteWorkspaceError(undefined)
    setPromoteWorkspacePhase('create')
    const opGen = ++orgWorkspaceSyncUploadGenRef.current
    try {
      const detected = await window.api.gitListReposWithRemote(cwd)
      if (opGen !== orgWorkspaceSyncUploadGenRef.current) return
      const selected = detected.filter(repo => payload.repoPaths.includes(repo.path))
      const repos = promoteReposFromDetected(selected)
      const orderedAgentIds = orderedAgentIdsFromTab(tab)
      const result = await promoteLocalWorkspaceToOrg(
        {
          orgSlug: payload.orgSlug,
          workspaceName: payload.workspaceName,
          cwd,
          repos,
        },
        {
          createWorkspace: async (orgSlug, name) => {
            const created = await covenant.workspaceCreate(orgSlug, name)
            if (!created.ok) return { ok: false, error: created.error }
            const workspaceId = created.data.id?.trim() ?? ''
            if (!workspaceId) return { ok: false, error: 'missing workspace id' }
            return { ok: true, workspaceId }
          },
          addRepo: async (orgSlug, workspaceId, repo) => {
            if (!hasCovenantWorkspaceReposApi(covenant)) {
              return { ok: false, error: 'repos API unavailable' }
            }
            const added = await covenant.workspaceRepoAdd(orgSlug, workspaceId, {
              repoFullName: repo.repoFullName,
              cloneUrl: repo.cloneUrl,
              ...(repo.folderName?.trim() ? { folderName: repo.folderName.trim() } : {}),
              position: repo.position,
            })
            return added.ok ? { ok: true } : { ok: false, error: added.error }
          },
          upload: async (orgSlug, workspaceId, uploadCwd) => {
            const deps: OrgWorkspaceMaterializeDeps = {
              listRemoteAgents: () => retryCovenantResult(
                () => covenant.workspaceAgentsList(orgSlug, workspaceId),
              ),
              listRemoteContexts: () => retryCovenantResult(
                () => covenant.workspaceContextsList(orgSlug, workspaceId),
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
                covenant.workspaceAgentUpsert(orgSlug, workspaceId, agentId, definition)
              ),
              deleteRemoteAgent: async agentId => {
                const result = await covenant.workspaceAgentDelete(orgSlug, workspaceId, agentId)
                return result.ok ? { ok: true, data: undefined } : result
              },
              upsertRemoteContext: (contextId, payload) => (
                covenant.workspaceContextUpsert(orgSlug, workspaceId, contextId, payload)
              ),
              deleteRemoteContext: async contextId => {
                const result = await covenant.workspaceContextDelete(orgSlug, workspaceId, contextId)
                return result.ok ? { ok: true, data: undefined } : result
              },
            }
            const uploaded = await uploadOrgWorkspaceFromLocal(uploadCwd, deps, {
              ...(orderedAgentIds.length ? { orderedAgentIds } : {}),
              shouldCancel: () => opGen !== orgWorkspaceSyncUploadGenRef.current,
            })
            if (uploaded.cancelled) return { ok: false, cancelled: true }
            if (!uploaded.ok) return { ok: false, error: uploaded.error ?? 'upload failed' }
            return { ok: true }
          },
          pushWiki: (orgSlug, workspaceId, wikiCwd) => pushOrgWikiForScope(orgSlug, workspaceId, wikiCwd),
          onPhase: setPromoteWorkspacePhase,
          shouldCancel: () => opGen !== orgWorkspaceSyncUploadGenRef.current,
        },
      )
      if (opGen !== orgWorkspaceSyncUploadGenRef.current) return
      if (!result.ok) {
        if (result.cancelled) {
          setPromoteWorkspaceTab(null)
          return
        }
        setPromoteWorkspaceError(
          result.workspaceId
            ? t('organizations.promoteFailedPartial', {
              id: result.workspaceId,
              error: result.error,
            })
            : result.error,
        )
        return
      }
      const next = tabsRef.current.map(item => (
        item.id === tab.id
          ? {
              ...item,
              title: payload.workspaceName.trim() || item.title,
              titleLocked: true,
              orgWorkspace: {
                slug: payload.orgSlug,
                workspaceId: result.workspaceId,
                localDir: cwd,
                accountId: orgAccountIdForTab(tab, accountIdForCwd),
              },
            }
          : item
      ))
      tabsRef.current = next
      setTabs(next)
      handleOrgWorkspacesMutated()
      await saveSessionNow()
      setPromoteWorkspaceTab(null)
    } catch (err) {
      if (opGen !== orgWorkspaceSyncUploadGenRef.current) return
      setPromoteWorkspaceError(err instanceof Error ? err.message : 'promote failed')
    } finally {
      if (opGen === orgWorkspaceSyncUploadGenRef.current) {
        setPromoteWorkspaceBusy(false)
      }
    }
  }, [
    accountIdForCwd,
    handleOrgWorkspacesMutated,
    promoteWorkspaceBusy,
    promoteWorkspaceTab,
    pushOrgWikiForScope,
    saveSessionNow,
    t,
  ])

  /** ⌘W: mismo modal que la cruz del panel (TerminalPane registra `openConfirm` por paneId). */
  const paneShortcutCloseInterceptors = useRef(new Map<string, () => void>())
  const registerPaneShortcutCloseIntercept = useCallback((paneId: string, openConfirm: () => void) => {
    paneShortcutCloseInterceptors.current.set(paneId, openConfirm)
    return () => {
      paneShortcutCloseInterceptors.current.delete(paneId)
    }
  }, [])

  function purgeHumanSendFifoForPane(paneId: string): void {
    const pendingHumanFifo = humanSendFifoByPaneRef.current.get(paneId)
    if (!pendingHumanFifo) return
    for (const item of pendingHumanFifo) {
      for (const image of item.images) {
        const previewUrl = (image as { previewUrl?: string }).previewUrl
        if (previewUrl) URL.revokeObjectURL(previewUrl)
      }
    }
    humanSendFifoByPaneRef.current.delete(paneId)
  }

  const handleHumanSendThreadClosed = useCallback((paneId: string, closedThreadId: string) => {
    const fifo = humanSendFifoByPaneRef.current.get(paneId)
    if (!fifo) return
    const kept: typeof fifo = []
    for (const item of fifo) {
      if (item.threadId === closedThreadId) {
        for (const image of item.images) {
          const previewUrl = (image as { previewUrl?: string }).previewUrl
          if (previewUrl) URL.revokeObjectURL(previewUrl)
        }
      } else {
        kept.push(item)
      }
    }
    if (kept.length) {
      humanSendFifoByPaneRef.current.set(paneId, kept)
    } else {
      humanSendFifoByPaneRef.current.delete(paneId)
    }
    setHumanSendFifoTick(n => n + 1)
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
        closeOrchestrationStateForPaneRef.current(pid)
        purgeHumanSendFifoForPane(pid)
        humanDirectDrainInFlightRef.current.delete(pid)
        planeQueueControlsByPaneRef.current.delete(pid)
      }
      for (const pid of paneIds) {
        if (victim.paneKinds?.[pid] === 'agent') window.api.stopAgentTurn(pid)
        else window.api.ptyKill(pid)
        termRefs.current.delete(pid)
        splitSpawnCwdRef.current.delete(pid)
        paneBusyForWikiPushRef.current.delete(pid)
        delete cwdsRef.current[pid]
      }
      // Cerrar workspace org: limpiar el scope del caché de push de wiki
      // (junto a los bodies scoped) salvo que otro tab siga usándolo.
      const victimOrgSlug = victim.orgWorkspace?.slug?.trim() ?? ''
      const victimWorkspaceId = victim.orgWorkspace?.workspaceId?.trim() ?? ''
      if (victimOrgSlug && victimWorkspaceId) {
        const stillInUse = tabsRef.current.some(other => (
          other.id !== victim.id
          && other.orgWorkspace?.slug?.trim() === victimOrgSlug
          && other.orgWorkspace?.workspaceId?.trim() === victimWorkspaceId
        ))
        if (!stillInUse) {
          clearOrgWikiSyncScope({ orgSlug: victimOrgSlug, workspaceId: victimWorkspaceId })
        }
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
          const agentId = victim.agentByPane?.[pid]?.agentId
          const orgSlug = victim.orgWorkspace?.slug?.trim() ?? ''
          const orgWorkspaceId = victim.orgWorkspace?.workspaceId?.trim() ?? ''
          window.api.deleteAgentChat(agentChatRefFor(
            {
              ...(victim.projectFolder?.trim()
                ? { projectFolder: victim.projectFolder.trim() }
                : {}),
              ...(orgSlug && orgWorkspaceId
                ? { orgWorkspace: { slug: orgSlug, workspaceId: orgWorkspaceId } }
                : {}),
            },
            agentId,
            pid,
          ))
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
    dispatchedOrchestrationFollowUpsByPaneRef.current.delete(paneId)
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
      const removedAgentId = tab.agentByPane?.[paneId]?.agentId?.trim()
      const planeLoopLinks = (tab.planeLoopLinks ?? []).filter(
        link => link.fromPaneId !== removedAgentId && link.toPaneId !== removedAgentId,
      )
      const planeLoopNodePositions = { ...(tab.planeLoopNodePositions ?? {}) }
      if (removedAgentId) delete planeLoopNodePositions[removedAgentId]
      const planeLoopChains = removedAgentId
        ? removeAgentFromLoopChains(tab.planeLoopChains ?? [], removedAgentId)
        : (tab.planeLoopChains ?? [])
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
    closeOrchestrationStateForPaneRef.current(paneId)
    setAgentPlaneStatus(prev => {
      if (!(paneId in prev)) return prev
      const next = { ...prev }
      delete next[paneId]
      return next
    })
    updatePlaneSendByPane(prev => {
      if (!(paneId in prev)) return prev
      const next = { ...prev }
      delete next[paneId]
      return next
    })
    planeQueueControlsByPaneRef.current.delete(paneId)
    humanDirectDrainInFlightRef.current.delete(paneId)
    purgeHumanSendFifoForPane(paneId)
    // QA fix: no dejar worktrees/ramas huérfanos si se cierra el orquestador o el pane
    // especialista que estaba ejecutando una delegación en un worktree dedicado.
    void cleanupWorktreesForPane(paneId)
    setTimeout(() => {
      window.api.deleteScrollback(paneId)
      window.api.deleteAiChat(paneId)
      window.api.deleteCmdHistory(paneId)
      window.api.deleteInteractionsLog(paneId)
      const orgSlug = t.orgWorkspace?.slug?.trim() ?? ''
      const orgWorkspaceId = t.orgWorkspace?.workspaceId?.trim() ?? ''
      window.api.deleteAgentChat(agentChatRefFor(
        {
          ...(t.projectFolder?.trim() ? { projectFolder: t.projectFolder.trim() } : {}),
          ...(orgSlug && orgWorkspaceId
            ? { orgWorkspace: { slug: orgSlug, workspaceId: orgWorkspaceId } }
            : {}),
        },
        agentId,
        paneId,
      ))
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
      const opGen = ++orgWorkspaceSyncUploadGenRef.current
      setOrgWorkspaceRequirement({ syncing: true, syncPhase: 'repos' })
      const covenant = getCovenantApi(
        (tab ? orgAccountIdForTab(tab, accountIdForCwd) : '')
          || resolveOrgAccountIdForCwd(path),
      )
      try {
        let repos: Array<{ repoFullName: string; cloneUrl: string; folderName?: string }> = []
        if (covenant && hasCovenantWorkspaceReposApi(covenant)) {
          const reposResult = await covenant.workspaceReposList(orgSlug, workspaceId)
          if (opGen !== orgWorkspaceSyncUploadGenRef.current) return null
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
        if (opGen !== orgWorkspaceSyncUploadGenRef.current) return null
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
          await syncOrgWorkspaceContent(orgSlug, workspaceId, [tabId], {
            wipeLocal: false,
            includeAgents: true,
            cancelGen: opGen,
            onPhase: reportOrgSyncPhase,
          })
        }
        return path
      } finally {
        if (opGen === orgWorkspaceSyncUploadGenRef.current) {
          setOrgWorkspaceRequirement(prev => (prev?.syncing ? null : prev))
        }
      }
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
  }, [accountIdForCwd, refreshAndSyncProjectAgents, rememberProjectAgent, reportOrgSyncPhase, resolveOrgAccountIdForCwd, saveSessionNow, syncOrgWorkspaceContent, syncTabWithProjectAgents, t])

  const handleCreateTerminal = useCallback((tabId: string) => {
    const tab = tabsRef.current.find(t => t.id === tabId)
    if (!tab) return
    const cwd = tab.projectFolder?.trim() || ''
    if (!cwd) return
    const newPaneId = crypto.randomUUID()
    rememberPaneCwd(newPaneId, cwd)
    setTabs(prev => prev.map(t => {
      if (t.id !== tabId) return t
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
    if (!current) return
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
      if (tab.id !== tabId) return tab
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

  const bootstrapProjectAgents = useCallback(async (tabId: string): Promise<boolean> => {
    const current = tabsRef.current.find(tab => tab.id === tabId)
    if (!current) return false
    const cwd = current.projectFolder?.trim() || ''
    const catalogKey = tabAgentCatalogKey(current)
    if (!cwd) return false
    const catalog = projectAgentsByCwdRef.current[catalogKey] ?? []

    const tabHasAgentPane = (tab: TabSession): boolean => (tab.paneIds ?? []).some(
      paneId => tab.paneKinds?.[paneId] === 'agent',
    )
    const tabHasPaneForAgent = (tab: TabSession, agentId: string): boolean => (tab.paneIds ?? []).some(
      paneId => tab.agentByPane?.[paneId]?.agentId === agentId,
    )

    const appendAgentPane = (agentId: string): void => {
      const paneId = crypto.randomUUID()
      rememberPaneCwd(paneId, cwd)
      setTabs(prev => prev.map(tab => {
        if (tab.id !== tabId) return tab
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
            [paneId]: { agentId },
          },
        })
      }))
    }

    if (tabHasAgentPane(current)) return true

    if (catalog.length > 0) {
      let created = false
      for (const agent of catalog) {
        const tabNow = tabsRef.current.find(tab => tab.id === tabId)
        if (!tabNow) break
        if (tabHasPaneForAgent(tabNow, agent.id)) continue
        created = true
        appendAgentPane(agent.id)
      }
      if (created) {
        scheduleSaveSession()
        void refreshAndSyncProjectAgents(cwd, tabId)
      }
      return created || tabHasAgentPane(tabsRef.current.find(tab => tab.id === tabId) ?? current)
    }

    let created = false
    const existing = new Set(catalog.map(agent => agent.id))
    const definitions = buildBootstrapProjectAgentDefinitions('cursor', existing)

    for (const definition of definitions) {
      const tabNow = tabsRef.current.find(tab => tab.id === tabId)
      if (!tabNow) break

      const written = await window.api.upsertProjectAgent(cwd, definition)
      if (!written.ok) continue
      created = true
      const agent = written.agent
      rememberProjectAgent(catalogKey, agent)
      await window.api.ensureAiAgentResults({
        cwd,
        agentId: agent.id,
        agentName: agent.name ?? definition.name ?? agent.id,
      })

      appendAgentPane(agent.id)
    }
    scheduleSaveSession()
    void refreshAndSyncProjectAgents(cwd, tabId)
    return created
  }, [
    rememberPaneCwd,
    rememberProjectAgent,
    refreshAndSyncProjectAgents,
    scheduleSaveSession,
  ])

  const refreshOnboardingClis = useCallback(async () => {
    let rows: OnboardingCliRow[] = []
    try {
      const result = await window.api.detectOnboardingClis()
      rows = mapCliRows(result)
      setOnboardingClis(rows)
    } catch {
      rows = []
      setOnboardingClis([])
    } finally {
      if (!onboardingClisMissingLockedRef.current) {
        onboardingClisMissingLockedRef.current = true
        setOnboardingClisMissing(clisAllMissing(rows))
      }
    }
    return rows
  }, [])

  const handleOnboardingSelectPath = useCallback((next: OrchestratorPath) => {
    void window.api.setConfig({ orchestratorPath: next })
    setConfig(prev => ({ ...prev, orchestratorPath: next }))
  }, [])

  const handleReplayOnboarding = useCallback(() => {
    setSettingsOpen(false)
    const reset = {
      onboardingCompletedVersion: '',
      orchestratorPath: '' as const,
      onboardingSentFirstMessage: false,
      onboardingAssignedContext: false,
      onboardingGuideDone: [] as string[],
    }
    void window.api.setConfig(reset)
    setConfig(prev => ({ ...prev, ...reset }))
    onboardingClisMissingLockedRef.current = false
    onboardingClisRefreshOnceRef.current = false
    void refreshOnboardingClis()
  }, [refreshOnboardingClis])

  useEffect(() => {
    onboardingCompletedVersionRef.current = config.onboardingCompletedVersion ?? ''
  }, [config.onboardingCompletedVersion])

  useEffect(() => {
    const ready = configReady && sessionReady.loaded
    if (!ready) return
    if (!isOnboardingIncomplete(config.onboardingCompletedVersion)) return
    if (onboardingClisRefreshOnceRef.current) return
    onboardingClisRefreshOnceRef.current = true
    onboardingClisMissingLockedRef.current = false
    void refreshOnboardingClis()
  }, [configReady, config.onboardingCompletedVersion, sessionReady.loaded, refreshOnboardingClis])

  /** Nuevo agente con la misma configuración (sin historial / sesión CLI). */
  const handleDuplicateAgentPane = useCallback(async (
    tabId: string,
    sourcePaneId: string,
  ) => {
    const current = tabsRef.current.find(tab => tab.id === tabId)
    if (!current) return
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
      if (tab.id !== tabId) return tab
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
    if (!tab) return
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

  const handleInsertCommandInTerminal = useCallback((tabId: string, cmd: string) => {
    const payload = buildTerminalInsertPayload(cmd)
    if (!payload) return
    const tab = tabsRef.current.find(t => t.id === tabId)
    if (!tab) return

    const activeId = tab.activePaneId
    const paneId = (
      activeId
      && tab.paneKinds?.[activeId] !== 'agent'
      && termRefs.current.has(activeId)
    )
      ? activeId
      : tab.paneIds.find(id => tab.paneKinds?.[id] !== 'agent' && termRefs.current.has(id))

    if (paneId) {
      handleOpenPaneWindow(tabId, paneId)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          termRefs.current.get(paneId)?.writeToTty(payload)
        })
      })
      return
    }

    if (!tab.projectFolder?.trim()) return
    pendingTerminalInsertRef.current = { tabId, payload }
    handleCreateTerminal(tabId)
  }, [handleCreateTerminal, handleOpenPaneWindow])

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
    const apply = (list: TabSession[]): TabSession[] => list.map(tab => {
      if (tab.id !== tabId) return tab
      if (paneId === null) {
        return { ...tab, planeOpenChatAgentId: null }
      }
      if (tab.paneKinds?.[paneId] !== 'agent') return tab
      return { ...tab, planeOpenChatAgentId: paneId }
    })
    // El ref se actualiza ya: quien llame justo después (p. ej. la card, que
    // encadena handleAgentMetaChange) lee tabsRef.current, no el estado aún
    // sin commitear. React solo evalúa el updater al instante cuando la cola
    // está vacía, y con un agente trabajando nunca lo está.
    tabsRef.current = apply(tabsRef.current)
    setTabs(apply)
  }, [])

  const handleAssignContextToAgent = useCallback((
    tabId: string,
    toPaneId: string,
    contextId: string,
  ) => {
    const tab = tabsRef.current.find(item => item.id === tabId)
    const previous = tab ? resolveTabAgentMeta(tab, toPaneId, projectAgentsByCwdRef.current) : null
    const outcome = resolveContextAssignOutcome({
      currentIds: previous?.contextIds,
      contextId,
      ownResult: isAgentOwnResultContext(previous?.id, contextId),
      mode: 'assign',
    })
    void handleAgentMetaChangeRef.current(tabId, toPaneId, previous => {
      if (isAgentOwnResultContext(previous.id, contextId)) return previous
      const prior = previous.contextIds ?? []
      const nextIds = [...new Set([...prior, contextId])]
      return { ...previous, contextIds: nextIds }
    }).then(ok => {
      if (ok && previous && shouldPersistAssignedContext(outcome)) {
        persistOnboardingSignals({ onboardingAssignedContext: true })
      }
    })
  }, [persistOnboardingSignals])

  /**
   * Contexto soltado sobre una ficha de la sala. El destino es el agente del
   * catálogo (`.gravity/agents/<id>.json`) y no un pane, así que se escribe con
   * `upsertProjectAgent`; la definición entera sale de aquí porque las vistas de
   * la sala solo tienen media —guardar esa media borraría el resto del archivo.
   */
  const handleAssignContextToCatalogAgent = useCallback((
    cwd: string,
    agentId: string,
    contextId: string,
  ) => {
    const root = cwd.trim()
    if (!root) return
    const agent = (projectAgentsByCwdRef.current[root] ?? []).find(item => item.id === agentId)
    if (!agent) return
    const outcome = resolveContextAssignOutcome({
      currentIds: agent.contextIds,
      contextId,
      ownResult: isAgentOwnResultContext(agent.id, contextId),
      mode: 'assign',
    })
    if (outcome === 'rejected') return
    if (outcome === 'already') {
      persistOnboardingSignals({ onboardingAssignedContext: true })
      return
    }
    const next = addAgentContextId(agent, contextId)
    if (!next) return
    void window.api.upsertProjectAgent(root, next).then(result => {
      if (result.ok) {
        rememberProjectAgent(root, result.agent)
        if (shouldPersistAssignedContext(outcome)) {
          persistOnboardingSignals({ onboardingAssignedContext: true })
        }
      }
    })
  }, [rememberProjectAgent, persistOnboardingSignals])

  const handleToggleAgentContext = useCallback((
    tabId: string,
    paneId: string,
    contextId: string,
  ) => {
    const tab = tabsRef.current.find(item => item.id === tabId)
    const previous = tab ? resolveTabAgentMeta(tab, paneId, projectAgentsByCwdRef.current) : null
    const outcome = resolveContextAssignOutcome({
      currentIds: previous?.contextIds,
      contextId,
      ownResult: isAgentOwnResultContext(previous?.id, contextId),
      mode: 'toggle',
    })
    void handleAgentMetaChangeRef.current(tabId, paneId, previous => {
      const selected = new Set(previous.contextIds ?? [])
      if (selected.has(contextId)) {
        selected.delete(contextId)
      } else if (isAgentOwnResultContext(previous.id, contextId)) {
        return previous
      } else {
        selected.add(contextId)
      }
      return { ...previous, contextIds: [...selected] }
    }).then(ok => {
      if (ok && shouldPersistAssignedContext(outcome)) {
        persistOnboardingSignals({ onboardingAssignedContext: true })
      }
    })
  }, [persistOnboardingSignals])

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

  /**
   * Cuántas actas tiene cada proyecto en disco. Lo necesita el botón del plano
   * para saber si el módulo abre por la biblioteca o directo al alta, y hay que
   * saberlo antes de abrir nada, así que no puede salir de la propia lista.
   */
  useEffect(() => {
    let cancelled = false
    const roots = new Map<string, string[]>()
    tabs.forEach(tab => {
      const cwd = tab.projectFolder?.trim()
      if (!cwd) return
      roots.set(cwd, [...(roots.get(cwd) ?? []), tab.id])
    })
    roots.forEach((tabIds, cwd) => {
      void window.api.listBrainstorms(cwd)
        .then(rooms => {
          if (cancelled) return
          setBrainstormSavedCountByTab(prev => {
            const next = { ...prev }
            tabIds.forEach(id => { next[id] = rooms.length })
            return next
          })
        })
        .catch(() => { /* sin actas legibles, el botón abre el alta */ })
    })
    return () => { cancelled = true }
    // `brainstormViewByTab` en las deps: al cerrar el módulo la cuenta se
    // relee, que es cuando puede haber cambiado (sala nueva, acta borrada).
  }, [tabs, brainstormViewByTab])

  const refreshTabContexts = useCallback(async (tabId: string): Promise<void> => {
    const tab = tabsRef.current.find(item => item.id === tabId)
    if (!tab) return
    const cwd = tab.projectFolder?.trim() || ''
    if (!cwd) return
    const result = await window.api.discoverTabContexts({ cwd })
    if (!result.ok) return
    setTabContextsByTab(prev => ({ ...prev, [tabId]: result.contexts }))
    // `contextsRevision` es el único mecanismo que hace que un `AgentPane` ya
    // montado vuelva a leer disco (su propio discover solo depende de mount/
    // cwd/abrir su panel — ver AgentPane.tsx:1061-1082). Sin este bump, un
    // contexto creado ahora (p. ej. una mención de Jira) nunca entra en
    // `diskContextsRef` de un pane que ya estaba abierto, y se cae en
    // silencio de cualquier turno que lo adjunte antes de que el pane vuelva
    // a abrir su panel de contextos por otra razón.
    const catalogKey = tabAgentCatalogKey(tab)
    if (catalogKey) {
      setContextsRevisionByCwd(prev => ({
        ...prev,
        [catalogKey]: (prev[catalogKey] ?? 0) + 1,
      }))
    }
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

  const handleAddFileContextFromPlane = useCallback(async (tabId: string) => {
    const tab = tabsRef.current.find(item => item.id === tabId)
    if (!tab) return
    const cwd = tab.projectFolder?.trim() || ''
    const contexts = tabContextsByTabRef.current[tabId] ?? []
    const result = await addFileContextsFromPicker({
      cwd,
      contexts,
      pickTitle: t('tabContexts.pickProjectFilesTitle'),
    })
    if (result.ok) {
      if (result.created.length > 0) await refreshTabContexts(tabId)
      return
    }
    if (result.cancelled) return
    handleConfigureContextsFromPlane(tabId)
  }, [t, refreshTabContexts, handleConfigureContextsFromPlane])

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
      const bothMessagesEmpty = (previous?.messages.length ?? 0) === 0
        && status.messages.length === 0
      const messagesUnchanged = bothMessagesEmpty || (
        (previous?.messages.length ?? 0) === status.messages.length
        && (previous?.messages ?? []).every((msg, i) =>
          msg.id === status.messages[i]?.id
          && msg.role === status.messages[i]?.role
          && msg.content === status.messages[i]?.content,
        )
      )
      if (
        previous
        && previous.busy === status.busy
        && previous.activity === status.activity
        && previous.lastSnippet === status.lastSnippet
        && previous.lastTurnFailed === status.lastTurnFailed
        && previous.activeAssistantId === status.activeAssistantId
        && previous.awaitingDelegations === status.awaitingDelegations
        && orchestrationAwaitingSignature(previous.orchestrationAwaiting)
          === orchestrationAwaitingSignature(status.orchestrationAwaiting)
        && previous.delegationWorkActive === status.delegationWorkActive
        && previous.orchestratorBusy === status.orchestratorBusy
        && previous.orchestrationWorkStyle === status.orchestrationWorkStyle
        && previous.turnCloseReason === status.turnCloseReason
        && queuedTurnsPlaneStatusEqual(previous.queuedTurns, status.queuedTurns)
        && planeThreadGatingFieldsEqual(previous, status)
        && runningThreadActivitiesEqual(
          previous.runningThreadActivities,
          status.runningThreadActivities,
        )
        && previous.lastUserSnippet === status.lastUserSnippet
        && messagesUnchanged
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
      ) {
        const pending = findPendingDelegationByToPane(
          orchestrationJobsByPaneRef.current,
          paneId,
        )
        if (pending && canReconcileIdlePending(pending.sawBusy, {
          startedAt: pending.startedAt,
          nowMs: Date.now(),
        })) {
          reconcileIdleDelegationTargetRef.current(
            paneId,
            status.lastSnippet,
            status.lastTurnFailed === true,
          )
        }
      }
      if (status.busy) {
        markPendingSawBusyForPane(orchestrationJobsByPaneRef.current, paneId)
      }
      return { ...prev, [paneId]: status }
    })
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

  const handleStartLoopChain = useCallback((tabId: string, chainId: string) => {
    const tab = tabsRef.current.find(item => item.id === tabId)
    if (!tab) return
    const cwd = tab.projectFolder?.trim() || tab.orgWorkspace?.localDir?.trim() || ''
    if (!cwd) return
    const chain = tab.planeLoopChains?.find(item => item.id === chainId)
    if (!chain || chain.steps.length === 0) return
    if (chain.status === 'running' || chain.status === 'waiting') return
    const catalogKey = tabAgentCatalogKey(tab)
    window.api.startLoopChain({
      chainId: chain.id,
      steps: chain.steps,
      intervalMs: chain.intervalMs,
      cwd,
      agents: projectAgentsByCwdRef.current[catalogKey] ?? [],
      contexts: tabContextsByTabRef.current[tabId] ?? [],
    })
  }, [])

  const handleStopLoopChain = useCallback((_tabId: string, chainId: string) => {
    window.api.stopLoopChain(chainId)
  }, [])

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
      delegation?: PlaneSendDelegation
    },
  ): boolean => {
    // Follow-ups de jobs superseded/missing no deben llegar a preferSend.
    if (payload.orchestrationFollowUp === true) {
      const jobId = payload.orchestrationJobId?.trim()
      if (jobId) {
        const jobsMap = orchestrationJobsByPaneRef.current.get(paneId)
        const job = jobsMap?.get(jobId)
        if (!job || job.superseded) return false
        const fifo = orchestrationFifoByPaneRef.current.get(paneId) ?? []
        if (fifo.some(
          item => item.orchestrationFollowUp === true
            && item.orchestrationJobId?.trim() === jobId,
        )) {
          return false
        }
      }
    }
    const queue = orchestrationFifoByPaneRef.current.get(paneId) ?? []
    // Evita apilar el mismo follow-up (mismo job + mismo texto) en la FIFO.
    const nextItem = {
      text: payload.text,
      orchestrationJobId: payload.orchestrationJobId?.trim(),
    }
    // Cada delegación tiene id propio; dos objetivos idénticos al mismo pane son
    // trabajo distinto (parallel lanes), no un duplicado.
    if (!payload.delegation && queue.some(item => isDuplicateOrchestrationQueueItem(item, nextItem))) {
      return false
    }
    // Un follow-up ya despachado no vuelve a la cola: evita reenviar el mismo texto
    // tras consumirlo. beginOrchestrationUserTurn borra la memoria del pane al
    // arrancar un turno humano del orquestador.
    if (payload.orchestrationFollowUp === true) {
      const key = orchestrationFollowUpKey(nextItem)
      const dispatched = dispatchedOrchestrationFollowUpsByPaneRef.current.get(paneId)
        ?? new Set<string>()
      if (dispatched.has(key)) return false
      dispatched.add(key)
      dispatchedOrchestrationFollowUpsByPaneRef.current.set(paneId, dispatched)
    } else {
      dispatchedOrchestrationFollowUpsByPaneRef.current.delete(paneId)
    }
    queue.push({
      text: payload.text,
      images: payload.images ?? [],
      sendId: crypto.randomUUID(),
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
    return true
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
    const workStyle = orchestrationWorkStyleForPane(fromPaneId)
    const decision = decideJobForTurn({
      jobs,
      wantedJobId: jobId,
      activeJobId: activeOrchestrationJobByPaneRef.current.get(fromPaneId),
      workStyle,
    })
    if (decision.kind === 'existing' || decision.kind === 'reuseOnly') {
      const existing = jobs.get(decision.jobId)!
      activeOrchestrationJobByPaneRef.current.set(fromPaneId, existing.jobId)
      return existing
    }
    if (decision.kind === 'fresh' && decision.staleJobId) {
      console.warn('[orchestration] stale job id requested for turn', {
        reason: 'stale_job_id',
        fromPaneId,
        requestedJobId: decision.staleJobId,
      })
    }
    const fromThreadId =
      agentPlaneStatusRef.current[fromPaneId]?.activeThreadId?.trim() || DEFAULT_THREAD_ID
    const job = createOrchestrationJob(fromPaneId, undefined, fromThreadId)
    jobs.set(job.jobId, job)
    activeOrchestrationJobByPaneRef.current.set(fromPaneId, job.jobId)
    return job
  }, [getOrCreateJobsMap, orchestrationWorkStyleForPane])

  // abortOrchestrationRun se asigna abajo; ref evita ciclo begin↔abort.
  const abortOrchestrationRunRef = useRef<((fromPaneId: string) => void) | null>(null)

  const beginOrchestrationUserTurn = useCallback((fromPaneId: string) => {
    dispatchedOrchestrationFollowUpsByPaneRef.current.delete(fromPaneId)
    const workStyle = orchestrationWorkStyleForPane(fromPaneId)
    if (shouldAbortOnHumanTurn(workStyle)) {
      // Linear: awaiting bloquea humanos hasta cerrar la ola; esto es cleanup seguro.
      const priorJobs = orchestrationJobsByPaneRef.current.get(fromPaneId)
      if (priorJobs) supersedeOrchestrationJobsForHumanTurn(priorJobs)
      abortOrchestrationRunRef.current?.(fromPaneId)
    }
    const jobs = getOrCreateJobsMap(fromPaneId)
    if (workStyle !== 'turbo') {
      for (const jobId of jobs.keys()) {
        delegateDispatchKeysByJobRef.current.delete(jobId)
      }
      jobs.clear()
    }
    const fromThreadId =
      agentPlaneStatusRef.current[fromPaneId]?.activeThreadId?.trim() || DEFAULT_THREAD_ID
    const job = createOrchestrationJob(fromPaneId, undefined, fromThreadId)
    jobs.set(job.jobId, job)
    activeOrchestrationJobByPaneRef.current.set(fromPaneId, job.jobId)
    delegateWarningsSeenByJobRef.current.set(job.jobId, new Set())
    delegateDispatchKeysByJobRef.current.set(job.jobId, new Map())
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
    warnings?: string[],
  ) => {
    const warningLines = (warnings ?? []).map(line => line.trim()).filter(Boolean)
    const job = warningLines.length || delegations.length
      ? resolveActiveJob(fromPaneId, orchestrationJobId)
      : null
    if (warningLines.length && job) {
      let seen = delegateWarningsSeenByJobRef.current.get(job.jobId)
      if (!seen) {
        seen = new Set()
        delegateWarningsSeenByJobRef.current.set(job.jobId, seen)
      }
      const newLines = warningLines.filter(line => !seen.has(line))
      for (const line of newLines) seen.add(line)
      if (newLines.length) {
        const text = buildDelegateWarningFollowUp(newLines)
        if (text) {
          enqueueOrchestrationSend(fromPaneId, {
            text,
            focusPane: false,
            orchestrationFollowUp: true,
            allowDelegations: true,
            orchestrationJobId: job.jobId,
          })
        }
      }
    }
    if (!delegations.length) return
    if (!job) return
    const maxRounds = orchestrationMaxRoundsForPane(fromPaneId, tabId)
    const workStyle = orchestrationWorkStyleForPane(fromPaneId, tabId)
    // Turbo: atar la ola al job del turno que emitió, no al “activo” del pane.
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
    const pending = job.pending
    const waveItems = job.waveItems
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
      const activeLanesByPane = countActiveLanesByPane(orchestrationJobsByPaneRef.current)
      const decision = resolveDelegationLane({
        toAgentId: delegation.toAgentId,
        targets,
        activeLanesByPane,
      })

      let toPaneId: string | null = null
      let routedAgentId = delegation.toAgentId

      if (decision.kind === 'fail') {
        enqueueOrchestrationSend(fromPaneId, {
          text: formatDelegationResultFollowUp({
            id: delegation.id,
            status: 'fail',
            summary: `No agent found for agentId "${delegation.toAgentId}".`,
            fromPaneId,
            orchestrationJobId: job.jobId,
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

      const routedForGuard = decision.agentId
      const duplicate = findDuplicateDelegation({
        toAgentId: routedForGuard,
        objective: delegation.objective,
        registry: delegationRuntimeByIdRef.current,
      })
      if (duplicate) {
        enqueueOrchestrationSend(fromPaneId, {
          text: buildDuplicateDelegationFollowUp({
            toAgentId: routedForGuard,
            duplicate,
            now: Date.now(),
          }),
          focusPane: false,
          orchestrationFollowUp: true,
          orchestrationJobId: job.jobId,
          allowDelegations: !orchestrationRoundsAtCap(nextRound, maxRounds),
        })
        continue
      }

      if (decision.kind === 'defer') {
        job.deferred.push({
          tabId,
          delegation,
          toPaneId: decision.paneId,
          toAgentId: decision.agentId,
          ...(delegation.parentDelegationId ? { parentDelegationId: delegation.parentDelegationId } : {}),
        })
        upsertOrchestrationWaveItem(job, {
          delegationId: delegation.id,
          toAgentId: decision.agentId,
          toPaneId: decision.paneId,
          status: 'deferred',
        })
        continue
      }

      const trackedThreadId = findTrackedDelegationThreadId(job, delegation.id)
      if (trackedThreadId) {
        console.warn('[orchestration] delegación duplicada ignorada', {
          delegationId: delegation.id,
          orchestrationJobId: job.jobId,
          toAgentId: decision.agentId,
          reason: 'duplicate_delegation_id',
          existingThreadId: trackedThreadId,
        })
        continue
      }

      const dispatchKey = delegationDispatchKey({
        toAgentId: decision.agentId,
        objective: delegation.objective,
        contextIds: delegation.contextIds,
      })
      if (dispatchKey) {
        let keysByJob = delegateDispatchKeysByJobRef.current.get(job.jobId)
        if (!keysByJob) {
          keysByJob = new Map()
          delegateDispatchKeysByJobRef.current.set(job.jobId, keysByJob)
        }
        const existingDelegationId = keysByJob.get(dispatchKey)
        if (existingDelegationId) {
          console.warn('[orchestration] delegación duplicada ignorada', {
            delegationId: delegation.id,
            orchestrationJobId: job.jobId,
            toAgentId: decision.agentId,
            reason: 'duplicate_dispatch_signature',
            existingDelegationId,
          })
          enqueueOrchestrationSend(fromPaneId, {
            text: buildRepeatedDispatchFollowUp({ toAgentId: decision.agentId }),
            focusPane: false,
            orchestrationFollowUp: true,
            orchestrationJobId: job.jobId,
            allowDelegations: !orchestrationRoundsAtCap(nextRound, maxRounds),
          })
          continue
        }
        keysByJob.set(dispatchKey, delegation.id)
      }

      const threadId = crypto.randomUUID()
      toPaneId = decision.paneId
      routedAgentId = decision.agentId

      if (!toPaneId) continue
      pending.set(delegation.id, {
        toPaneId,
        toAgentId: routedAgentId,
        toThreadId: threadId,
        startedAt: Date.now(),
      })
      registerDelegationRuntime(delegationRuntimeByIdRef.current, {
        delegationId: delegation.id,
        fromPaneId,
        toPaneId,
        toAgentId: routedAgentId,
        toThreadId: threadId,
        jobId: job.jobId,
        objective: delegation.objective,
        ...(delegation.parentDelegationId ? { parentDelegationId: delegation.parentDelegationId } : {}),
      })
      upsertOrchestrationWaveItem(job, {
        delegationId: delegation.id,
        toAgentId: routedAgentId,
        toPaneId,
        toThreadId: threadId,
        status: 'running',
      })

      let worktreePath: string | undefined
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
          const wtPath = `${baseCwd.replace(/\/+$/, '')}/${relPath}`
          const addResult = await window.api.gitWorktreeAdd({ path: baseCwd }, {
            worktreePath: wtPath,
            branch,
            fromRef: branchInfo.baseBranch,
          })
          if (addResult.ok) {
            worktreePath = wtPath
            worktreesByDelegationRef.current.set(delegation.id, {
              fromPaneId,
              toPaneId,
              toThreadId: threadId,
              worktreePath: wtPath,
              branch,
              baseCwd,
              baseBranch: branchInfo.baseBranch,
            })
            attachDelegationWorktree(delegationRuntimeByIdRef.current, delegation.id, {
              worktreePath: wtPath,
              branch,
              baseCwd,
              baseBranch: branchInfo.baseBranch,
            })
          } else {
            const detail = addResult.error || addResult.stderr || 'unknown error'
            console.error('[orchestration] worktree add failed', {
              delegationId: delegation.id,
              ...(delegation.parentDelegationId ? { parentDelegationId: delegation.parentDelegationId } : {}),
              orchestrationJobId: job.jobId,
              fromPaneId,
              toPaneId,
              toAgentId: routedAgentId,
              reason: 'worktree_add_failed',
              detail,
            })
            pending.delete(delegation.id)
            deleteDelegationRuntime(delegationRuntimeByIdRef.current, delegation.id)
            const waveIdx = waveItems.findIndex(item => item.delegationId === delegation.id)
            if (waveIdx >= 0) waveItems.splice(waveIdx, 1)
            const worktreeFailLaneDelegation = laneDelegationForJob(
              job,
              delegationRuntimeByIdRef.current,
            )
            enqueueOrchestrationSend(fromPaneId, {
              text: formatDelegationResultFollowUp({
                id: delegation.id,
                status: 'fail',
                summary: `Worktree isolation failed for "${routedAgentId}": ${detail}`,
                fromPaneId,
                orchestrationJobId: job.jobId,
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
              ...(worktreeFailLaneDelegation ? { delegation: worktreeFailLaneDelegation } : {}),
            })
            continue
          }
        }
      }

      if (!job.parentDelegationId && delegation.parentDelegationId) {
        job.parentDelegationId = delegation.parentDelegationId
      }

      const contextHint = delegation.contextIds?.length
        ? `\n\nPreferred context ids: ${delegation.contextIds.join(', ')}`
        : ''
      const queued = enqueueOrchestrationSend(toPaneId, {
        text: `${delegation.objective}${contextHint}`,
        focusPane: false,
        orchestrationJobId: job.jobId,
        delegation: {
          id: delegation.id,
          fromPaneId,
          toAgentId: routedAgentId,
          orchestrationJobId: job.jobId,
          threadId,
          ...(worktreePath ? { cwd: worktreePath } : {}),
        },
      })
      if (!queued) {
        pending.delete(delegation.id)
        deleteDelegationRuntime(delegationRuntimeByIdRef.current, delegation.id)
        const waveIdx = waveItems.findIndex(item => item.delegationId === delegation.id)
        if (waveIdx >= 0) waveItems.splice(waveIdx, 1)
        console.warn('[orchestration] delegation enqueue rejected', {
          delegationId: delegation.id,
          orchestrationJobId: job.jobId,
          fromPaneId,
          toPaneId,
          toAgentId: routedAgentId,
          reason: 'enqueue_rejected',
        })
        const enqueueRejectedLaneDelegation = laneDelegationForJob(
          job,
          delegationRuntimeByIdRef.current,
        )
        enqueueOrchestrationSend(fromPaneId, {
          text: formatDelegationResultFollowUp({
            id: delegation.id,
            status: 'fail',
            summary: `Delegation to "${routedAgentId}" was dropped before dispatch (queue rejected the send).`,
            fromPaneId,
            orchestrationJobId: job.jobId,
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
          ...(enqueueRejectedLaneDelegation ? { delegation: enqueueRejectedLaneDelegation } : {}),
        })
        continue
      }
    }
    syncAwaitingFromPending()
  }, [
    enqueueOrchestrationSend,
    getOrCreateJobsMap,
    orchestrationMaxRoundsForPane,
    orchestrationWorkStyleForPane,
    resolveActiveJob,
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
    if ((countActiveLanesByPane(orchestrationJobsByPaneRef.current).get(freedPaneId) ?? 0) >= MAX_LANES_PER_PANE) return false

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
    const threadId = crypto.randomUUID()
    job.pending.set(next.delegation.id, {
      toPaneId: next.toPaneId,
      toAgentId: next.toAgentId,
      toThreadId: threadId,
      startedAt: Date.now(),
    })
    registerDelegationRuntime(delegationRuntimeByIdRef.current, {
      delegationId: next.delegation.id,
      fromPaneId,
      toPaneId: next.toPaneId,
      toAgentId: next.toAgentId,
      toThreadId: threadId,
      jobId: job.jobId,
      objective: next.delegation.objective,
      ...(next.parentDelegationId ? { parentDelegationId: next.parentDelegationId } : {}),
    })
    upsertOrchestrationWaveItem(job, {
      delegationId: next.delegation.id,
      toAgentId: next.toAgentId,
      toPaneId: next.toPaneId,
      toThreadId: threadId,
      status: 'running',
    })

    let worktreePath: string | undefined
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
        const wtPath = `${baseCwd.replace(/\/+$/, '')}/${relPath}`
        const addResult = await window.api.gitWorktreeAdd({ path: baseCwd }, {
          worktreePath: wtPath,
          branch,
          fromRef: branchInfo.baseBranch,
        })
        if (addResult.ok) {
          worktreePath = wtPath
          worktreesByDelegationRef.current.set(next.delegation.id, {
            fromPaneId,
            toPaneId: next.toPaneId,
            toThreadId: threadId,
            worktreePath: wtPath,
            branch,
            baseCwd,
            baseBranch: branchInfo.baseBranch,
          })
          attachDelegationWorktree(delegationRuntimeByIdRef.current, next.delegation.id, {
            worktreePath: wtPath,
            branch,
            baseCwd,
            baseBranch: branchInfo.baseBranch,
          })
        } else {
          const detail = addResult.error || addResult.stderr || 'unknown error'
          console.error('[orchestration] worktree add failed (deferred)', {
            delegationId: next.delegation.id,
            ...(next.parentDelegationId ? { parentDelegationId: next.parentDelegationId } : {}),
            orchestrationJobId: job.jobId,
            fromPaneId,
            toPaneId: next.toPaneId,
            toAgentId: next.toAgentId,
            reason: 'worktree_add_failed_deferred',
            detail,
          })
          job.pending.delete(next.delegation.id)
          deleteDelegationRuntime(delegationRuntimeByIdRef.current, next.delegation.id)
          const waveIdx = job.waveItems.findIndex(item => item.delegationId === next.delegation.id)
          if (waveIdx >= 0) job.waveItems.splice(waveIdx, 1)
          const maxRounds = orchestrationMaxRoundsForPane(fromPaneId, next.tabId)
          const round = job.round || 1
          enqueueOrchestrationSend(fromPaneId, {
            text: formatDelegationResultFollowUp({
              id: next.delegation.id,
              status: 'fail',
              summary: `Worktree isolation failed for "${next.toAgentId}": ${detail}`,
              fromPaneId,
              orchestrationJobId: job.jobId,
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
        orchestrationJobId: job.jobId,
        threadId,
        ...(worktreePath ? { cwd: worktreePath } : {}),
      },
    })
    syncAwaitingFromPending()
    return true
  }, [
    enqueueOrchestrationSend,
    orchestrationMaxRoundsForPane,
    orchestrationWorkStyleForPane,
    syncAwaitingFromPending,
  ])

  const wakeDeferredForFreedPane = useCallback(async (
    freedPaneId: string,
    exceptFromPaneId?: string,
  ): Promise<void> => {
    const wanted = freedPaneId.trim()
    if (!wanted) return
    for (const fromPaneId of orchestratorPanesWithDeferredForPane(
      orchestrationJobsByPaneRef.current,
      wanted,
    )) {
      if (fromPaneId === exceptFromPaneId) continue
      if ((countActiveLanesByPane(orchestrationJobsByPaneRef.current).get(wanted) ?? 0) >= MAX_LANES_PER_PANE) {
        break
      }
      await startNextDeferredForPane(fromPaneId, wanted)
    }
  }, [startNextDeferredForPane])

  /**
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
      toThreadId: string
      worktreePath: string
      branch: string
      baseCwd: string
      baseBranch: string
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
        console.warn('[orchestration] worktree commit failed', {
          delegationId: result.id,
          orchestrationJobId: getDelegationRuntime(delegationRuntimeByIdRef.current, result.id)?.jobId,
          fromPaneId,
          toPaneId: info.toPaneId,
          toAgentId: result.toAgentId,
          reason: 'commit_failed',
          detail: commitResult.stderr,
        })
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
            toThreadId: info.toThreadId,
            startedAt: Date.now(),
          })
          markDelegationRuntimeStatus(delegationRuntimeByIdRef.current, result.id, 'pending')
        }
        syncAwaitingFromPending()
        const conflictJobId = job?.jobId
          ?? getDelegationRuntime(delegationRuntimeByIdRef.current, result.id)?.jobId
          ?? ''
        enqueueOrchestrationSend(info.toPaneId, {
          text: buildConflictFollowUp({ conflictFiles: mergeResult.conflictFiles, branch: info.branch }),
          focusPane: false,
          delegation: {
            id: result.id,
            fromPaneId,
            toAgentId: result.toAgentId ?? '',
            orchestrationJobId: conflictJobId,
            threadId: info.toThreadId,
            cwd: info.worktreePath,
          },
        })
        return
      }
      if (!mergeResult.ok) {
        // Terminal sin conflicto: no hay retry ni prompt al especialista, así
        // que limpiamos como si el merge hubiera sido ok — pero notamos el
        // fallo. Antes de esta rama solo se hacía warn+return y quedaban
        // colgados el worktree, el override del pane y la entry del registry.
        // QA slice 3 pendiente resuelto.
        const runtime = getDelegationRuntime(delegationRuntimeByIdRef.current, result.id)
        console.warn('[orchestration] worktree merge failed', {
          delegationId: result.id,
          ...(runtime?.parentDelegationId ? { parentDelegationId: runtime.parentDelegationId } : {}),
          orchestrationJobId: runtime?.jobId,
          fromPaneId,
          toPaneId: info.toPaneId,
          toAgentId: result.toAgentId,
          reason: 'merge_failed',
          detail: mergeResult.stderr,
        })
        await window.api.gitWorktreeAbortMerge({ path: info.baseCwd })
        try {
          await window.api.gitWorktreeRemove({ path: info.baseCwd }, {
            worktreePath: info.worktreePath,
            branch: info.branch,
            force: true,
          })
        } catch (err) {
          console.warn('[orchestration] worktree cleanup after merge fail failed', {
            delegationId: result.id,
            ...(runtime?.parentDelegationId ? { parentDelegationId: runtime.parentDelegationId } : {}),
            orchestrationJobId: runtime?.jobId,
            fromPaneId,
            toPaneId: info.toPaneId,
            toAgentId: result.toAgentId,
            reason: 'merge_failed_cleanup_failed',
            error: err instanceof Error ? err.message : String(err),
          })
        }
        worktreesByDelegationRef.current.delete(result.id)
        deleteDelegationRuntime(delegationRuntimeByIdRef.current, result.id)
        return
      }
      await window.api.gitWorktreeRemove({ path: info.baseCwd }, {
        worktreePath: info.worktreePath,
        branch: info.branch,
        force: true,
      })
      worktreesByDelegationRef.current.delete(result.id)
      deleteDelegationRuntime(delegationRuntimeByIdRef.current, result.id)
    })
    mergeQueueByOrchestratorRef.current.set(fromPaneId, chainedOp)
    return chainedOp
  }, [enqueueOrchestrationSend, syncAwaitingFromPending])

  const applyPruneDelegationThreadsForCompletedJob = useCallback((job: OrchestrationJob) => {
    // Los carriles que los panes reportan vivos quedan fuera de la poda: el
    // hilo y su transcripto siguen en uso hasta que el turno cierre.
    const running = new Map<string, Set<string>>()
    mergePaneReportedRunningThreadIds(running, agentPlaneStatusRef.current)
    const { tabs: nextTabs, chatDeletes } = pruneDelegationThreadsForJob(
      tabsRef.current,
      job,
      undefined,
      undefined,
      running,
    )
    if (nextTabs !== tabsRef.current) {
      tabsRef.current = nextTabs
      setTabs(nextTabs)
    }
    for (const { ref, threadId } of chatDeletes) {
      window.api.deleteAgentChat(ref, threadId)
    }
  }, [])

  const maybeWakeOrchestratorForJob = useCallback(async (
    fromPaneId: string,
    job: OrchestrationJob,
  ) => {
    if (!canWakeOrchestratorForJob(job)) return
    applyPruneDelegationThreadsForCompletedJob(job)

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

    const liveJobs = orchestrationJobsByPaneRef.current.get(fromPaneId)
    if (!shouldDeliverOrchestrationJobFollowUp(liveJobs, job)) return

    const batchResults = prepareOrchestratorWakeBatch(job.completedResults)
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
    const batchLaneDelegation = laneDelegationForJob(job, delegationRuntimeByIdRef.current)
    const enqueued = enqueueOrchestrationSend(fromPaneId, {
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
      ...(batchLaneDelegation ? { delegation: batchLaneDelegation } : {}),
    })

    const fifo = orchestrationFifoByPaneRef.current.get(fromPaneId) ?? []
    clearCompletedResultsIfDelivered(job, enqueued, fifo)
    syncAwaitingFromPending()
  }, [
    applyPruneDelegationThreadsForCompletedJob,
    enqueueOrchestrationSend,
    finalizeDelegationWorktree,
    orchestrationMaxRoundsForPane,
    orchestrationWorkStyleForPane,
    syncAwaitingFromPending,
  ])

  const handleOrphanDelegationResult = useCallback((
    result: DelegateResult,
    runtime: DelegationRuntimeEntry | undefined,
    detail?: string,
  ) => {
    const toPaneId = runtime?.toPaneId?.trim() || result.toPaneId?.trim()
    if (runtime) {
      markDelegationRuntimeStatus(delegationRuntimeByIdRef.current, result.id, 'orphaned')
      const worktreeInfo = worktreesByDelegationRef.current.get(result.id)
      if (worktreeInfo) {
        void window.api.gitWorktreeRemove({ path: worktreeInfo.baseCwd }, {
          worktreePath: worktreeInfo.worktreePath,
          branch: worktreeInfo.branch,
          force: true,
        }).catch(() => undefined)
        worktreesByDelegationRef.current.delete(result.id)
      }
      console.warn(
        `[orchestration] resultado huérfano recuperado por registry`,
        {
          delegationId: result.id,
          fromPaneId: runtime.fromPaneId,
          toPaneId: runtime.toPaneId,
          jobId: runtime.jobId,
          reason: 'orphaned_result',
          detail,
          toAgentId: result.toAgentId,
          status: result.status,
          receivedFromPaneId: result.fromPaneId,
          receivedJobId: result.orchestrationJobId,
        },
      )
      // Sin esto la fila queda en running hasta que el reconcile por antigüedad la cierre.
      const ownerJob = orchestrationJobsByPaneRef.current.get(runtime.fromPaneId)?.get(runtime.jobId)
      if (ownerJob?.pending.has(result.id)) {
        ownerJob.pending.delete(result.id)
        const idx = ownerJob.waveItems.findIndex(item => item.delegationId === result.id)
        if (idx >= 0) ownerJob.waveItems.splice(idx, 1)
        syncAwaitingFromPending()
      }
      deleteDelegationRuntime(delegationRuntimeByIdRef.current, result.id)
      if (toPaneId) void wakeDeferredForFreedPane(toPaneId)
      const wakeFromPaneId = result.fromPaneId?.trim()
      const wakeJobId = result.orchestrationJobId?.trim()
      if (wakeFromPaneId && wakeJobId) {
        const wakeJob = orchestrationJobsByPaneRef.current.get(wakeFromPaneId)?.get(wakeJobId)
        if (wakeJob) void maybeWakeOrchestratorForJob(wakeFromPaneId, wakeJob)
      }
      return
    }
    console.warn(
      `[orchestration] resultado sin delegación pendiente ni registry: ${result.id}`,
      {
        delegationId: result.id,
        toAgentId: result.toAgentId,
        status: result.status,
        reason: 'orphaned_result_unknown',
        detail,
        receivedFromPaneId: result.fromPaneId,
        receivedJobId: result.orchestrationJobId,
      },
    )
    if (toPaneId) void wakeDeferredForFreedPane(toPaneId)
    const wakeFromPaneId = result.fromPaneId?.trim()
    const wakeJobId = result.orchestrationJobId?.trim()
    if (wakeFromPaneId && wakeJobId) {
      const wakeJob = orchestrationJobsByPaneRef.current.get(wakeFromPaneId)?.get(wakeJobId)
      if (wakeJob) void maybeWakeOrchestratorForJob(wakeFromPaneId, wakeJob)
    }
  }, [wakeDeferredForFreedPane, syncAwaitingFromPending, maybeWakeOrchestratorForJob])

  const handleDelegationTurnComplete = useCallback(async (result: DelegateResult) => {
    const resolution = resolveDelegationDelivery(delegationRuntimeByIdRef.current, result)
    let fromPaneId: string | undefined
    let job: OrchestrationJob | undefined

    if (resolution.kind === 'deliver') {
      fromPaneId = result.fromPaneId.trim()
      job = orchestrationJobsByPaneRef.current.get(fromPaneId)?.get(result.orchestrationJobId.trim())
      if (!job || !job.pending.has(result.id)) {
        handleOrphanDelegationResult(result, resolution.entry, 'pending_gone')
        return
      }
    } else if (resolution.kind === 'mismatch') {
      console.warn('[orchestration] delegation delivery mismatch', {
        reason: resolution.reason,
        delegationId: result.id,
        expectedFromPaneId: resolution.entry.fromPaneId,
        receivedFromPaneId: result.fromPaneId,
        expectedJobId: resolution.entry.jobId,
        receivedJobId: result.orchestrationJobId,
      })
      const mismatchId = result.id.trim()
      if (mismatchId) {
        for (const jobsMap of orchestrationJobsByPaneRef.current.values()) {
          for (const ownerJob of jobsMap.values()) {
            if (!ownerJob.pending.has(mismatchId)) continue
            ownerJob.pending.delete(mismatchId)
            const waveIdx = ownerJob.waveItems.findIndex(item => item.delegationId === mismatchId)
            if (waveIdx >= 0) ownerJob.waveItems.splice(waveIdx, 1)
          }
        }
        syncAwaitingFromPending()
      }
      handleOrphanDelegationResult(result, resolution.entry, `mismatch_${resolution.reason}`)
      return
    } else {
      handleOrphanDelegationResult(
        result,
        getDelegationRuntime(delegationRuntimeByIdRef.current, result.id),
        'unknown',
      )
      return
    }
    if (job.completedResults.some(r => r.id === result.id)) {
      console.warn('[orchestration] duplicate result ignored', { delegationId: result.id })
      const duplicateMeta = job.pending.get(result.id)
      const duplicateToPaneId = duplicateMeta?.toPaneId
      job.pending.delete(result.id)
      syncAwaitingFromPending()
      if (duplicateToPaneId) void wakeDeferredForFreedPane(duplicateToPaneId)
      if (shouldWakeJob(job.pending.size, job.deferred.length)) {
        void maybeWakeOrchestratorForJob(fromPaneId, job)
      }
      return
    }
    const completedMeta = job.pending.get(result.id)
    const freedPaneId = completedMeta?.toPaneId
    job.pending.delete(result.id)
    let remaining = job.pending.size
    job.completedResults.push(result)
    if (result.status === 'fail' || result.status === 'aborted') {
      releaseDelegateDispatchKeyForJob(delegateDispatchKeysByJobRef, job.jobId, result.id)
    }
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
        markDelegationRuntimeStatus(delegationRuntimeByIdRef.current, result.id, 'awaiting_merge')
        void finalizeDelegationWorktree(fromPaneId, result, {
          toPaneId: worktreeInfo.toPaneId,
          toThreadId: worktreeInfo.toThreadId,
          worktreePath: worktreeInfo.worktreePath,
          branch: worktreeInfo.branch,
          baseCwd: worktreeInfo.baseCwd,
          baseBranch: worktreeInfo.baseBranch,
        })
        await (mergeQueueByOrchestratorRef.current.get(fromPaneId) ?? Promise.resolve())
      } else {
        markDelegationRuntimeStatus(delegationRuntimeByIdRef.current, result.id, 'completed')
        deleteDelegationRuntime(delegationRuntimeByIdRef.current, result.id)
      }
      await startNextDeferredForPane(fromPaneId, freedPaneId)
      await wakeDeferredForFreedPane(freedPaneId, fromPaneId)
      remaining = job.pending.size
      const deferredLeft = job.deferred.length
      if (remaining > 0 || deferredLeft > 0) return
    } else if (canFinalize && worktreeInfo) {
      markDelegationRuntimeStatus(delegationRuntimeByIdRef.current, result.id, 'awaiting_merge')
      job.pendingMerges.push({
        delegationId: result.id,
        completedAt: Date.now(),
        result,
        info: {
          fromPaneId: worktreeInfo.fromPaneId,
          toPaneId: worktreeInfo.toPaneId,
          toThreadId: worktreeInfo.toThreadId,
          worktreePath: worktreeInfo.worktreePath,
          branch: worktreeInfo.branch,
          baseCwd: worktreeInfo.baseCwd,
          baseBranch: worktreeInfo.baseBranch,
        },
      })
    } else {
      markDelegationRuntimeStatus(delegationRuntimeByIdRef.current, result.id, 'completed')
      deleteDelegationRuntime(delegationRuntimeByIdRef.current, result.id)
    }

    if (freedPaneId && !deferredForFreedPane) {
      await wakeDeferredForFreedPane(freedPaneId)
    }

    const deferredLeft = job.deferred.length
    if (deferredLeft > 0) return
    await maybeWakeOrchestratorForJob(fromPaneId, job)
  }, [
    finalizeDelegationWorktree,
    handleOrphanDelegationResult,
    maybeWakeOrchestratorForJob,
    startNextDeferredForPane,
    syncAwaitingFromPending,
    wakeDeferredForFreedPane,
  ])

  const closeOrchestrationStateForPane = useCallback((closedPaneId: string) => {
    const paneId = closedPaneId.trim()
    if (!paneId) return

    const paneClosedSummary = t('agentPane.delegationPaneClosedSummary')
    for (const [fromPaneId, jobsMap] of orchestrationJobsByPaneRef.current.entries()) {
      for (const job of jobsMap.values()) {
        for (const [delegationId, meta] of job.pending.entries()) {
          if (meta.toPaneId !== paneId) continue
          void handleDelegationTurnComplete({
            id: delegationId,
            status: 'fail',
            summary: paneClosedSummary,
            fromPaneId,
            orchestrationJobId: job.jobId,
            toAgentId: meta.toAgentId,
            toPaneId: paneId,
            ...(meta.toThreadId ? { toThreadId: meta.toThreadId } : {}),
          })
        }
      }
    }

    const closedJobs = orchestrationJobsByPaneRef.current.get(paneId)
    if (closedJobs) {
      for (const jobId of closedJobs.keys()) {
        delegateDispatchKeysByJobRef.current.delete(jobId)
      }
    }
    orchestrationJobsByPaneRef.current.delete(paneId)
    activeOrchestrationJobByPaneRef.current.delete(paneId)
    orchestrationFifoByPaneRef.current.delete(paneId)
  }, [handleDelegationTurnComplete, t])
  closeOrchestrationStateForPaneRef.current = closeOrchestrationStateForPane

  reconcileIdleDelegationTargetRef.current = (paneId, summary, failed) => {
    if (reconcilingIdleDelegationPaneIdsRef.current.has(paneId)) return
    const found = findPendingDelegationByToPane(orchestrationJobsByPaneRef.current, paneId)
    if (!found) return
    // No cerrar con snippet viejo antes de que el especialista arranque el turno nuevo.
    if (!canReconcileIdlePending(found.sawBusy, {
      startedAt: found.startedAt,
      nowMs: Date.now(),
    })) return
    // Mid-orquestador con olas propias vivas: no liberar el hold del padre.
    if (listJobsForPane(orchestrationJobsByPaneRef.current, paneId).some(isJobAwaiting)) return

    const runReconcile = (): void => {
      reconcilingIdleDelegationPaneIdsRef.current.add(paneId)
      void window.api.isAgentTurnActive(paneId).catch(() => false).then(async turnActive => {
        if (turnActive) return
        const still = findPendingDelegationByToPane(orchestrationJobsByPaneRef.current, paneId)
        if (!still || still.delegationId !== found.delegationId) return
        if (!canReconcileIdlePending(still.sawBusy, {
          startedAt: still.startedAt,
          nowMs: Date.now(),
        })) return
        if (listJobsForPane(orchestrationJobsByPaneRef.current, paneId).some(isJobAwaiting)) return
        const emptyFallback = i18next.t('agentPane.delegationEmptySummary')
        const unconfirmedLabel = i18next.t('agentPane.delegationUnconfirmedSummary')
        let finalSummary = summary.trim() || emptyFallback
        let resultContextId: string | undefined
        if (isDelegationSummaryPlaceholder(finalSummary) && still.toAgentId) {
          const tab = tabsRef.current.find(item => (item.paneIds ?? []).includes(paneId))
          const cwd = tab?.projectFolder?.trim()
          if (cwd) {
            const results = await window.api.readAgentResultsLatest({
              cwd,
              agentId: still.toAgentId,
            })
            if (results.ok) {
              finalSummary = buildDelegationTurnSummary({
                assistantText: finalSummary,
                resultsSummary: results.summary,
                resultsChanges: results.changes,
                emptyFallback,
              })
              if (!isDelegationSummaryPlaceholder(finalSummary)) {
                resultContextId = agentResultContextIdForSlug(still.toAgentId)
              }
            }
          }
        }
        const outcome = resolveIdleReconcileOutcome({
          failed,
          sawBusy: still.sawBusy,
          summary: finalSummary,
          emptyFallback,
          unconfirmedLabel,
        })
        const attachResultContextId = outcome.status === 'fail' && still.sawBusy !== true
          ? undefined
          : resultContextId
        void handleDelegationTurnComplete({
          id: found.delegationId,
          status: outcome.status,
          summary: outcome.summary,
          fromPaneId: found.fromPaneId,
          orchestrationJobId: found.job.jobId,
          toAgentId: found.toAgentId,
          toPaneId: paneId,
          ...(found.job.pending.get(found.delegationId)?.toThreadId
            ? { toThreadId: found.job.pending.get(found.delegationId)!.toThreadId }
            : {}),
          ...(attachResultContextId ? { resultContextId: attachResultContextId } : {}),
        })
      }).finally(() => {
        reconcilingIdleDelegationPaneIdsRef.current.delete(paneId)
      })
    }

    if (found.sawBusy) {
      window.setTimeout(runReconcile, 300)
    } else {
      runReconcile()
    }
  }

  const requestPlaneStop = useCallback((paneId: string) => {
    const cancelled = cancelDeferredDelegationsForStoppedPane(
      orchestrationJobsByPaneRef.current,
      paneId,
    )
    for (const entry of cancelled) {
      deleteDelegationRuntime(delegationRuntimeByIdRef.current, entry.delegationId)
      const round = entry.job.round || 1
      const maxRounds = orchestrationMaxRoundsForPane(entry.fromPaneId, entry.tabId)
      enqueueOrchestrationSend(entry.fromPaneId, {
        text: formatDelegationResultFollowUp({
          id: entry.delegationId,
          status: 'fail',
          summary: i18next.t('agentPane.delegationAbortedSummary'),
          fromPaneId: entry.fromPaneId,
          orchestrationJobId: entry.job.jobId,
          toAgentId: entry.toAgentId,
        }, {
          round,
          maxRounds,
          batchRemaining: 0,
          continuousProductOwner: false,
          orchestrationJobId: entry.job.jobId,
          workStyle: orchestrationWorkStyleForPane(entry.fromPaneId, entry.tabId),
        }),
        focusPane: false,
        orchestrationFollowUp: true,
        orchestrationJobId: entry.job.jobId,
        allowDelegations: !orchestrationRoundsAtCap(round, maxRounds),
      })
    }
    if (cancelled.length) syncAwaitingFromPending()
    setPlaneStopPaneIds(previous => {
      if (previous.has(paneId)) return previous
      const next = new Set(previous)
      next.add(paneId)
      return next
    })
  }, [
    enqueueOrchestrationSend,
    orchestrationMaxRoundsForPane,
    orchestrationWorkStyleForPane,
    syncAwaitingFromPending,
  ])

  const abortOrchestrationRun = useCallback((fromPaneId: string) => {
    const jobsMap = orchestrationJobsByPaneRef.current.get(fromPaneId)
    const abortedTargets: Array<{ toPaneId: string; toThreadId?: string }> = []
    if (jobsMap) {
      for (const job of jobsMap.values()) {
        applyPruneDelegationThreadsForCompletedJob(job)
      }
      for (const jobId of [...jobsMap.keys()]) {
        delegateDispatchKeysByJobRef.current.delete(jobId)
        const { abortedTargets: jobTargets } = abortOrchestrationJob(jobsMap, jobId)
        abortedTargets.push(...jobTargets)
      }
    }
    const runningTargets = collectOrchestratorPendingLaneStops(abortedTargets)
    orchestrationJobsByPaneRef.current.delete(fromPaneId)
    activeOrchestrationJobByPaneRef.current.delete(fromPaneId)
    for (const entry of delegationRuntimeByIdRef.current.values()) {
      if (entry.fromPaneId !== fromPaneId) continue
      entry.status = 'superseded'
    }
    // No reinyectar follow-ups ni subtareas pendientes de este orquestador.
    orchestrationFifoByPaneRef.current.delete(fromPaneId)
    for (const [paneId, queue] of [...orchestrationFifoByPaneRef.current.entries()]) {
      const next = queue.filter(item => item.delegation?.fromPaneId !== fromPaneId)
      if (next.length) orchestrationFifoByPaneRef.current.set(paneId, next)
      else orchestrationFifoByPaneRef.current.delete(paneId)
    }
    // preferSend ya ofrecido: no debe consumirse tras el abort.
    updatePlaneSendByPane(prev => clearPlaneSendsForOrchestrationAbort(prev, fromPaneId))
    for (const controls of planeQueueControlsByPaneRef.current.values()) {
      controls.cancelDelegationsFrom(fromPaneId)
    }
    for (const target of runningTargets) {
      applyDelegationLaneStop(target, {}, {
        stopRunKey: runKey => { window.api.stopAgentTurn(runKey) },
        stopPane: requestPlaneStop,
        warn: payload => { console.warn('[orchestration]', payload) },
      })
    }
    setOrchestrationFifoTick(n => n + 1)
    syncAwaitingFromPending()
    const freedToPaneIds = new Set<string>()
    for (const target of abortedTargets) {
      if (target.toPaneId) freedToPaneIds.add(target.toPaneId)
    }
    for (const toPaneId of freedToPaneIds) {
      void wakeDeferredForFreedPane(toPaneId)
    }
    // QA fix: no dejar worktrees/ramas huérfanos de este orquestador al abortar.
    void cleanupWorktreesForPane(fromPaneId)
  }, [applyPruneDelegationThreadsForCompletedJob, cleanupWorktreesForPane, requestPlaneStop, syncAwaitingFromPending, wakeDeferredForFreedPane])
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

    const pendingMeta = job.pending.get(id)
    const runtimeEntry = getDelegationRuntime(delegationRuntimeByIdRef.current, id)

    const abort = abortOneDelegationInJob(job, id)
    if (!abort.ok) return

    for (const [paneId, queue] of [...orchestrationFifoByPaneRef.current.entries()]) {
      const next = queue.filter(item => item.delegation?.id !== id)
      if (next.length) orchestrationFifoByPaneRef.current.set(paneId, next)
      else orchestrationFifoByPaneRef.current.delete(paneId)
    }
    updatePlaneSendByPane(prev => clearPlaneSendsForSingleDelegationAbort(prev, id))
    for (const controls of planeQueueControlsByPaneRef.current.values()) {
      controls.cancelDelegation(id)
    }

    const toPaneId = abort.toPaneId
    if (abort.wasPending && toPaneId) {
      const laneStop = resolveSingleDelegationLaneStop({
        toPaneId,
        pendingToThreadId: pendingMeta?.toThreadId,
        registryToThreadId: runtimeEntry?.toThreadId,
      })
      applyDelegationLaneStop(laneStop, { delegationId: id }, {
        stopRunKey: runKey => { window.api.stopAgentTurn(runKey) },
        stopPane: requestPlaneStop,
        warn: payload => { console.warn('[orchestration]', payload) },
      })
    }

    const worktreeInfo = worktreesByDelegationRef.current.get(id)
    if (worktreeInfo) {
      try {
        await window.api.gitWorktreeRemove({ path: worktreeInfo.baseCwd }, {
          worktreePath: worktreeInfo.worktreePath,
          branch: worktreeInfo.branch,
          force: true,
        })
      } catch (err) {
        const runtime = getDelegationRuntime(delegationRuntimeByIdRef.current, id)
        console.warn('[orchestration] worktree cleanup on abort failed', {
          delegationId: id,
          ...(runtime?.parentDelegationId ? { parentDelegationId: runtime.parentDelegationId } : {}),
          orchestrationJobId: runtime?.jobId,
          fromPaneId: worktreeInfo.fromPaneId,
          toPaneId: worktreeInfo.toPaneId,
          toAgentId: abort.toAgentId,
          reason: 'abort_cleanup_failed',
          error: err instanceof Error ? err.message : String(err),
        })
      } finally {
        worktreesByDelegationRef.current.delete(id)
      }
    }

    // También para diferidas: sin resultado el job quedaba vacío sin despertar
    // al orquestador y la delegación se perdía en silencio.
    if (abort.wasPending || abort.wasDeferred) {
      const fromPaneIdForResult = runtimeEntry?.fromPaneId?.trim() || fromPaneId
      const orchestrationJobId = job.jobId
      const abortedThreadId = pendingMeta?.toThreadId?.trim()
        || runtimeEntry?.toThreadId?.trim()
        || ''
      if (!fromPaneIdForResult || !orchestrationJobId) {
        console.warn('[orchestration] delegation abort result omitted', {
          reason: 'missing_sender',
          delegationId: id,
        })
      } else {
        job.completedResults.push({
          id,
          status: 'aborted',
          summary: i18next.t('agentPane.delegationAbortedSummary'),
          fromPaneId: fromPaneIdForResult,
          orchestrationJobId,
          ...(abort.toAgentId ? { toAgentId: abort.toAgentId } : {}),
          ...(toPaneId ? { toPaneId } : {}),
          ...(abortedThreadId ? { toThreadId: abortedThreadId } : {}),
        })
        releaseDelegateDispatchKeyForJob(delegateDispatchKeysByJobRef, job.jobId, id)
      }
    }

    deleteDelegationRuntime(delegationRuntimeByIdRef.current, id)

    setOrchestrationFifoTick(n => n + 1)
    syncAwaitingFromPending()

    if (abort.wasPending && toPaneId) {
      const deferredForFreed = job.deferred.some(item => item.toPaneId === toPaneId)
      if (deferredForFreed) {
        await startNextDeferredForPane(fromPaneId, toPaneId)
        await wakeDeferredForFreedPane(toPaneId, fromPaneId)
      } else {
        await wakeDeferredForFreedPane(toPaneId)
      }
    }

    await maybeWakeOrchestratorForJob(fromPaneId, job)
  }, [
    maybeWakeOrchestratorForJob,
    requestPlaneStop,
    startNextDeferredForPane,
    syncAwaitingFromPending,
    wakeDeferredForFreedPane,
  ])

  const handleOrchestratorStop = useCallback((fromPaneId: string) => {
    abortOrchestrationRun(fromPaneId)
  }, [abortOrchestrationRun])

  // Drena FIFO de orquestación: ofrece preferSend si el pane está idle.
  useEffect(() => {
    const queues = orchestrationFifoByPaneRef.current
    const pendingIds = pendingOrchestratorIdsFromJobs(orchestrationJobsByPaneRef.current)
    for (const paneId of [...queues.keys()]) {
      const status = agentPlaneStatus[paneId]
      const skipReason = describeOrchestrationFifoSkip({
        hasPreferSendSlot: Boolean(planeSendByPaneRef.current[paneId]),
        paneBusy: status?.busy === true,
        visibleQueued: status?.queuedTurns?.length ?? 0,
        maxVisibleQueued: MAX_VISIBLE_QUEUED_TURNS,
        headIsLaneDelegation: Boolean(
          queues.get(paneId)?.[0]?.delegation?.threadId?.trim(),
        ),
      })
      if (skipReason) {
        // Un warn por (pane, motivo): la subtarea sigue "en curso" en Pulse
        // mientras espera aquí, y sin esta línea no se ve quién la retiene.
        const skipKey = `${paneId}:${skipReason}`
        if (!loggedOrchestrationSkipKeysRef.current.has(skipKey)) {
          loggedOrchestrationSkipKeysRef.current.add(skipKey)
          console.warn('[orchestration] FIFO retenida', {
            paneId,
            reason: skipReason,
            queued: queues.get(paneId)?.length ?? 0,
          })
        }
        continue
      }
      loggedOrchestrationSkipKeysRef.current.delete(`${paneId}:prefer_send_slot_busy`)
      loggedOrchestrationSkipKeysRef.current.delete(`${paneId}:pane_busy`)
      loggedOrchestrationSkipKeysRef.current.delete(`${paneId}:visible_queue_full`)
      const queue = queues.get(paneId)
      if (!queue?.length) {
        queues.delete(paneId)
        setOrchestrationFifoTick(n => n + 1)
        continue
      }
      // Descartar subtareas de orquestadores ya abortados (sin pending).
      while (queue.length && shouldDiscardAbortedDelegationFifoHead(queue[0], pendingIds)) {
        const dropped = queue.shift()
        // Aviso explícito: sin esto la subtarea se perdía en silencio.
        console.warn('[orchestration] delegación descartada de la FIFO', {
          reason: 'orchestrator_aborted',
          paneId,
          delegationId: dropped?.delegation?.id,
          fromPaneId: dropped?.delegation?.fromPaneId,
        })
      }
      if (!queue.length) {
        queues.delete(paneId)
        setOrchestrationFifoTick(n => n + 1)
        continue
      }
      const head = queue.shift()
      if (!head) {
        if (!queue.length) {
          queues.delete(paneId)
          setOrchestrationFifoTick(n => n + 1)
        }
        continue
      }
      if (!queue.length) {
        queues.delete(paneId)
        setOrchestrationFifoTick(n => n + 1)
      }
      if (planeSendByPaneRef.current[paneId]) {
        queues.set(paneId, [head, ...(queues.get(paneId) ?? [])])
        continue
      }
      if (head.orchestrationJobId?.trim()) {
        activeOrchestrationJobByPaneRef.current.set(paneId, head.orchestrationJobId.trim())
      }
      // Sin reinserción, si el slot se ocupó en la carrera el head ya salió de la cola y se pierde.
      let placed = false
      updatePlaneSendByPane(prev => {
        const claim = claimPlaneSendSlot(prev, paneId, head)
        placed = claim.claimed
        return claim.slots
      })
      if (!placed) {
        queues.set(paneId, [head, ...(queues.get(paneId) ?? [])])
        setOrchestrationFifoTick(n => n + 1)
      }
    }
  }, [agentPlaneStatus, orchestrationFifoTick, planeSendByPane])

  const applyHumanSendFifoDrainForPane = useCallback((paneId: string) => {
    const queues = humanSendFifoByPaneRef.current
    const queue = queues.get(paneId)
    if (!queue?.length) {
      if (queue) queues.delete(paneId)
      return
    }

    const planeStatus = agentPlaneStatusRef.current[paneId]
    const controls = planeQueueControlsByPaneRef.current.get(paneId)
    const queuedTurns = planeStatus?.queuedTurns ?? []
    // Sin activeThreadId publicado (pane sin montar / legacy): drenaje pane-level,
    // no inventar DEFAULT_THREAD_ID — dejaría atascados envíos de otros hilos.
    const publishedThreadId = planeStatus?.activeThreadId?.trim() || undefined
    // busy por hilo: un turno corriendo en otro hilo no bloquea este envío.
    const busyForThread = publishedThreadId
      ? computeBusyForGate(
        planeStatus?.busy === true,
        planeStatus?.runningThreadIds ?? [],
        publishedThreadId,
      )
      : planeStatus?.busy === true
    const result = drainHumanSendFifoForPane({
      queue,
      ...(publishedThreadId ? { publishedThreadId } : {}),
      busy: busyForThread,
      hasControls: Boolean(controls),
      drainInFlight: humanDirectDrainInFlightRef.current.has(paneId),
      visibleQueuedCount: publishedThreadId
        ? countQueuedTurnsForThread(queuedTurns, publishedThreadId)
        : queuedTurns.length,
      planeSendOccupied: Boolean(planeSendByPaneRef.current[paneId]),
      isSendIdVisible: sendId => {
        const id = sendId?.trim()
        if (!id) return false
        return queuedTurns.some(turn => queuedTurnSourceSendIds(turn).includes(id))
      },
    })

    const persistQueue = (next: typeof queue): void => {
      if (!next.length) queues.delete(paneId)
      else queues.set(paneId, next)
    }

    switch (result.kind) {
      case 'noop':
      case 'skip_in_flight':
      case 'skip_visible_cap':
      case 'skip_slot_occupied':
        return
      case 'queue_updated':
        persistQueue(result.queue)
        return
      case 'skip_duplicate_visible':
        persistQueue(result.queue)
        setHumanSendFifoTick(n => n + 1)
        return
      case 'busy_enqueue': {
        persistQueue(result.queue)
        if (!controls) return
        const { head } = result
        humanDirectDrainInFlightRef.current.add(paneId)
        // El catch devuelve 'full' (reintenta) y garantiza soltar el in-flight:
        // un rechazo dejaba el flag puesto y la FIFO no volvía a drenar nunca.
        void controls.enqueueHuman({
          text: head.text,
          images: head.images,
          sendId: head.sendId,
          ...(head.extraContextIds?.length ? { extraContextIds: head.extraContextIds } : {}),
        }).catch((error: unknown) => {
          console.warn('[plane] human enqueue failed', { paneId, detail: String(error) })
          return 'full' as const
        }).then(outcome => {
          if (outcome === 'full') {
            queues.set(paneId, [head, ...(queues.get(paneId) ?? [])])
          }
          humanDirectDrainInFlightRef.current.delete(paneId)
          if (outcome === 'duplicate' || outcome === 'enqueued') {
            setHumanSendFifoTick(n => n + 1)
          }
        })
        return
      }
      case 'prefer_send': {
        persistQueue(result.queue)
        const { head } = result
        let placed = false
        updatePlaneSendByPane(prev => {
          const claim = claimPlaneSendSlot(prev, paneId, head)
          placed = claim.claimed
          return claim.slots
        })
        if (!placed) {
          queues.set(paneId, [head, ...(queues.get(paneId) ?? [])])
          setHumanSendFifoTick(n => n + 1)
        }
        return
      }
      default:
        return
    }
  }, [planeSendByPane])

  // Drena FIFO de envíos humanos del chat central: no salta por busy/loop.
  useEffect(() => {
    const queues = humanSendFifoByPaneRef.current
    for (const paneId of [...queues.keys()]) {
      applyHumanSendFifoDrainForPane(paneId)
    }
  }, [agentPlaneStatus, humanSendFifoTick, planeSendByPane, applyHumanSendFifoDrainForPane])

  /**
   * Red de seguridad de las colas en tránsito: mientras el FIFO humano, el de
   * orquestación o un slot preferSend tengan trabajo pendiente, reintenta el
   * drenaje cada 600ms. Los drenajes normales dependen de wake-ups (status del
   * pane, ticks, cambios de estado); si un eslabón pierde el suyo (update
   * dedupeado, prop derivada de un ref sin re-render), el mensaje quedaba "en
   * cola" hasta un evento externo — p. ej. minimizar/restaurar la app.
   */
  useEffect(() => {
    const hasTransitWork = humanSendFifoByPaneRef.current.size > 0
      || orchestrationFifoByPaneRef.current.size > 0
      || Object.keys(planeSendByPane).length > 0
    if (!hasTransitWork) return
    const timer = window.setTimeout(() => {
      setHumanSendFifoTick(n => n + 1)
      setOrchestrationFifoTick(n => n + 1)
    }, 600)
    return () => window.clearTimeout(timer)
  }, [agentPlaneStatus, humanSendFifoTick, orchestrationFifoTick, planeSendByPane])

  const loadComposerPromptHistory = useCallback(async (
    paneId: string,
    threadId: string | null,
  ): Promise<string[]> => {
    if (!threadId?.trim()) return []
    const tab = tabsRef.current.find(item => (
      Boolean(item.agentByPane?.[paneId]) || (item.paneIds ?? []).includes(paneId)
    ))
    const agentId = tab?.agentByPane?.[paneId]?.agentId?.trim()
    if (!tab || !agentId) return []
    const cwd = tab.projectFolder?.trim() ?? ''
    const slug = tab.orgWorkspace?.slug?.trim() ?? ''
    const workspaceId = tab.orgWorkspace?.workspaceId?.trim() ?? ''
    const ref = agentChatRefFor(
      {
        projectFolder: cwd,
        ...(slug && workspaceId
          ? { orgWorkspace: { slug, workspaceId } }
          : {}),
      },
      agentId,
      paneId,
    )
    try {
      const entries = await window.api.loadAgentChat(ref, threadId)
      return composerHistoryFromEntries(entries)
    } catch {
      return []
    }
  }, [])

  const handlePlaneRemoveQueuedTurn = useCallback((paneId: string, id: string) => {
    const target = agentPlaneStatusRef.current[paneId]?.queuedTurns?.find(item => item.id === id)
    planeQueueControlsByPaneRef.current.get(paneId)?.remove(id)
    if (!target || !isHumanQueuedTurn(target)) return
    updatePlaneSendByPane(prev => {
      const pending = prev[paneId]
      if (!pending || !isHumanQueuedTurn(pending)) return prev
      if (!shouldClearPlaneSendForRemovedQueuedTurn(target, pending.sendId)) {
        return prev
      }
      const next = { ...prev }
      delete next[paneId]
      return next
    })
  }, [])

  const handlePlaneUpdateQueuedTurn = useCallback((paneId: string, id: string, text: string) => {
    planeQueueControlsByPaneRef.current.get(paneId)?.update(id, text)
  }, [])

  const handlePlaneMergeQueuedTurns = useCallback((paneId: string) => {
    setAgentPlaneStatus(prev => {
      const cur = prev[paneId]
      if (!cur?.queuedTurns || cur.queuedTurns.length < 2) return prev
      const nextQueue = mergeQueuedTurns(cur.queuedTurns)
      if (nextQueue === cur.queuedTurns) return prev
      return { ...prev, [paneId]: { ...cur, queuedTurns: nextQueue } }
    })
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
    // Mantener cliSessionId en vivo (local y org): sin él Cursor/Claude no
    // hacen --resume y cada turno arranca en frío. Org solo se limpia al
    // persistir (buildSessionSnapshot → stripOrgTabAgentCliSessionIds).
    // Carriles vivos del pane: no pueden caer en la poda del tope de threads.
    const liveThreadIds = new Set(
      agentPlaneStatusRef.current[paneId]?.runningThreadIds ?? [],
    )
    const binding = agentBindingFromMeta({ ...next, id: nextId }, liveThreadIds)
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
      // Updater, no snapshot: un setTabs por valor descartaría lo que quedó en
      // la cola (p. ej. el planeOpenChatAgentId que la card acaba de pedir).
      const apply = (prev: TabSession[]): TabSession[] => {
        const base = catalogKey && fromId !== toId
          ? remapAgentBindingsInTabs(prev, catalogKey, fromId, toId)
          : prev
        return base.map(item => {
          if (item.id !== tabId) return item
          return {
            ...item,
            agentByPane: {
              ...(item.agentByPane ?? {}),
              [paneId]: { ...paneBinding, agentId: toId },
            },
          }
        })
      }
      tabsRef.current = apply(tabsRef.current)
      setTabs(apply)
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
      const previousBinding = agentBindingFromMeta({ ...previous, id: previousId }, liveThreadIds)
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
    const entry = findOrgWorkspaceCatalogEntry(
      orgCatalogForTab(orgWorkspaceCatalogMapRef.current, tab, accountIdForCwd),
      slug,
      workspaceId,
    )
    return entry?.canRename === true
  }, [accountIdForCwd])

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

    const covenant = getCovenantApi(orgAccountIdForTab(tab, accountIdForCwd))
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
      const accountId = orgAccountIdForTab(tab, accountIdForCwd)
      const currentCat = orgCatalogForTab(orgWorkspaceCatalogMapRef.current, tab, accountIdForCwd)
      const patched = patchOrgWorkspaceCatalogName(
        currentCat,
        slug,
        workspaceId,
        canonical,
        true,
      )
      if (patched && patched !== currentCat) {
        applyOrgWorkspaceCatalogForAccount(accountId, patched)
        void persistOrgWorkspaceCatalogCache(orgWorkspaceCatalogMapRef.current)
      }
    })()
  }, [accountIdForCwd, applyOrgWorkspaceCatalogForAccount, canRenameTab, persistOrgWorkspaceCatalogCache, t])

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

  const handleMusicPausedChange = useCallback((paused: boolean) => {
    setConfig(prev => {
      if (prev.musicPaused === paused) return prev
      window.api.setConfig({ musicPaused: paused })
      return { ...prev, musicPaused: paused }
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

      // ⌘Y / Ctrl+Y y ⌘J (macOS, convención VS Code/Cursor): nueva terminal en la pestaña activa
      if (isNewTerminalShortcut(e)) {
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
        if (!tab) return
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
        if (!tab) return
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
          onProjectAgentSaved={agent => rememberProjectAgent(paneCatalogKey, agent)}
          tabActive={tab.id === activeTabId}
          isActivePane={tab.id === activeTabId && tab.activePaneId === paneId}
          windowOpen={Boolean(tab.paneWindows?.[paneId]?.open)}
          awaitingDelegations={awaitingDelegationPaneIds.has(paneId)}
          awaitingDelegationThreadIds={
            awaitingDelegationThreadIdsByPane.get(paneId) ?? NO_THREAD_IDS
          }
          awaitingDelegationLegacyFallback={
            awaitingDelegationLegacyFallbackPaneIds.has(paneId)
          }
          delegationWorkLegacyFallback={
            delegationWorkLegacyFallbackPaneIds.has(paneId)
          }
          orchestrationWorkStyle={orchestrationWorkStyleForPane(paneId, tab.id)}
          orchestrationAwaiting={orchestrationAwaitingByPane.get(paneId) ?? null}
          delegationWorkActive={delegationTargetPaneIds.has(paneId)}
          delegationThreadIds={delegationThreadIdsByPane.get(paneId) ?? NO_THREAD_IDS}
          systemFollowUpsPending={isSystemFollowUpsPendingForPane(
            orchestrationFifoByPaneRef.current.get(paneId)?.length ?? 0,
            preferSendSlotIsSystemWork(planeSendByPane[paneId]),
          )}
          onMetaChange={meta => handleAgentMetaChange(tab.id, paneId, meta)}
          onRequestPaneFocus={() => handleFocusPaneWindow(tab.id, paneId)}
          onClosePane={() => handleClosePane(tab.id, paneId)}
          onBusyChange={busy => handleBusyChange(paneId, busy)}
          onPlaneStatusChange={status => handleAgentPlaneStatusChange(paneId, status)}
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
                provider: peerMeta.provider,
                monogram: peerMeta.monogram?.trim() || undefined,
              }
            })}
          onOrchestratorDelegations={(delegations, orchestrationJobId, warnings) => {
            handleOrchestratorDelegations(paneId, tab.id, delegations, orchestrationJobId, warnings)
          }}
          onOrchestratorStop={() => handleOrchestratorStop(paneId)}
          onAbortDelegation={delegationId => {
            void abortSingleDelegation(paneId, delegationId)
          }}
          onInsertCommand={cmd => handleInsertCommandInTerminal(tab.id, cmd)}
          onDelegationTurnComplete={handleDelegationTurnComplete}
          onOrchestrationUserTurn={() => beginOrchestrationUserTurn(paneId)}
          getOrchestrationRound={() => {
            const activeId = activeOrchestrationJobByPaneRef.current.get(paneId)
            const jobs = orchestrationJobsByPaneRef.current.get(paneId)
            const job = activeId ? jobs?.get(activeId) : undefined
            const workStyle = orchestrationWorkStyleForPane(paneId, tab.id)
            const inflightDelegations = [...delegationRuntimeByIdRef.current.values()].filter(
              entry => entry.fromPaneId === paneId
                && (entry.status === 'pending' || entry.status === 'awaiting_merge'),
            )
            return {
              round: job?.round ?? 0,
              maxRounds: orchestrationMaxRoundsForPane(paneId, tab.id),
              ...(job ? { jobId: job.jobId } : {}),
              workStyle,
              ...(inflightDelegations.length ? { inflightDelegations } : {}),
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
          onPreferSendConsumed={(consumedSendId?: string) => {
            const sendId = consumedSendId?.trim()
              || planeSendByPaneRef.current[paneId]?.sendId?.trim()
            // Por identidad: si mientras tanto entró otro envío al buzón, este
            // consumo no debe tirarlo. Antes se borraba a ciegas, y para
            // taparlo el pane soltaba una sola vez por sendId — que es lo que
            // dejaba el buzón tomado si el mismo envío se ofrecía dos veces.
            updatePlaneSendByPane(current => releasePlaneSendSlot(current, paneId, sendId))
            if (!sendId) return
            const fifo = humanSendFifoByPaneRef.current.get(paneId)
            if (!fifo?.length) return
            const { queue, removed } = purgeFifoBySendId(fifo, sendId)
            for (const item of removed) {
              for (const image of item.images) {
                const previewUrl = (image as { previewUrl?: string }).previewUrl
                if (previewUrl) URL.revokeObjectURL(previewUrl)
              }
            }
            if (queue.length) {
              humanSendFifoByPaneRef.current.set(paneId, queue)
            } else {
              humanSendFifoByPaneRef.current.delete(paneId)
            }
            if (removed.length) {
              setHumanSendFifoTick(n => n + 1)
            }
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
          preferNewThread={planeNewThreadPaneId === paneId}
          onPreferNewThreadConsumed={() => {
            setPlaneNewThreadPaneId(current => (current === paneId ? null : current))
          }}
          registerShortcutCloseInterceptor={registerClose}
          onThreadClosed={threadId => handleHumanSendThreadClosed(paneId, threadId)}
          fontSize={config.fontSize ?? 13}
          systemSoundsEnabled={config.systemSoundsEnabled !== false}
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
          if (ref) {
            termRefs.current.set(paneId, ref)
            const pending = pendingTerminalInsertRef.current
            if (pending?.tabId === tab.id) {
              pendingTerminalInsertRef.current = null
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  ref.writeToTty(pending.payload)
                })
              })
            }
          } else {
            termRefs.current.delete(paneId)
          }
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

  /** cwd de Ajustes: la misma búsqueda que ya usa el resto del archivo para "el cwd de esta pestaña". */
  const activeTab = tabs.find(t => t.id === activeTabId)
  const settingsCwd = activeTab?.projectFolder?.trim() || activeTab?.orgWorkspace?.localDir?.trim() || ''
  const ready = configReady && sessionReady.loaded
  const incomplete = isOnboardingIncomplete(config.onboardingCompletedVersion)
  const onboardingActive = isOnboardingActive({ incomplete, tabs })
  const chromeLocked = onboardingActive && ready
  const guideLocked = isOnboardingGuideActive({ incomplete }) && ready
  const composerSendBlockForTab = (tab: TabSession) => resolveComposerSendBlock({
    incomplete: guideLocked,
    path: config.orchestratorPath,
    cliAllMissing: onboardingClisMissing,
    engineMissing: composerEngineMissingForTab(
      {
        planeOpenChatAgentId: tab.planeOpenChatAgentId ?? null,
        paneKinds: tab.paneKinds,
      },
      paneId => resolveTabAgentMeta(tab, paneId, projectAgentsByCwd).provider,
    ),
  })
  const chrome = onboardingChromeHidden({ incomplete: incomplete && ready, path: config.orchestratorPath })

  const surfaceForTab = (tab: TabSession) => onboardingLockedSurface({
    incomplete: onboardingActive,
    path: config.orchestratorPath,
    hasFolder: Boolean(tab.projectFolder?.trim()),
    hasAgents: Object.values(tab.paneKinds ?? {}).some(kind => kind === 'agent'),
    cliAllMissing: clisAllMissing(onboardingClis),
  })

  const guideArgsForTab = (tab: TabSession) => {
    const draft = brainstormSetupDraftByTab[tab.id]
    const rooms = brainstormRoomsByTab[tab.id] ?? []
    return buildGuideResolveArgs({
      incomplete: guideLocked,
      path: config.orchestratorPath,
      projectFolder: tab.projectFolder,
      paneKinds: tab.paneKinds,
      planeOpenChatAgentId: tab.planeOpenChatAgentId ?? null,
      brainstormView: brainstormViewByTab[tab.id] ?? null,
      brainstormDraft: draft,
      brainstormRooms: rooms,
      liveRoomIds: rooms
        .filter(room => isBrainstormLive(
          (brainstormLiveByRoomId[room.id] ?? createBrainstormLiveSummary(room)).status,
        ))
        .map(room => room.id),
      humanSpokeByRoom: brainstormHumanSpokeByRoom,
      sentFirstMessage: Boolean(config.onboardingSentFirstMessage),
      assignedAnyContext: Boolean(config.onboardingAssignedContext),
      doneSteps: config.onboardingGuideDone ?? [],
    })
  }

  const resolveGuideStepForTab = (tab: TabSession): OnboardingGuideStep | null => {
    if (!guideLocked) return null
    return resolveOnboardingGuideStep(guideArgsForTab(tab))
  }

  useEffect(() => {
    if (!ready) return
    if (!shouldAutoCompleteFromPanes({
      incomplete,
      path: config.orchestratorPath,
      tabs,
    })) return
    persistOnboardingCompleted(ONBOARDING_VERSION)
  }, [ready, incomplete, config.orchestratorPath, tabs, persistOnboardingCompleted])

  useEffect(() => {
    if (!guideLocked || !activeTab) return
    if (shouldCompleteByGuideExhausted({
      resolveArgs: guideArgsForTab(activeTab),
      cliAllMissing: clisAllMissing(onboardingClis),
    })) {
      persistOnboardingCompleted(ONBOARDING_VERSION)
    }
  }, [
    guideLocked,
    activeTab,
    config.orchestratorPath,
    config.onboardingSentFirstMessage,
    config.onboardingAssignedContext,
    config.onboardingGuideDone,
    onboardingClis,
    persistOnboardingCompleted,
    brainstormViewByTab,
    brainstormSetupDraftByTab,
    brainstormRoomsByTab,
    brainstormLiveByRoomId,
    brainstormHumanSpokeByRoom,
  ])

  /**
   * Salas de una pestaña sobre su plano. Van montadas dentro de
   * `.tab-agentic-plane` —igual que el mapa de la wiki— porque se posicionan
   * contra él; el estado sigue aquí arriba, que es donde ya vivía.
   *
   * Cada sala se queda montada mientras exista, mirándose o no: así el runner
   * sigue llenando su acta y volver a ella no reinicia nada. `open` es solo
   * visibilidad.
   */
  const renderBrainstormOverlays = (tab: TabSession): React.ReactNode => {
    const catalogKey = tabAgentCatalogKey(tab)
    const catalog = filterBrainstormInvitableAgents(projectAgentsByCwd[catalogKey] ?? [])
    const rooms = brainstormRoomsByTab[tab.id] ?? []
    const view = brainstormViewByTab[tab.id] ?? null
    const liveRooms = rooms
      .map(room => brainstormLiveByRoomId[room.id] ?? createBrainstormLiveSummary(room))
      .filter(summary => isBrainstormLive(summary.status))

    /** Quién tiene asiento en otra sala viva: se avisa, no se bloquea. */
    const roomsByAgent = (exceptRoomId: string): Record<string, string[]> => {
      const map: Record<string, string[]> = {}
      liveRooms.forEach(summary => {
        if (summary.roomId === exceptRoomId) return
        summary.participantAgentIds.forEach(agentId => {
          map[agentId] = [...(map[agentId] ?? []), summary.topic]
        })
      })
      return map
    }

    const setView = (next: 'rooms' | 'setup' | string | null): void => {
      setBrainstormViewByTab(prev => ({ ...prev, [tab.id]: next }))
    }

    /** Abrir una sala guardada: se monta y se mira, sin salir del módulo. */
    const openSavedRoom = (room: BrainstormRoom): void => {
      setBrainstormRoomsByTab(prev => {
        const current = prev[tab.id] ?? []
        return current.some(item => item.id === room.id)
          ? prev
          : { ...prev, [tab.id]: [...current, room] }
      })
      setView(room.id)
    }

    return (
      <>
        {/* Biblioteca: la vista por la que se entra cuando ya hay actas. */}
        <BrainstormRoomsView
          open={view === 'rooms'}
          active={activeTabId === tab.id}
          cwd={tab.projectFolder ?? ''}
          agents={projectAgentsByCwd[catalogKey] ?? []}
          contexts={tabContextsByTab[tab.id] ?? []}
          onClose={() => setView(null)}
          onCreate={() => setView('setup')}
          onOpenRoom={openSavedRoom}
          onContextSaved={() => { void refreshTabContexts(tab.id) }}
          onAssignContext={(agentId, contextId) => {
            handleAssignContextToCatalogAgent(catalogKey, agentId, contextId)
          }}
        />
        <BrainstormStartModal
          open={view === 'setup'}
          active={activeTabId === tab.id}
          cwd={tab.projectFolder ?? ''}
          agents={catalog}
          agentsInLiveRooms={roomsByAgent('')}
          contexts={tabContextsByTab[tab.id] ?? []}
          savedRoomsCount={brainstormSavedCountByTab[tab.id] ?? 0}
          onClose={() => setView(null)}
          onOpenRooms={() => setView('rooms')}
          onCreateAgent={() => requestAddAgent(tab.id, undefined)}
          onAssignContext={(agentId, contextId) => {
            handleAssignContextToCatalogAgent(catalogKey, agentId, contextId)
          }}
          onDraftChange={draft => {
            setBrainstormSetupDraftByTab(prev => ({ ...prev, [tab.id]: draft }))
          }}
          onStarted={room => {
            setBrainstormRoomsByTab(prev => ({
              ...prev,
              [tab.id]: [...(prev[tab.id] ?? []), room],
            }))
            setView(room.id)
          }}
        />
        {rooms.map(room => (
          <BrainstormRoomView
            key={room.id}
            open={view === room.id}
            active={activeTabId === tab.id}
            room={room}
            cwd={tab.projectFolder ?? ''}
            agents={catalog}
            liveRooms={liveRooms.map(summary => ({
              roomId: summary.roomId,
              topic: summary.topic,
            }))}
            onSwitchRoom={roomId => setView(roomId)}
            agentsInOtherRooms={roomsByAgent(room.id)}
            contexts={tabContextsByTab[tab.id] ?? []}
            onAssignContext={(agentId, contextId) => {
              handleAssignContextToCatalogAgent(catalogKey, agentId, contextId)
            }}
            onHumanSpoke={() => {
              setBrainstormHumanSpokeByRoom(prev => ({ ...prev, [room.id]: true }))
            }}
            onClose={() => {
              // Cerrar la vista, no la sala: el runner sigue en main y el botón
              // de la barra mantiene su cuenta.
              setView(null)
            }}
            onFinish={() => {
              // Terminada y soltada: el acta ya está en disco y se busca en
              // «Salas guardadas», así que sale también del flyout.
              setBrainstormRoomsByTab(prev => ({
                ...prev,
                [tab.id]: (prev[tab.id] ?? []).filter(item => item.id !== room.id),
              }))
              setBrainstormLiveByRoomId(prev => {
                const next = { ...prev }
                delete next[room.id]
                return next
              })
              // Al soltarla, la biblioteca es el sitio donde queda su acta.
              setView('rooms')
            }}
            onLive={summary => {
              setBrainstormLiveByRoomId(prev => ({ ...prev, [summary.roomId]: summary }))
            }}
            onContextSaved={() => { void refreshTabContexts(tab.id) }}
          />
        ))}
      </>
    )
  }

  return (
    <div className="app-root">
      {/* ── Title bar (macOS traffic lights live here) ── */}
      <Titlebar
        config={config}
        configReady={configReady}
        fontSize={config.fontSize ?? 13}
        fontSizeMin={MIN_FONT}
        fontSizeMax={MAX_FONT}
        themePickerOpen={themePickerOpen}
        onFontIncrease={() => changeFontSize(1)}
        onFontDecrease={() => changeFontSize(-1)}
        onOpenThemePicker={() => setThemePickerOpen(true)}
        onOpenOrganizations={() => setOrgModalOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onMusicPausedChange={handleMusicPausedChange}
        hideOrganizations={chrome.hideOrganizations}
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
        tabActivityDots={tabActivityDots}
        canRenameTab={canRenameTab}
        hideAdd={chrome.hideTabAdd}
      />

      {/* ── Main area ── */}
      <div className="main-area">
        <div className="terminals-container">
          {configReady && sessionReady.loaded && tabs.map(tab => {
            const s = surfaceForTab(tab)
            const sendBlock = composerSendBlockForTab(tab)
            const discoveredContexts = tabContextsByTab[tab.id] ?? []
            const tabContextBadges = discoveredContexts.map(ctx => ({
              id: ctx.id,
              name: ctx.name,
              kind: ctx.kind,
              kindLabel: t(`tabContexts.kind_${ctx.kind}`),
              icon: contextIconName(ctx),
              color: resolveContextColor(ctx),
            }))

            const agentCatalogKey = tabAgentCatalogKey(tab)
            const tabProjectAgents = projectAgentsByCwd[agentCatalogKey] ?? []

            const contextUsage = new Map<string, number>()
            for (const paneId of tab.paneIds) {
              if (tab.paneKinds?.[paneId] !== 'agent') continue
              const resolved = resolveTabAgentMeta(tab, paneId, projectAgentsByCwd)
              for (const contextId of resolved.contextIds ?? []) {
                contextUsage.set(contextId, (contextUsage.get(contextId) ?? 0) + 1)
              }
            }

            const runningThreadIdsByPane = new Map<string, Set<string>>()
            for (const jobsMap of orchestrationJobsByPaneRef.current.values()) {
              for (const job of jobsMap.values()) {
                for (const meta of job.pending.values()) {
                  if (!meta.toThreadId) continue
                  let set = runningThreadIdsByPane.get(meta.toPaneId)
                  if (!set) {
                    set = new Set()
                    runningThreadIdsByPane.set(meta.toPaneId, set)
                  }
                  set.add(meta.toThreadId)
                }
              }
            }
            mergePaneReportedRunningThreadIds(runningThreadIdsByPane, agentPlaneStatus)

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
                const awaitingDelegations = awaitingDelegationPaneIds.has(paneId)
                const visuallyBusy = busyPanes.has(paneId) || delegationWorkActive
                const assignedIds = meta?.contextIds ?? []
                const assignedContexts = resolveAssignedContextChips(
                  assignedIds,
                  discoveredContexts,
                  contextUsage,
                  contextKind => t(`tabContexts.kind_${contextKind}`),
                  tabProjectAgents,
                )
                const binding = tab.agentByPane?.[paneId]
                const threadState = binding ? threadStateOf(binding) : null
                const userPromptSnippet = (() => {
                  const activeId = threadState?.activeThreadId
                  const fromRunning = activeId
                    ? status?.runningThreadActivities?.[activeId]?.trim()
                    : ''
                  if (fromRunning) return fromRunning
                  // Lo calcula el pane al publicar (`lastUserSnippet`): antes se
                  // escaneaba la transcripción entera aquí, por pane y en cada
                  // render del plano.
                  return status?.lastUserSnippet ?? ''
                })()
                return {
                  paneId,
                  kind,
                  title,
                  monogram: meta?.monogram,
                  busy: visuallyBusy,
                  awaitingDelegations,
                  provider: meta?.provider ?? 'claude',
                  model: meta?.model,
                  coordination: (meta?.coordination === 'orchestrator'
                    || meta?.coordination === 'productOwner'
                    ? meta.coordination
                    : 'none') as 'none' | 'orchestrator' | 'productOwner',
                  orchestrationWorkStyle: meta?.coordination === 'orchestrator'
                    ? (status?.orchestrationWorkStyle === 'turbo' ? 'turbo' : 'linear')
                    : undefined,
                  snippet: userPromptSnippet
                    || (delegationWorkActive ? t('agentPane.awaitingStatusRunning') : '')
                    || (awaitingDelegations ? t('agentPane.delegatingTitle') : '')
                    || '',
                  agentId: meta?.id,
                  localOnly: meta?.localOnly === true,
                  delegationWorkActive,
                  contextIds: assignedIds,
                  contexts: assignedContexts,
                  // El listado de la card se arma desde lo que corre, no desde
                  // lo que el catálogo alcanzó a registrar: una delegación se
                  // despacha con su threadId antes de que el pane abra el
                  // carril, y mapear solo el catálogo dejaba esos hilos activos
                  // sin fila (la card se quedaba con el snippet, sin señal).
                  threads: mergePlaneMiniThreadRows(
                    buildDelegationMiniNodes(
                      orchestrationAwaitingByPane.get(paneId),
                      {
                        delegatingTitle: t('agentPane.delegatingTitle'),
                        waveProgress: (done, total) => t('agentPane.awaitingWaveProgress', {
                          done,
                          total,
                        }),
                      },
                    ),
                    buildPlaneThreadNodes(
                      threadState?.threads ?? [],
                      runningThreadIdsByPane.get(paneId),
                      status?.runningThreadActivities,
                    ),
                  ).map(node => ({
                    id: node.id,
                    title: node.title,
                    running: node.running,
                    activity: node.activity,
                    kind: node.kind,
                    dotVariant: node.dotVariant,
                  })),
                  activeThreadId: threadState?.activeThreadId,
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

            const planeEntities = entities

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
                  const orgWorkspaceLocalDir = tab.orgWorkspace?.localDir?.trim() || ''
                  // cwd efectivo del plano: coincide con el que consumen las
                  // acciones (nuevo agente, nueva terminal, bootstrap) cuando
                  // el workspace es org-backed y aún no hay projectFolder set.
                  const effectiveCwd = projectCwd || orgWorkspaceLocalDir
                  const catalogEmpty = tabProjectAgents.length === 0
                  const noAgentPanes = !(tab.paneIds ?? []).some(
                    paneId => tab.paneKinds?.[paneId] === 'agent',
                  )
                  const showBootstrapAgents = catalogEmpty && noAgentPanes
                  const orgBacked = Boolean(
                    tab.orgWorkspace?.slug?.trim() && tab.orgWorkspace?.workspaceId?.trim(),
                  )
                  const canCreatePane = Boolean(effectiveCwd) || orgBacked
                  const canBootstrapAgents = showBootstrapAgents && canCreatePane
                  const openChatBinding = tab.planeOpenChatAgentId
                    ? tab.agentByPane?.[tab.planeOpenChatAgentId]
                    : undefined
                  const openChatThreadState = openChatBinding
                    ? threadStateOf(openChatBinding)
                    : null
                  return (
                      <div className="tab-terminal-group__main">
                <TabAgenticPlane
                  emptyTitle={t('tabs.planeEmptyTitle')}
                  emptyHint={t('tabs.planeEmptyHint')}
                  tabActive={tab.id === activeTabId}
                  // Siempre el mismo callback: PlaneMap filtra con tabActive.
                  // Así al cambiar de tab en boot el effect se reengancha sin
                  // depender de undefined→fn (evita splash colgado 12s).
                  onFirstLayoutReady={handlePlaneFirstLayoutReady}
                  deferPositionMotion={splashLayoutPending}
                  onWikiMutated={
                    orgBacked && effectiveCwd
                      ? (cwd: string) => {
                          const slug = tab.orgWorkspace?.slug?.trim() ?? ''
                          const workspaceId = tab.orgWorkspace?.workspaceId?.trim() ?? ''
                          if (slug && workspaceId) void pushOrgWikiForScope(slug, workspaceId, cwd)
                        }
                      : undefined
                  }
                  /* La etiqueta siempre nombra la acción; el motivo de bloqueo
                     va al tooltip, no dentro de la píldora. */
                  appOverlayOpen={orgModalOpen}
                  agentFabTitle={t('tabs.fabAgent')}
                  terminalFabTitle={t('tabs.fabTerminal')}
                  agentFabHint={t('tabs.fabAgentHint')}
                  terminalFabHint={t('tabs.fabTerminalHint')}
                  agentFabDisabledTitle={t('agentPane.projectFolderRequired')}
                  terminalFabDisabledTitle={t('agentPane.projectFolderRequired')}
                  idleAgentLabel={t('tabs.planeIdleAgent')}
                  contextPoolTitle={t('tabs.planeContextPoolTitle')}
                  contextPoolConfigureLabel={t('tabContexts.manage')}
                  contextPoolCreateLabel={t('tabContexts.createTitle')}
                  contextPoolAddFileLabel={t('tabContexts.newFile')}
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
                  chatPlaceholder={t('tabs.planeChatPlaceholder')}
                  chatEmptyAgents={t('tabs.planeChatEmptyAgents')}
                  chatSendLabel={t('tabs.planeChatSend')}
                  gitRepos={gitReposByTab[tab.id] ?? []}
                  onOpenRepoGit={(repoPath: string) => openTabGitModal(tab.id, repoPath)}
                  onRefreshRepos={() => { void refreshPlaneGitRepos() }}
                  tabContexts={tabContextBadges}
                  contextCatalog={discoveredContexts}
                  onContextSaved={() => { void refreshTabContexts(tab.id) }}
                  onLoadPromptHistory={loadComposerPromptHistory}
                  onToggleAgentContext={(paneId, contextId) => {
                    handleToggleAgentContext(tab.id, paneId, contextId)
                  }}
                  onRemoveQueuedTurn={handlePlaneRemoveQueuedTurn}
                  onUpdateQueuedTurn={handlePlaneUpdateQueuedTurn}
                  onMergeQueuedTurns={handlePlaneMergeQueuedTurns}
                  canAdd={true}
                  canAddAgent={canCreatePane}
                  canAddTerminal={canCreatePane}
                  bootstrapAgentsLabel={t('tabs.bootstrapAgents')}
                  bootstrapAgentsTitle={t('tabs.bootstrapAgentsTitle')}
                  bootstrapAgentsHint={t('tabs.bootstrapAgentsHint')}
                  bootstrapAgentsDisabledTitle={t('tabs.bootstrapAgentsNeedFolder')}
                  showBootstrapAgents={showBootstrapAgents}
                  canBootstrapAgents={canBootstrapAgents}
                  onBootstrapAgents={() => {
                    void bootstrapProjectAgents(tab.id).then(bootstrapped => {
                      if (!bootstrapped) return
                      const tabNow = tabsRef.current.find(item => item.id === tab.id)
                      const hasAgents = tabNow
                        ? Object.values(tabNow.paneKinds ?? {}).some(kind => kind === 'agent')
                        : false
                      if (onboardingLockedSurface({
                        incomplete: onboardingActive,
                        path: config.orchestratorPath,
                        hasFolder: Boolean(tab.projectFolder?.trim()),
                        hasAgents,
                        cliAllMissing: clisAllMissing(onboardingClis),
                      }).autoOpenCeremonyOverlay) {
                        setBrainstormViewByTab(prev => ({ ...prev, [tab.id]: 'setup' }))
                      }
                    })
                  }}
                  activePaneId={tab.activePaneId}
                  entities={planeEntities}
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
                  onAddFileContext={() => { void handleAddFileContextFromPlane(tab.id) }}
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
                  newThreadPendingPaneId={planeNewThreadPaneId}
                  queueFullNotice={planeQueueFullNotice}
                  onQueueFullNoticeDismiss={() => setPlaneQueueFullNotice(null)}
                  onOpenChatAgentChange={paneId => handlePlaneOpenChatAgent(tab.id, paneId)}
                  onSendChat={(paneId, text, images, contextIds) => {
                    const binding = tab.agentByPane?.[paneId]
                    const activeThreadId = binding
                      ? (threadStateOf(binding).activeThreadId ?? DEFAULT_THREAD_ID)
                      : DEFAULT_THREAD_ID
                    const sendItem = {
                      text,
                      images,
                      // Identidad del envío: el pane lo consume una sola vez
                      // aunque el slot se re-ofrezca mientras convierte imágenes.
                      sendId: crypto.randomUUID(),
                      focusPane: true as const,
                      ...(contextIds.length ? { extraContextIds: contextIds } : {}),
                      threadId: activeThreadId,
                    }
                    const queue = humanSendFifoByPaneRef.current.get(paneId) ?? []
                    const { queue: nextQueue, dropped } = enqueueHumanSendForThread(
                      queue,
                      sendItem,
                      activeThreadId,
                    )
                    if (dropped) {
                      console.warn('[plane] human send dropped', { paneId, reason: 'human_fifo_full' })
                      setPlaneQueueFullNotice({ paneId, text, at: Date.now() })
                      for (const image of images) {
                        const previewUrl = (image as { previewUrl?: string }).previewUrl
                        if (previewUrl) URL.revokeObjectURL(previewUrl)
                      }
                    } else {
                      humanSendFifoByPaneRef.current.set(paneId, nextQueue)
                      const controls = planeQueueControlsByPaneRef.current.get(paneId)
                      const planeStatus = agentPlaneStatusRef.current[paneId]
                      const visibleQueued = countQueuedTurnsForThread(
                        planeStatus?.queuedTurns ?? [],
                        activeThreadId,
                      )
                      const workStyle = orchestrationWorkStyleForPane(paneId, tab.id)
                      // Gates por hilo: una ola/delegación en otro hilo no debe
                      // promover este envío a chip si su hilo está libre.
                      const shouldPromote = shouldPromoteHumanSendToVisibleQueue({
                        busy: computeBusyForGate(
                          planeStatus?.busy === true,
                          planeStatus?.runningThreadIds ?? [],
                          activeThreadId,
                        ),
                        awaitingDelegations: threadScopedFlag(
                          planeStatus?.awaitingDelegations ?? awaitingDelegationPaneIds.has(paneId),
                          awaitingDelegationThreadIdsByPane.get(paneId),
                          activeThreadId,
                          awaitingDelegationLegacyFallbackPaneIds.has(paneId),
                        ),
                        delegationWorkActive: threadScopedFlag(
                          planeStatus?.delegationWorkActive ?? delegationTargetPaneIds.has(paneId),
                          delegationThreadIdsByPane.get(paneId),
                          activeThreadId,
                          delegationWorkLegacyFallbackPaneIds.has(paneId),
                        ),
                        systemFollowUpsPending: isSystemFollowUpsPendingForPane(
                          orchestrationFifoByPaneRef.current.get(paneId)?.length ?? 0,
                          Boolean(planeSendByPane[paneId]),
                        ),
                      }, workStyle)
                      if (
                        shouldPromote
                        && controls
                        && visibleQueued < MAX_VISIBLE_QUEUED_TURNS
                      ) {
                        void controls.enqueueHuman({
                          text: sendItem.text,
                          images: sendItem.images,
                          sendId: sendItem.sendId,
                          ...(sendItem.extraContextIds?.length
                            ? { extraContextIds: sendItem.extraContextIds }
                            : {}),
                        }).then(outcome => {
                          if (outcome === 'enqueued' || outcome === 'duplicate') {
                            const fifo = humanSendFifoByPaneRef.current.get(paneId)
                            if (fifo) {
                              const trimmed = fifo.filter(item => item.sendId !== sendItem.sendId)
                              if (trimmed.length) {
                                humanSendFifoByPaneRef.current.set(paneId, trimmed)
                              } else {
                                humanSendFifoByPaneRef.current.delete(paneId)
                              }
                            }
                          }
                          if (outcome === 'enqueued' || outcome === 'duplicate' || outcome === 'full') {
                            setHumanSendFifoTick(n => n + 1)
                          }
                        })
                      } else {
                        applyHumanSendFifoDrainForPane(paneId)
                        setHumanSendFifoTick(n => n + 1)
                      }
                      // Una línea por envío aceptado: si en la cola aparecen N
                      // copias, aquí se ve si el chat mandó N o si se multiplicó
                      // más abajo (el pane loguea sus propios descartes).
                      console.warn('[plane] human send queued', {
                        paneId,
                        sendId: sendItem.sendId,
                        images: images.length,
                        fifo: nextQueue.length,
                      })
                      void (async () => {
                        const snapshot = tabsRef.current.find(t => t.id === tab.id) ?? tab
                        const shouldPersist = await evaluateOnboardingPlaneSendPersistGuard({
                          guideLocked,
                          cachedClis: onboardingClis,
                          refreshOnboardingClis,
                          orchestratorPath: config.orchestratorPath,
                          paneId,
                          paneKinds: snapshot.paneKinds,
                          resolveProvider: pid => resolveTabAgentMeta(
                            snapshot,
                            pid,
                            projectAgentsByCwdRef.current,
                          ).provider,
                        })
                        if (!shouldPersist) {
                          return
                        }
                        persistOnboardingSignals({ onboardingSentFirstMessage: true })
                      })()
                    }
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
                    const workStyle = orchestrationWorkStyleForPane(paneId, tab.id)
                    const hasAwaitingJobs = listJobsForPane(
                      orchestrationJobsByPaneRef.current,
                      paneId,
                    ).some(isJobAwaiting)
                    if (workStyle === 'turbo' && hasAwaitingJobs) {
                      abortOrchestrationRun(paneId)
                      return
                    }
                    requestPlaneStop(paneId)
                  }}
                  onAbortDelegation={(fromPaneId, delegationId) => {
                    void abortSingleDelegation(fromPaneId, delegationId)
                  }}
                  onInsertCommand={cmd => handleInsertCommandInTerminal(tab.id, cmd)}
                  onClearConversation={paneId => {
                    setPlaneClearPaneId(paneId)
                  }}
                  onNewThread={paneId => {
                    setPlaneNewThreadPaneId(paneId)
                  }}
                  onSelectThread={(paneId, threadId) => {
                    void handleAgentMetaChange(tab.id, paneId, previous => (
                      applyPlaneSelectThreadMeta(
                        previous,
                        paneId,
                        threadId,
                        Date.now(),
                        orchestrationJobsByPaneRef.current,
                      )
                    ))
                  }}
                  onOpenAgentFromCard={paneId => {
                    handlePlaneOpenChatAgent(tab.id, paneId)
                    const protectedIds = liveLaneThreadIdsForPane(
                      paneId,
                      orchestrationJobsByPaneRef.current,
                    )
                    void handleAgentMetaChange(tab.id, paneId, previous => {
                      const sanitized = sanitizeThreadState(
                        previous.threads,
                        previous.activeThreadId,
                        undefined,
                        protectedIds,
                      )
                      const threadId = resolvePreferredHumanThreadId(sanitized)
                      return {
                        ...previous,
                        ...threadPatch(selectThreadOpened(
                          sanitized,
                          threadId,
                          Date.now(),
                        )),
                      }
                    })
                  }}
                  onOpenAgentThread={(paneId, threadId) => {
                    handlePlaneOpenChatAgent(tab.id, paneId)
                    const protectedIds = liveLaneThreadIdsForPane(
                      paneId,
                      orchestrationJobsByPaneRef.current,
                    )
                    void handleAgentMetaChange(tab.id, paneId, previous => ({
                      ...previous,
                      ...threadPatch(selectThreadOpened(
                        sanitizeThreadState(
                          previous.threads,
                          previous.activeThreadId,
                          undefined,
                          protectedIds,
                        ),
                        threadId,
                        Date.now(),
                      )),
                    }))
                  }}
                  onRenameThread={(paneId, title) => {
                    const protectedIds = liveLaneThreadIdsForPane(
                      paneId,
                      orchestrationJobsByPaneRef.current,
                    )
                    void handleAgentMetaChange(tab.id, paneId, previous => {
                      const state = sanitizeThreadState(
                        previous.threads,
                        previous.activeThreadId,
                        undefined,
                        protectedIds,
                      )
                      return {
                        ...previous,
                        ...renameThread(state, state.activeThreadId, title),
                      }
                    })
                  }}
                  openChatThreads={openChatThreadState?.threads ?? []}
                  openChatRunningThreadIds={
                    tab.planeOpenChatAgentId
                      ? Array.from(runningThreadIdsByPane.get(tab.planeOpenChatAgentId) ?? [])
                      : []
                  }
                  openChatActiveThreadId={openChatThreadState?.activeThreadId ?? ''}
                  openChatOrchestrationAwaiting={
                    tab.planeOpenChatAgentId
                      ? orchestrationAwaitingByPane.get(tab.planeOpenChatAgentId) ?? null
                      : null
                  }
                  agentStatuses={agentPlaneStatus}
                  projectAgents={projectAgentsByCwd[agentCatalogKey] ?? []}
                  chatFontSize={config.fontSize ?? 13}
                  systemSoundsEnabled={config.systemSoundsEnabled !== false}
                  configLabel={t('agentPane.openConfig')}
                  deleteLabel={t('tabs.planeDeletePane')}
                  maximizeLabel={t('tabs.planeMaximize')}
                  restoreLabel={t('tabs.planeRestore')}
                  closeWindowLabel={t('tabs.planeHideWindow')}
                  projectFolder={tab.projectFolder ?? ''}
                  // Misma señal que ya recibe cada `AgentPane`: el chip jira de
                  // un mini relee su snapshot cuando los contextos se
                  // rematerializan, en vez de quedarse con el del montaje.
                  contextsRevision={contextsRevisionByCwd[tabAgentCatalogKey(tab)] ?? 0}
                  projectFolderSelectLabel={t('tabs.projectFolderSelect')}
                  projectFolderChangeLabel={t('tabs.projectFolderChange')}
                  projectFolderEmptyHint={t('tabs.projectFolderEmptyHint')}
                  projectFolderRevealLabel={t('fileExplorer.contextMenu.revealInFinder')}
                  onSelectProjectFolder={() => { void handlePickProjectFolder(tab.id) }}
                  onGithubAccountChanged={handleGithubAccountChanged}
                  onRevealProjectFolder={tab.projectFolder?.trim()
                    ? () => { window.api.openFolder(tab.projectFolder!.trim()) }
                    : undefined}
                  canResyncWorkspace={Boolean(
                    tab.orgWorkspace?.slug?.trim() && tab.orgWorkspace?.workspaceId?.trim(),
                  )}
                  resyncWorkspaceLabel={t('tabs.resyncWorkspaceButton')}
                  resyncWorkspaceBusy={resyncingWorkspaceTabs.has(tab.id) || uploadingWorkspaceTabs.has(tab.id)}
                  onResyncWorkspace={() => { setOrgSyncScopeTab(tab) }}
                  canUploadWorkspace={canUploadOrgWorkspaceFromCatalog(
                    orgCatalogForTab(orgWorkspaceCatalogMap, tab, accountIdForCwd),
                    tab.orgWorkspace?.slug?.trim() ?? '',
                    tab.orgWorkspace?.workspaceId?.trim() ?? '',
                  )}
                  uploadWorkspaceLabel={t('tabs.uploadWorkspaceButton')}
                  uploadWorkspaceBusy={uploadingWorkspaceTabs.has(tab.id) || resyncingWorkspaceTabs.has(tab.id)}
                  uploadWorkspaceProgress={
                    uploadingWorkspaceTabs.has(tab.id)
                      ? (workspaceUploadProgressByTab[tab.id] ?? 0)
                      : null
                  }
                  onCancelUploadWorkspace={cancelOrgWorkspaceSyncOrUpload}
                  onUploadWorkspace={() => { handleUploadOrgWorkspace(tab) }}
                  canPromoteWorkspace={Boolean(tab.projectFolder?.trim()) && !tab.orgWorkspace?.workspaceId?.trim()}
                  promoteWorkspaceLabel={t('tabs.promoteWorkspaceButton')}
                  promoteWorkspaceBusy={promoteWorkspaceBusy && promoteWorkspaceTab?.id === tab.id}
                  onPromoteWorkspace={() => { setPromoteWorkspaceTab(tab) }}
                  loopsOpen={Boolean(planeLoopsOpenByTab[tab.id])}
                  onLoopsOpenChange={open => {
                    setPlaneLoopsOpenByTab(prev => ({ ...prev, [tab.id]: open }))
                  }}
                  loopsButtonLabel={t('tabs.loopsButton')}
                  brainstormNeedFolderHint={t('tabs.brainstormNeedFolder')}
                  canOpenBrainstorm={Boolean(tab.projectFolder?.trim())}
                  brainstormView={brainstormViewByTab[tab.id] ?? null}
                  /* Con actas guardadas el módulo abre por la biblioteca; sin
                     ninguna, directo al alta: no hay nada que listar. */
                  brainstormSavedCount={brainstormSavedCountByTab[tab.id] ?? 0}
                  onBrainstormViewChange={next => {
                    setBrainstormViewByTab(prev => ({ ...prev, [tab.id]: next }))
                  }}
                  brainstormsListButtonLabel={t('tabs.brainstormsListButton')}
                  brainstormRooms={(brainstormRoomsByTab[tab.id] ?? []).map(
                    item => brainstormLiveByRoomId[item.id]
                      ?? createBrainstormLiveSummary(item),
                  )}
                  brainstormDockOpen={Boolean(brainstormDockOpenByTab[tab.id])}
                  onBrainstormDockOpenChange={open => {
                    setBrainstormDockOpenByTab(prev => ({ ...prev, [tab.id]: open }))
                  }}
                  onOpenBrainstormRoom={roomId => {
                    setBrainstormViewByTab(prev => ({ ...prev, [tab.id]: roomId }))
                    setBrainstormDockOpenByTab(prev => ({ ...prev, [tab.id]: false }))
                  }}
                  onStopBrainstormRoom={roomId => { window.api.stopBrainstorm(roomId) }}
                  onDiscardBrainstormRoom={roomId => {
                    setBrainstormRoomsByTab(prev => ({
                      ...prev,
                      [tab.id]: (prev[tab.id] ?? []).filter(item => item.id !== roomId),
                    }))
                    setBrainstormLiveByRoomId(prev => {
                      const next = { ...prev }
                      delete next[roomId]
                      return next
                    })
                    setBrainstormViewByTab(prev => (
                      prev[tab.id] === roomId ? { ...prev, [tab.id]: null } : prev
                    ))
                  }}
                  brainstormOverlayOpen={Boolean(brainstormViewByTab[tab.id])}
                  brainstormOverlays={renderBrainstormOverlays(tab)}
                  /* El catálogo entero: la ficha que no esté en pantalla no
                     tiene nodo y su arista simplemente no se dibuja. */
                  brainstormContextLinkAgents={(
                    projectAgentsByCwd[tabAgentCatalogKey(tab)] ?? []
                  ).map(agent => ({
                    paneId: agent.id,
                    contextIds: agent.contextIds ?? [],
                  }))}
                  loopChains={tab.planeLoopChains ?? []}
                  onLoopChainsChange={chains => handleLoopChainsChange(tab.id, chains)}
                  onStartLoopChain={chainId => handleStartLoopChain(tab.id, chainId)}
                  onStopLoopChain={chainId => handleStopLoopChain(tab.id, chainId)}
                  canStartLoopChains={Boolean(
                    tab.projectFolder?.trim() || tab.orgWorkspace?.localDir?.trim(),
                  )}
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
                  onboardingLocked={chromeLocked}
                  onboardingGuideStep={resolveGuideStepForTab(tab)}
                  onboardingGuideDismissLabel={t('tabs.onboardingGuide.dismiss')}
                  onOnboardingGuideDismiss={step => {
                    if (!isDismissibleGuideStep(step)) return
                    const current = config.onboardingGuideDone ?? []
                    if (current.includes(step)) return
                    persistOnboardingSignals({ onboardingGuideDone: [...current, step] })
                  }}
                  orchestratorPath={config.orchestratorPath}
                  onSelectOrchestratorPath={handleOnboardingSelectPath}
                  onInviteToOrg={() => { setOrgModalOpen(true) }}
                  hideComposer={!s.showComposer && chromeLocked}
                  hidePulse={chrome.hidePulse}
                  hideWiki={chrome.hideWiki}
                  hideLoops={chrome.hideLoops}
                  composerSendBlock={sendBlock}
                  agentCliMissing={sendBlock === 'cli'}
                  showPathPicker={s.showPathPicker}
                  showFolderCta={s.showFolderCta}
                  showTeamFab={s.showTeamFab}
                  showInviteCta={s.showInviteCta}
                />
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
            onAgentSaved={agent => rememberProjectAgent(catalogKey, agent)}
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
                projectCwd={tab.projectFolder ?? ''}
                onClose={() => closeTabGitModal(tab.id)}
              />
            ) : null}
          </React.Fragment>
        )
      })}

      <AppModals
        config={config}
        settingsCwd={settingsCwd}
        settingsOpen={settingsOpen}
        orgModalOpen={orgModalOpen}
        orgWorkspacePickerOpen={orgWorkspacePickerOpen}
        orgWorkspaceCatalogMap={orgWorkspaceCatalogMap}
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
        onOpenOrgWorkspace={selection => {
          setOrgModalOpen(false)
          void handleOrgWorkspaceTabConfirm(selection)
        }}
        onCloseOrgWorkspacePicker={() => {
          setOrgWorkspacePickerOpen(false)
          focusActiveTerminalTextarea()
        }}
        onConfirmOrgWorkspacePicker={handleOrgWorkspaceTabConfirm}
        promoteWorkspaceOpen={promoteWorkspaceTab !== null}
        promoteWorkspaceFolderPath={promoteWorkspaceTab?.projectFolder?.trim() ?? ''}
        promoteWorkspaceOrgs={promoteWorkspaceOrgs}
        promoteWorkspaceOrgsReason={promoteWorkspaceOrgsReason}
        promoteWorkspaceRepos={promoteWorkspaceRepos}
        promoteWorkspaceBusy={promoteWorkspaceBusy}
        promoteWorkspacePhase={promoteWorkspacePhase}
        promoteWorkspaceError={promoteWorkspaceError}
        onClosePromoteWorkspace={() => {
          if (promoteWorkspaceBusy) orgWorkspaceSyncUploadGenRef.current += 1
          setPromoteWorkspaceTab(null)
          setPromoteWorkspaceBusy(false)
          setPromoteWorkspacePhase(undefined)
          setPromoteWorkspaceError(undefined)
          focusActiveTerminalTextarea()
        }}
        onConfirmPromoteWorkspace={payload => { void handlePromoteLocalWorkspace(payload) }}
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
        onReplayOnboarding={handleReplayOnboarding}
        onAccountDeleted={handleGithubAccountDeleted}
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
        syncPhase={orgWorkspaceRequirement?.syncPhase}
        uploading={orgWorkspaceRequirement?.uploading}
        agentDeleteError={orgWorkspaceRequirement?.agentDeleteError}
        agentUpdateError={orgWorkspaceRequirement?.agentUpdateError}
        workspaceRenameError={orgWorkspaceRequirement?.workspaceRenameError}
        uploadError={orgWorkspaceRequirement?.uploadError}
        wikiError={orgWorkspaceRequirement?.wikiError}
        onClose={() => setOrgWorkspaceRequirement(null)}
        onCancelBusy={cancelOrgWorkspaceSyncOrUpload}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <OrgSyncScopeModal
        open={orgSyncScopeTab !== null}
        onClose={() => setOrgSyncScopeTab(null)}
        onConfirm={includeAgents => {
          const tab = orgSyncScopeTab
          setOrgSyncScopeTab(null)
          if (tab) void handleResyncOrgWorkspace(tab, { includeAgents })
        }}
      />

      <OrgSyncScopeModal
        mode="upload"
        open={orgUploadScopeTab !== null}
        plan={orgUploadPlan}
        planLoading={orgUploadPlanLoading}
        onClose={() => {
          setOrgUploadScopeTab(null)
          setOrgUploadPlan(null)
          setOrgUploadPlanLoading(false)
        }}
        onScopeChange={includeAgents => {
          const tab = orgUploadScopeTab
          if (tab) void loadOrgUploadPlan(tab, includeAgents)
        }}
        onConfirm={includeAgents => {
          const tab = orgUploadScopeTab
          setOrgUploadScopeTab(null)
          setOrgUploadPlan(null)
          setOrgUploadPlanLoading(false)
          if (tab) void executeUploadOrgWorkspace(tab, { includeAgents })
        }}
      />

      <HeroConfirmOverlay
        open={quitConfirmOpen}
        meta={
          termRefs.current.size > 0
            ? t('quit.terminalsOpen', { count: termRefs.current.size })
            : undefined
        }
        title={t('quit.title')}
        hint={t('quit.hint')}
        zIndex={QUIT_CONFIRM_Z}
        onCancel={() => setQuitConfirmOpen(false)}
        onConfirm={() => {
          setQuitConfirmOpen(false)
          window.api.sendQuitConfirmed()
        }}
      />
    </div>
  )
}
