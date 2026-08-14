import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useT } from '@i18n/useT'
import type { AgentCliImageAttachment } from '@shared/agentCliTypes'
import type { GitListedRepo } from '@shared/gitSessionTypes'
import type { PlaneLoopChain } from '@shared/planeLoopChain'
import { filterSeatableAgents } from '@shared/brainstormTable'
import {
  computePlaneChatColumnWidth,
  PLANE_CHAT_BASE_WIDTH,
} from '@shared/paneWindows'
import type { AgentPlaneStatus } from '../agent/AgentPane'
import { PlaneChatComposer, type PlaneChatAgentOption } from './PlaneChatComposer'
import { PlaneChatContextsBar } from './PlaneChatContextsBar'
import { PlaneChatDock } from './PlaneChatDock'
import { PlaneFabStack } from './PlaneFabStack'
import { PlaneMap, type PlaneMapEntity } from './PlaneMap'
import { PlaneIdleGravity } from './PlaneIdleGravity'
import { PlaneBrainstormTable } from './PlaneBrainstormTable'
import { PlaneProjectFolder } from './PlaneProjectFolder'
import { PlaneRevealFolderButton } from './PlaneRevealFolderButton'
import { PlaneLoopsButton } from './PlaneLoopsButton'
import { PlaneResyncButton } from './PlaneResyncButton'
import { PlaneUploadButton } from './PlaneUploadButton'
import { PlaneBrainstormsListButton } from './PlaneBrainstormsListButton'
import { PlaneBrainstormDock } from './PlaneBrainstormDock'
import type { BrainstormLiveSummary } from './brainstormLiveState'
import { isBrainstormLive } from './brainstormViewClose'
import { PlaneExplorerButton } from './PlaneExplorerButton'
import { PlaneGitButton } from './PlaneGitButton'
import { PlanePulseButton } from './PlanePulseButton'
import { PulseModal } from './PulseModal'
import { PlaneWikiMapButton } from './PlaneWikiMapButton'
import { WikiGraphView, wikiTypeLabelKey } from './WikiGraphView'
import { WikiCuratorComposer } from './WikiCuratorComposer'
import type { WikiGraphData } from './wikiGraph'
import { PlaneLoopsSection, type PlaneLoopsAgent } from './PlaneLoopsSection'
import { PlaneQuickChat } from './PlaneQuickChat'
import {
  PlaneContextPool,
  type PlaneContextPoolAgent,
  type PlaneContextPoolItem,
} from './PlaneContextPool'
import {
  TabFileExplorerWindow,
  type TabFileExplorerWindowHandle,
} from './TabFileExplorerWindow'
import type { FileExplorerPersistedState } from '@shared/fileExplorerPersistedState'
import type { TabContext } from '@shared/tabContext'
import type { AgentThread } from '@shared/agentThreads'
import { APP_OVERLAY_MODAL_Z } from '@shared/overlayZIndex'
import { ConfirmTerminalModal } from '../components/ConfirmTerminalModal'
import { TerminalModal } from '../components/TerminalModal'
import './TabAgenticPlane.css'

type PendingWorkspaceAction = 'resync' | 'upload'

export type { PlaneMapEntity }

export interface TabAgenticPlaneProps {
  emptyTitle: string
  emptyHint: string
  /** Tab activa (modales portaled solo visibles aquí). */
  tabActive?: boolean
  agentFabTitle: string
  terminalFabTitle: string
  /** Motivo cuando el FAB de agente queda disabled por falta de cwd. */
  agentFabDisabledTitle?: string
  /** Motivo cuando el FAB de terminal queda disabled por falta de cwd. */
  terminalFabDisabledTitle?: string
  /** Motivo cuando los FAB no pueden crear porque se alcanzó el máximo de ventanas. */
  fabPaneLimitReachedTitle?: string
  idleAgentLabel: string
  contextPoolTitle: string
  contextPoolConfigureLabel: string
  contextPoolCreateLabel: string
  contextPoolChipHint?: string
  contextPoolAssignLabel: string
  contextPoolAssignEmptyHint: string
  /** Aria del contador del chip; recibe el nº de agentes. */
  contextPoolAssignedCountLabel: (count: number) => string
  contextPoolEditLabel: string
  contextPoolDeleteLabel: string
  contextPoolDeleteConfirmMessage: (name: string) => string
  contextPoolDeleteConfirmDetail: string
  contextPoolTrashDropLabel: string
  chatPlaceholder: string
  chatEmptyAgents: string
  chatSendLabel: string
  tabContexts: PlaneContextPoolItem[]
  /** Catálogo completo (preview del modal de asignación). */
  contextCatalog?: TabContext[]
  onToggleAgentContext: (paneId: string, contextId: string) => void
  onToggleLoop: (paneId: string) => void
  onRemoveQueuedTurn: (paneId: string, id: string) => void
  onUpdateQueuedTurn: (paneId: string, id: string, text: string) => void
  onMergeQueuedTurns: (paneId: string) => void
  canAdd: boolean
  /** Si false, el FAB de agente queda deshabilitado (p. ej. sin carpeta de proyecto). */
  canAddAgent?: boolean
  /** Si false, el FAB de terminal queda deshabilitado (p. ej. sin carpeta de proyecto). */
  canAddTerminal?: boolean
  bootstrapAgentsLabel?: string
  bootstrapAgentsTitle?: string
  bootstrapAgentsDisabledTitle?: string
  showBootstrapAgents?: boolean
  canBootstrapAgents?: boolean
  onBootstrapAgents?: () => void
  activePaneId: string
  entities: PlaneMapEntity[]
  onAddAgent: () => void
  onAddTerminal: () => void
  onExpandEntity: (paneId: string) => void
  onCloseWindow: (paneId: string) => void
  onMinimizeAllWindows: () => void
  onFocusWindow: (paneId: string) => void
  onConfigureContexts: () => void
  onCreateContext: () => void
  /** Clic en chip del pool → editar ese contexto (sin DnD). */
  onOpenContext?: (contextId: string) => void
  /** Elimina un contexto del catálogo (org o local). */
  onDeleteContext?: (contextId: string) => void
  /** Asigna un contexto arrastrado del pool a un agente. */
  onAssignContext: (paneId: string, contextId: string) => void
  /** Clic en icono results → vista previa del Markdown del contexto. */
  onOpenResultsPreview?: (contextId: string) => void
  /**
   * Una mención de Jira en el composer materializó un contexto nuevo en
   * disco: mismo nombre y mismo propósito que el `onContextSaved` de
   * `TabContextsModal`/`BrainstormRoom` — refrescar el catálogo del tab.
   */
  onContextSaved?: () => void
  onSendChat: (
    paneId: string,
    text: string,
    images: AgentCliImageAttachment[],
    contextIds: string[],
  ) => void
  /** Detiene el turno activo del agente desde el composer del plano. */
  onStopChat: (paneId: string) => void
  /** Stop por fila en Waiting: cancela solo esa delegación del orquestador. */
  onAbortDelegation?: (fromPaneId: string, delegationId: string) => void
  /** Pide borrar la conversación activa del agente (confirmación en AgentPane). */
  onClearConversation: (paneId: string) => void
  /** Abre una conversación nueva sin borrar la actual. */
  onNewThread: (paneId: string) => void
  /** Reanuda otra conversación del agente. */
  onSelectThread: (paneId: string, threadId: string) => void
  /** Abre el chat del agente y selecciona un hilo desde la card mini del plano. */
  onOpenAgentThread?: (paneId: string, threadId: string) => void
  /** Retitula la conversación activa del agente. */
  onRenameThread: (paneId: string, title: string) => void
  /** Conversaciones del agente con el chat abierto. */
  openChatThreads?: readonly AgentThread[]
  openChatActiveThreadId?: string
  /** Agente cuyo chat está abierto en el plano (`null` = ninguno). Persistido en la sesión. */
  openChatAgentId: string | null
  /** paneId con creación de conversación pendiente (queda "+" bloqueado hasta aplicar). */
  newThreadPendingPaneId?: string | null
  /** Abre/cambia el chat, o lo cierra con `null`. */
  onOpenChatAgentChange: (paneId: string | null) => void
  /** Estados de chat por agente (para el chat centrado del plano). */
  agentStatuses?: Record<string, AgentPlaneStatus>
  chatFontSize?: number
  /** Sonidos del sistema para dictado del composer. */
  systemSoundsEnabled?: boolean
  configLabel: string
  deleteLabel: string
  maximizeLabel: string
  restoreLabel: string
  closeWindowLabel: string
  projectFolder: string
  /** Sube cuando los contextos del proyecto se remateralizan (`refreshTabContexts`). */
  contextsRevision?: number
  projectFolderSelectLabel: string
  projectFolderChangeLabel: string
  projectFolderEmptyHint: string
  projectFolderRevealLabel: string
  onSelectProjectFolder: () => void
  onRevealProjectFolder?: () => void
  /** Re-sincroniza repos/agentes/contextos de un workspace org. */
  onResyncWorkspace?: () => void
  resyncWorkspaceLabel?: string
  resyncWorkspaceBusy?: boolean
  canResyncWorkspace?: boolean
  /** Sube agentes/contextos locales al backend (managers). */
  onUploadWorkspace?: () => void
  uploadWorkspaceLabel?: string
  uploadWorkspaceBusy?: boolean
  canUploadWorkspace?: boolean
  loopsOpen: boolean
  onLoopsOpenChange: (open: boolean) => void
  loopsButtonLabel: string
  /** Mesa de invitados abierta en el lienzo (paso previo al modal de tema). */
  brainstormTableOpen?: boolean
  /** Ids sentados, en orden de habla. */
  brainstormSeated?: readonly string[]
  onBrainstormSeatedChange?: (next: string[]) => void
  onBrainstormTableClose?: () => void
  onBrainstormTableContinue?: () => void
  brainstormNeedFolderHint?: string
  canOpenBrainstorm?: boolean
  /** Arranque de una sala nueva: es lo que abre el botón cuando no hay sala viva. */
  brainstormStartOpen?: boolean
  onBrainstormStartOpenChange?: (open: boolean) => void
  brainstormsListButtonLabel?: string
  /** Sala minimizada que sigue viva: punto en el botón + flyout anclado. */
  brainstormLive?: BrainstormLiveSummary | null
  /** Hay room montada (minimizada o no), aunque live aún no haya llegado. */
  brainstormHasRoom?: boolean
  brainstormMinimized?: boolean
  brainstormDockOpen?: boolean
  onBrainstormDockOpenChange?: (open: boolean) => void
  onRestoreBrainstorm?: () => void
  onStopBrainstorm?: () => void
  onDiscardBrainstorm?: () => void
  loopsTitle: string
  loopsSubtitle: string
  loopsEmptyTitle: string
  loopsEmptyHint: string
  loopsChainsTitle: string
  loopsChainsEmpty: string
  loopsCreateChainLabel: string
  loopsAppendStepLabel: string
  loopsStartChainLabel: string
  loopsStopChainLabel: string
  loopsDeleteChainLabel: string
  loopsChainModalTitle: string
  loopsChainModalDescription: string
  loopsAppendModalTitle: string
  loopsAppendModalDescription: string
  loopsAgentLabel: string
  loopsObjectiveLabel: string
  loopsObjectivePlaceholder: string
  loopsNoAgentsHint: string
  loopsNoAppendAgentsHint: string
  loopsBlockNeedObjectiveHint: string
  loopsChainConfirmLabel: string
  loopsAppendConfirmLabel: string
  loopsCancelLabel: string
  loopsStatusIdle: string
  loopsStatusBusy: string
  loopsStatusLooping: string
  loopsChainStatusIdle: string
  loopsChainStatusRunning: string
  loopsChainStatusWaiting: string
  loopsChainStatusStopped: string
  loopChains: PlaneLoopChain[]
  onLoopChainsChange: (chains: PlaneLoopChain[]) => void
  onStartLoopChain: (chainId: string) => void
  onStopLoopChain: (chainId: string) => void
  canStartLoopChains?: boolean
  startLoopChainsBlockedHint?: string
  onOpenConfig: (paneId: string) => void
  onDeletePane: (paneId: string) => void
  onRenamePane?: (paneId: string, title: string) => void
  onToggleFullscreen: (paneId: string) => void
  renderPane: (paneId: string) => React.ReactNode
  /** Persiste el orden de minis en una columna del plano. */
  onReorderPanes?: (kind: 'terminal' | 'agent', orderedPaneIds: string[]) => void
  reorderAriaLabel?: string
  /** Explorador como ventana del plano (solo si hay terminal en la tab). */
  explorerSessionId?: string | null
  explorerState?: FileExplorerPersistedState
  explorerTitle?: string
  explorerButtonLabel?: string
  explorerZIndex?: number
  explorerThemeId?: string
  explorerCwd?: string
  onExplorerStateChange?: (patch: Partial<FileExplorerPersistedState>) => void
  onToggleExplorer?: () => void
  explorerHostRef?: React.Ref<TabFileExplorerWindowHandle>
  /** Botón Git en la barra del plano (visible si hay projectFolder). */
  canOpenGitPanel?: boolean
  gitButtonDisabled?: boolean
  gitButtonLabel?: string
  gitButtonDisabledTitle?: string
  gitPickerOpen?: boolean
  onGitButtonClick?: () => void
  /** Repos git del root folder del tab, listados bajo el composer del plano. */
  gitRepos: GitListedRepo[]
  /** Clic en un repo de la lista → abre su modal git. */
  onOpenRepoGit: (path: string) => void
  /** Revalida la lista de repos contra el disco. */
  onRefreshRepos?: () => void
  /**
   * Primer layout estable del plano activo (libera el splash de arranque).
   */
  onFirstLayoutReady?: () => void
  /** Sin transición de ranura durante el settle de arranque. */
  deferPositionMotion?: boolean
  /**
   * Tras crear la wiki desde el CTA del mapa (ensureWiki ok): push org si aplica.
   */
  onWikiMutated?: (cwd: string) => void
}

export const TabAgenticPlane: React.FC<TabAgenticPlaneProps> = ({
  emptyTitle,
  emptyHint,
  tabActive = true,
  agentFabTitle,
  terminalFabTitle,
  agentFabDisabledTitle,
  terminalFabDisabledTitle,
  fabPaneLimitReachedTitle,
  idleAgentLabel,
  contextPoolTitle,
  contextPoolConfigureLabel,
  contextPoolCreateLabel,
  contextPoolChipHint,
  contextPoolAssignLabel,
  contextPoolAssignEmptyHint,
  contextPoolAssignedCountLabel,
  contextPoolEditLabel,
  contextPoolDeleteLabel,
  contextPoolDeleteConfirmMessage,
  contextPoolDeleteConfirmDetail,
  contextPoolTrashDropLabel,
  chatPlaceholder,
  chatEmptyAgents,
  chatSendLabel,
  tabContexts,
  contextCatalog = [],
  onToggleAgentContext,
  onToggleLoop,
  onRemoveQueuedTurn,
  onUpdateQueuedTurn,
  onMergeQueuedTurns,
  canAdd,
  canAddAgent = true,
  canAddTerminal = true,
  bootstrapAgentsLabel,
  bootstrapAgentsTitle,
  bootstrapAgentsDisabledTitle,
  showBootstrapAgents = false,
  canBootstrapAgents = false,
  onBootstrapAgents,
  activePaneId,
  entities,
  onAddAgent,
  onAddTerminal,
  onExpandEntity,
  onCloseWindow,
  onMinimizeAllWindows,
  onFocusWindow,
  onConfigureContexts,
  onCreateContext,
  onOpenContext,
  onDeleteContext,
  onAssignContext,
  onOpenResultsPreview,
  onContextSaved,
  onSendChat,
  onStopChat,
  onAbortDelegation,
  onClearConversation,
  onNewThread,
  onSelectThread,
  onOpenAgentThread,
  onRenameThread,
  openChatThreads = [],
  openChatActiveThreadId = '',
  openChatAgentId,
  newThreadPendingPaneId = null,
  onOpenChatAgentChange,
  agentStatuses = {},
  chatFontSize = 13,
  systemSoundsEnabled = true,
  configLabel,
  deleteLabel,
  maximizeLabel,
  restoreLabel,
  closeWindowLabel,
  projectFolder,
  contextsRevision = 0,
  projectFolderSelectLabel,
  projectFolderChangeLabel,
  projectFolderEmptyHint,
  projectFolderRevealLabel,
  onSelectProjectFolder,
  onRevealProjectFolder,
  onResyncWorkspace,
  resyncWorkspaceLabel = '',
  resyncWorkspaceBusy = false,
  canResyncWorkspace = false,
  onUploadWorkspace,
  uploadWorkspaceLabel = '',
  uploadWorkspaceBusy = false,
  canUploadWorkspace = false,
  loopsOpen,
  onLoopsOpenChange,
  loopsButtonLabel,
  brainstormTableOpen = false,
  brainstormSeated = [],
  onBrainstormSeatedChange,
  onBrainstormTableClose,
  onBrainstormTableContinue,
  brainstormNeedFolderHint,
  canOpenBrainstorm = false,
  brainstormLive = null,
  brainstormHasRoom = false,
  brainstormMinimized = false,
  brainstormDockOpen = false,
  onBrainstormDockOpenChange,
  onRestoreBrainstorm,
  onStopBrainstorm,
  onDiscardBrainstorm,
  brainstormStartOpen = false,
  onBrainstormStartOpenChange,
  brainstormsListButtonLabel = 'Brainstorms',
  loopsTitle,
  loopsSubtitle,
  loopsEmptyTitle,
  loopsEmptyHint,
  loopsChainsTitle,
  loopsChainsEmpty,
  loopsCreateChainLabel,
  loopsAppendStepLabel,
  loopsStartChainLabel,
  loopsStopChainLabel,
  loopsDeleteChainLabel,
  loopsChainModalTitle,
  loopsChainModalDescription,
  loopsAppendModalTitle,
  loopsAppendModalDescription,
  loopsAgentLabel,
  loopsObjectiveLabel,
  loopsObjectivePlaceholder,
  loopsNoAgentsHint,
  loopsNoAppendAgentsHint,
  loopsBlockNeedObjectiveHint,
  loopsChainConfirmLabel,
  loopsAppendConfirmLabel,
  loopsCancelLabel,
  loopsStatusIdle,
  loopsStatusBusy,
  loopsStatusLooping,
  loopsChainStatusIdle,
  loopsChainStatusRunning,
  loopsChainStatusWaiting,
  loopsChainStatusStopped,
  loopChains,
  onLoopChainsChange,
  onStartLoopChain,
  onStopLoopChain,
  canStartLoopChains = true,
  startLoopChainsBlockedHint = '',
  onOpenConfig,
  onDeletePane,
  onRenamePane,
  onToggleFullscreen,
  renderPane,
  onReorderPanes,
  reorderAriaLabel,
  explorerSessionId = null,
  explorerState,
  explorerTitle = '',
  explorerButtonLabel,
  explorerZIndex = APP_OVERLAY_MODAL_Z,
  explorerThemeId = '',
  explorerCwd = '',
  onExplorerStateChange,
  onToggleExplorer,
  explorerHostRef,
  canOpenGitPanel = false,
  gitButtonDisabled = false,
  gitButtonLabel = '',
  gitButtonDisabledTitle = '',
  gitPickerOpen = false,
  onGitButtonClick,
  gitRepos,
  onOpenRepoGit,
  onRefreshRepos,
  onFirstLayoutReady,
  deferPositionMotion = false,
  onWikiMutated,
}) => {
  const { t } = useT()
  const planeRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  // Pulse solo lee del store por IPC: no necesita nada del padre, así que su
  // estado se queda acá en vez de engordar las props de App.tsx.
  const [pulseOpen, setPulseOpen] = useState(false)
  const [pendingWorkspaceAction, setPendingWorkspaceAction] = useState<PendingWorkspaceAction | null>(null)
  // Mapa de wiki: estado local (sin nada del padre), patrón brainstormViewClose:
  // abrir tapa el plano entero, cerrar restaura todo tal cual estaba.
  const [wikiMapOpen, setWikiMapOpen] = useState(false)
  // Pila de pages abiertas en modales (clic en nodo = 1; view del curador ≤ 3).
  const [wikiNodeSlugs, setWikiNodeSlugs] = useState<string[]>([])
  // null = cargando; nodes vacíos = wiki sin pages (empty state en la vista).
  const [wikiGraphData, setWikiGraphData] = useState<WikiGraphData | null>(null)
  // Incrementar relanza el fetch del grafo sin cerrar el mapa (CTA 'Crear wiki').
  const [wikiGraphRefreshToken, setWikiGraphRefreshToken] = useState(0)
  // Refetch suave (ingest del curador aplicado): swap de data sin cerrar modales.
  const [wikiGraphSoftToken, setWikiGraphSoftToken] = useState(0)

  const loadWikiGraph = useCallback(async (): Promise<WikiGraphData> => {
    const cwd = projectFolder.trim()
    if (!cwd) return { nodes: [], edges: [] }
    try {
      const result = await window.api.getWikiGraph(cwd)
      return result.ok && result.data ? result.data : { nodes: [], edges: [] }
    } catch {
      return { nodes: [], edges: [] }
    }
  }, [projectFolder])

  // Pages reales vía IPC, refetch en cada apertura: la wiki puede haber
  // cambiado entre una y otra. ok:false o error → grafo vacío (empty state).
  useEffect(() => {
    if (!wikiMapOpen) return
    let cancelled = false
    setWikiGraphData(null)
    setWikiNodeSlugs([])
    void loadWikiGraph().then(data => {
      if (!cancelled) setWikiGraphData(data)
    })
    return () => { cancelled = true }
  }, [wikiMapOpen, loadWikiGraph, wikiGraphRefreshToken])

  // Camino suave: el curador aplicó ops — los nodos se actualizan en vivo,
  // sin resetear la escena ni cerrar los modales abiertos.
  useEffect(() => {
    if (!wikiMapOpen || wikiGraphSoftToken === 0) return
    let cancelled = false
    void loadWikiGraph().then(data => {
      if (!cancelled) setWikiGraphData(data)
    })
    return () => { cancelled = true }
  }, [wikiMapOpen, loadWikiGraph, wikiGraphSoftToken])

  useLayoutEffect(() => {
    const el = planeRef.current
    if (!el) return
    const measure = (): void => {
      const width = el.clientWidth
      const height = el.clientHeight
      if (width <= 0 || height <= 0) return
      setViewport(prev => (
        prev.width === width && prev.height === height ? prev : { width, height }
      ))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const agents = useMemo((): PlaneChatAgentOption[] => (
    entities
      .filter(entity => entity.kind === 'agent')
      .map(entity => {
        const status = agentStatuses[entity.paneId]
        const workStyle = status?.orchestrationWorkStyle
        return {
          paneId: entity.paneId,
          title: entity.title,
          monogram: entity.monogram,
          busy: Boolean(status?.busy ?? entity.busy),
          loopActive: Boolean(status?.loopActive),
          awaitingDelegations: Boolean(status?.awaitingDelegations),
          delegationWorkActive: Boolean(status?.delegationWorkActive || entity.delegationWorkActive),
          orchestratorBusy: Boolean(status?.orchestratorBusy),
          orchestrationWorkStyle: workStyle === 'turbo' ? 'turbo' : 'linear',
        }
      })
  ), [agentStatuses, entities])

  const tableAgents = useMemo(
    () => filterSeatableAgents(entities.filter(entity => entity.kind === 'agent'))
      .map(entity => ({
        agentId: entity.agentId!,
        name: entity.title,
        ...(entity.monogram ? { monogram: entity.monogram } : {}),
      })),
    [entities],
  )

  const loopAgents = useMemo<PlaneLoopsAgent[]>(
    () => entities
      .filter(entity => entity.kind === 'agent')
      .map(entity => {
        const status = agentStatuses[entity.paneId]
        return {
          paneId: entity.paneId,
          title: entity.title,
          busy: Boolean(status?.busy ?? entity.busy),
          loopActive: Boolean(status?.loopActive),
          loopMode: Boolean(status?.loopMode),
          provider: entity.provider,
        }
      }),
    [agentStatuses, entities],
  )

  /** Agentes asignables desde el pool de contextos. */
  const contextPoolAgents = useMemo<PlaneContextPoolAgent[]>(
    () => entities
      .filter(entity => entity.kind === 'agent')
      .map(entity => ({
        paneId: entity.paneId,
        title: entity.title,
        contextIds: entity.contextIds ?? [],
      })),
    [entities],
  )

  const terminalCount = useMemo(
    () => entities.filter(entity => entity.kind !== 'agent').length,
    [entities],
  )

  const chatColumnWidth = useMemo(() => {
    const vp = viewport.width > 0 && viewport.height > 0
      ? viewport
      : { width: 960, height: 640 }
    return computePlaneChatColumnWidth(
      vp,
      Math.max(agents.length, terminalCount, 1),
    )
  }, [agents.length, terminalCount, viewport])

  /** Burbujas realmente montadas en el plano (no solo elegibles). */
  const [quickChatShowing, setQuickChatShowing] = useState(false)

  // Si el agente abierto desaparece, cierra el chat persistido.
  useEffect(() => {
    if (!openChatAgentId) return
    if (agents.some(agent => agent.paneId === openChatAgentId)) return
    onOpenChatAgentChange(null)
  }, [agents, openChatAgentId, onOpenChatAgentChange])

  useEffect(() => {
    if (!openChatAgentId) setQuickChatShowing(false)
  }, [openChatAgentId])

  /** Badge / card: abrir o cambiar chat (no cierra al repetir). */
  const openChatAgent = (paneId: string): void => {
    onOpenChatAgentChange(paneId)
  }

  const closeChatAgent = (): void => {
    onOpenChatAgentChange(null)
  }

  const quickChatStatus = openChatAgentId
    ? agentStatuses[openChatAgentId] ?? null
    : null

  const openChatRunningThreadIds = useMemo(() => {
    if (!openChatAgentId) return []
    const entity = entities.find(
      candidate => candidate.paneId === openChatAgentId && candidate.kind === 'agent',
    )
    return entity?.threads?.filter(thread => thread.running).map(thread => thread.id) ?? []
  }, [entities, openChatAgentId])

  // Agentes no expanden ventana; el chat del plano no compite con window.open.
  const quickChatVisible = Boolean(
    openChatAgentId
    && quickChatStatus
    && (quickChatStatus.busy || quickChatStatus.messages.length > 0),
  )

  const anyFullscreen = entities.some(
    entity => entity.window.open && entity.window.fullscreen,
  )

  const anyWindowOpen = entities.some(entity => entity.window.open)
    || Boolean(explorerState?.open)

  const showIdleGravity = !anyFullscreen && !quickChatShowing
  const canToggleExplorer = Boolean(explorerSessionId && onToggleExplorer)

  return (
    <div
      ref={planeRef}
      className="tab-agentic-plane"
      style={{
        ['--plane-chat-column-width' as string]: `${chatColumnWidth || PLANE_CHAT_BASE_WIDTH}px`,
      }}
      onPointerDown={event => {
        if (event.button !== 0) return
        if (!anyWindowOpen) return
        const target = event.target as HTMLElement | null
        if (!target) return
        // Clic fuera de la ventana abierta (y fuera de FABs/composer/modales) → minimizar.
        if (target.closest([
          '.pane-window',
          '.plane-fab-stack',
          '.plane-fab',
          '.plane-project-folder',
          '.plane-top-left-bar',
          '.plane-chat-composer',
          '.plane-chat-dock__composer-shell',
          '.plane-chat-dock__toolbar',
          '.plane-context-pool',
          '[role="dialog"]',
          'button',
          'a',
          'input',
          'textarea',
          'select',
        ].join(', '))) {
          return
        }
        onMinimizeAllWindows()
      }}
    >
      {!anyFullscreen && (
        <div className={`plane-top-left-bar${wikiMapOpen ? ' plane-top-left-bar--over-wiki' : ''}`}>
          <PlaneProjectFolder
            folderPath={projectFolder}
            selectLabel={projectFolderSelectLabel}
            changeLabel={projectFolderChangeLabel}
            emptyHint={projectFolderEmptyHint}
            onSelect={onSelectProjectFolder}
          />
          {canUploadWorkspace && onUploadWorkspace ? (
            <PlaneUploadButton
              label={uploadWorkspaceLabel || ''}
              busy={Boolean(uploadWorkspaceBusy)}
              onClick={() => setPendingWorkspaceAction('upload')}
            />
          ) : null}
          {canResyncWorkspace && onResyncWorkspace ? (
            <PlaneResyncButton
              label={resyncWorkspaceLabel || ''}
              busy={Boolean(resyncWorkspaceBusy)}
              onClick={() => setPendingWorkspaceAction('resync')}
            />
          ) : null}
          {canToggleExplorer ? (
            <PlaneExplorerButton
              label={explorerButtonLabel || explorerTitle || loopsButtonLabel}
              pressed={Boolean(explorerState?.open)}
              onClick={() => onToggleExplorer?.()}
            />
          ) : null}
          {canOpenGitPanel && onGitButtonClick ? (
            <PlaneGitButton
              label={gitButtonLabel}
              disabled={gitButtonDisabled}
              disabledTitle={gitButtonDisabledTitle}
              pressed={gitPickerOpen}
              onClick={() => onGitButtonClick()}
            />
          ) : null}
          <PlaneLoopsButton
            label={loopsButtonLabel}
            pressed={loopsOpen}
            onClick={() => onLoopsOpenChange(!loopsOpen)}
          />
          <PlanePulseButton
            label={t('pulse.button')}
            pressed={pulseOpen}
            onClick={() => setPulseOpen(open => !open)}
          />
          {onBrainstormStartOpenChange ? (
            <span className="plane-brainstorm-anchor">
              <PlaneBrainstormsListButton
                label={brainstormsListButtonLabel}
                pressed={
                  brainstormHasRoom || Boolean(brainstormLive)
                    ? brainstormDockOpen
                    : brainstormStartOpen
                }
                disabled={!canOpenBrainstorm}
                disabledTitle={brainstormNeedFolderHint}
                onClick={() => {
                  const hasRoom = brainstormHasRoom || Boolean(brainstormLive)
                  // Room minimizada: reabrir modal; no caer en la lista (App la oculta si hay room).
                  if (hasRoom && brainstormMinimized) {
                    if (brainstormDockOpen) onBrainstormDockOpenChange?.(false)
                    onRestoreBrainstorm?.()
                    return
                  }
                  if (hasRoom) onBrainstormDockOpenChange?.(!brainstormDockOpen)
                  else onBrainstormStartOpenChange(!brainstormStartOpen)
                }}
              />
              {brainstormLive && isBrainstormLive(brainstormLive.status) ? (
                <span
                  className={[
                    'plane-brainstorm-anchor__badge',
                    brainstormLive.status === 'running'
                      ? 'plane-brainstorm-anchor__badge--pulse'
                      : '',
                  ].filter(Boolean).join(' ')}
                  aria-hidden
                />
              ) : null}
              {brainstormLive && brainstormDockOpen ? (
                <PlaneBrainstormDock
                  live={brainstormLive}
                  onOpen={() => {
                    onBrainstormDockOpenChange?.(false)
                    onRestoreBrainstorm?.()
                  }}
                  onStop={() => onStopBrainstorm?.()}
                  onDiscard={() => {
                    onBrainstormDockOpenChange?.(false)
                    onDiscardBrainstorm?.()
                  }}
                />
              ) : null}
            </span>
          ) : null}
          <PlaneWikiMapButton
            label={t('tabs.wikiMapButton')}
            pressed={wikiMapOpen}
            onClick={() => setWikiMapOpen(open => !open)}
          />
          {projectFolder.trim() && onRevealProjectFolder ? (
            <PlaneRevealFolderButton
              folderPath={projectFolder}
              label={projectFolderRevealLabel}
              onReveal={onRevealProjectFolder}
            />
          ) : null}
        </div>
      )}
      <PlaneLoopsSection
        open={loopsOpen && !anyFullscreen && tabActive}
        title={loopsTitle}
        subtitle={loopsSubtitle}
        emptyTitle={loopsEmptyTitle}
        emptyHint={loopsEmptyHint}
        chainsTitle={loopsChainsTitle}
        chainsEmpty={loopsChainsEmpty}
        createChainLabel={loopsCreateChainLabel}
        appendStepLabel={loopsAppendStepLabel}
        startChainLabel={loopsStartChainLabel}
        stopChainLabel={loopsStopChainLabel}
        deleteChainLabel={loopsDeleteChainLabel}
        chainModalTitle={loopsChainModalTitle}
        chainModalDescription={loopsChainModalDescription}
        appendModalTitle={loopsAppendModalTitle}
        appendModalDescription={loopsAppendModalDescription}
        agentLabel={loopsAgentLabel}
        objectiveLabel={loopsObjectiveLabel}
        objectivePlaceholder={loopsObjectivePlaceholder}
        noAgentsHint={loopsNoAgentsHint}
        noAppendAgentsHint={loopsNoAppendAgentsHint}
        blockNeedObjectiveHint={loopsBlockNeedObjectiveHint}
        chainConfirmLabel={loopsChainConfirmLabel}
        appendConfirmLabel={loopsAppendConfirmLabel}
        cancelLabel={loopsCancelLabel}
        statusIdle={loopsStatusIdle}
        statusBusy={loopsStatusBusy}
        statusLooping={loopsStatusLooping}
        chainStatusIdle={loopsChainStatusIdle}
        chainStatusRunning={loopsChainStatusRunning}
        chainStatusWaiting={loopsChainStatusWaiting}
        chainStatusStopped={loopsChainStatusStopped}
        agents={loopAgents}
        chains={loopChains}
        canStartChains={canStartLoopChains}
        startBlockedHint={startLoopChainsBlockedHint}
        onClose={() => onLoopsOpenChange(false)}
        onChainsChange={onLoopChainsChange}
        onStartChain={onStartLoopChain}
        onStopChain={onStopLoopChain}
      />
      <PlaneMap
        idleAgentLabel={idleAgentLabel}
        entities={entities}
        activePaneId={activePaneId}
        chatActiveAgentId={openChatAgentId}
        tabActive={tabActive}
        seatDragEnabled={brainstormTableOpen}
        configLabel={configLabel}
        deleteLabel={deleteLabel}
        maximizeLabel={maximizeLabel}
        restoreLabel={restoreLabel}
        closeWindowLabel={closeWindowLabel}
        renderPane={renderPane}
        onExpandEntity={onExpandEntity}
        onCloseWindow={onCloseWindow}
        onFocusWindow={onFocusWindow}
        onToggleFullscreen={onToggleFullscreen}
        onOpenConfig={onOpenConfig}
        onOpenChat={openChatAgent}
        onDeletePane={onDeletePane}
        onRenamePane={onRenamePane}
        onAssignContext={onAssignContext}
        onOpenResultsPreview={onOpenResultsPreview}
        onReorderPanes={onReorderPanes}
        reorderAriaLabel={reorderAriaLabel}
        onFirstLayoutReady={onFirstLayoutReady}
        deferPositionMotion={deferPositionMotion}
        cwd={projectFolder}
        contextsRevision={contextsRevision}
        onOpenThread={onOpenAgentThread}
      />

      {explorerSessionId && explorerState?.open && onExplorerStateChange ? (
        <TabFileExplorerWindow
          ref={explorerHostRef}
          sessionId={explorerSessionId}
          themeId={explorerThemeId}
          cwd={explorerCwd}
          explorerState={explorerState}
          onExplorerStateChange={onExplorerStateChange}
          onClose={() => {
            onExplorerStateChange({ open: false, fullscreen: false })
          }}
          title={explorerTitle}
          zIndex={explorerZIndex}
          tabActive={tabActive}
        />
      ) : null}

      {brainstormTableOpen && onBrainstormSeatedChange ? (
        <div className="plane-bs-table-anchor">
          <PlaneBrainstormTable
            agents={tableAgents}
            seated={brainstormSeated}
            onSeatedChange={onBrainstormSeatedChange}
            onClose={() => onBrainstormTableClose?.()}
            onContinue={() => onBrainstormTableContinue?.()}
          />
        </div>
      ) : null}

      {showIdleGravity && (
        <PlaneIdleGravity
          emptyHint={entities.length === 0 ? emptyHint : undefined}
          bootstrapAgentsLabel={bootstrapAgentsLabel}
          bootstrapAgentsTitle={bootstrapAgentsTitle}
          bootstrapAgentsDisabledTitle={bootstrapAgentsDisabledTitle}
          showBootstrapAgents={showBootstrapAgents && entities.length === 0}
          canBootstrapAgents={canBootstrapAgents}
          onBootstrapAgents={onBootstrapAgents}
        />
      )}

      {!anyFullscreen && !wikiMapOpen && (
        <PlaneContextPool
          title={contextPoolTitle}
          configureLabel={contextPoolConfigureLabel}
          createLabel={contextPoolCreateLabel}
          chipActionHint={contextPoolChipHint}
          assignLabel={contextPoolAssignLabel}
          assignEmptyHint={contextPoolAssignEmptyHint}
          assignedCountLabel={contextPoolAssignedCountLabel}
          editLabel={contextPoolEditLabel}
          deleteLabel={contextPoolDeleteLabel}
          deleteConfirmMessage={contextPoolDeleteConfirmMessage}
          deleteConfirmDetail={contextPoolDeleteConfirmDetail}
          trashDropLabel={contextPoolTrashDropLabel}
          contexts={tabContexts}
          contextCatalog={contextCatalog}
          cwd={projectFolder}
          agents={contextPoolAgents}
          onConfigure={onConfigureContexts}
          onCreate={onCreateContext}
          onOpenContext={onOpenContext}
          onDeleteContext={onDeleteContext}
          onToggleAssign={onToggleAgentContext}
        />
      )}

      {!anyFullscreen && (
        <PlaneChatDock
          toolbar={openChatAgentId ? (
            <PlaneChatContextsBar
              loopMode={Boolean(quickChatStatus?.loopMode)}
              loopActive={Boolean(quickChatStatus?.loopActive)}
              canClearConversation={Boolean(quickChatStatus?.canClearConversation)}
              threads={openChatThreads}
              activeThreadId={openChatActiveThreadId}
              runningThreadIds={openChatRunningThreadIds}
              // Cambiar de conversación con un loop vivo dejaría el stream escribiendo
              // en el transcript equivocado. El "+" solo se bloquea con loop activo o
              // mientras hay una creación pendiente aplicándose post-settle; un turno
              // normal sí puede solicitarla y cambiar de hilo promueve el activo a fondo.
              threadSelectionLocked={Boolean(quickChatStatus?.loopActive)}
              newThreadLocked={Boolean(
                quickChatStatus?.loopActive
                || (newThreadPendingPaneId && newThreadPendingPaneId === openChatAgentId),
              )}
              onToggleLoop={() => onToggleLoop(openChatAgentId)}
              onClearConversation={() => onClearConversation(openChatAgentId)}
              onNewThread={() => onNewThread(openChatAgentId)}
              onSelectThread={threadId => onSelectThread(openChatAgentId, threadId)}
              onRenameThread={title => onRenameThread(openChatAgentId, title)}
            />
          ) : null}
          chat={quickChatVisible && openChatAgentId ? (
            <PlaneQuickChat
              key={openChatAgentId}
              messages={quickChatStatus?.messages ?? []}
              busy={Boolean(quickChatStatus?.busy)}
              activity={quickChatStatus?.activity ?? ''}
              awaitingDelegations={Boolean(quickChatStatus?.awaitingDelegations)}
              orchestrationAwaiting={quickChatStatus?.orchestrationAwaiting ?? null}
              activeAssistantId={quickChatStatus?.activeAssistantId ?? null}
              enteringIds={quickChatStatus?.enteringIds}
              materializingIds={quickChatStatus?.materializingIds}
              settlingId={quickChatStatus?.settlingId ?? null}
              fontSize={chatFontSize}
              onShowingChange={setQuickChatShowing}
              onAbortDelegation={
                onAbortDelegation
                  ? (delegationId => onAbortDelegation(openChatAgentId, delegationId))
                  : undefined
              }
            />
          ) : null}
          composer={(
            <PlaneChatComposer
              agents={agents}
              contexts={tabContexts}
              selectedAgentId={openChatAgentId}
              suppressAuroraParticles={anyWindowOpen}
              placeholder={chatPlaceholder}
              emptyAgentsHint={chatEmptyAgents}
              sendLabel={chatSendLabel}
              queuedTurns={quickChatStatus?.queuedTurns ?? []}
              onSelectAgent={openChatAgent}
              onCloseChat={closeChatAgent}
              onStop={onStopChat}
              onSend={onSendChat}
              onRemoveQueuedTurn={onRemoveQueuedTurn}
              onUpdateQueuedTurn={onUpdateQueuedTurn}
              onMergeQueuedTurns={onMergeQueuedTurns}
              gitRepos={gitRepos}
              onOpenRepoGit={onOpenRepoGit}
              onRefreshRepos={onRefreshRepos}
              systemSoundsEnabled={systemSoundsEnabled}
              cwd={projectFolder}
              onContextSaved={onContextSaved}
            />
          )}
        />
      )}

      {!anyFullscreen && (
        <PlaneFabStack
          canAdd={canAdd}
          canAddAgent={canAddAgent}
          canAddTerminal={canAddTerminal}
          agentTitle={agentFabTitle}
          terminalTitle={terminalFabTitle}
          agentDisabledTitle={agentFabDisabledTitle}
          terminalDisabledTitle={terminalFabDisabledTitle}
          paneLimitReachedTitle={fabPaneLimitReachedTitle}
          onAddAgent={onAddAgent}
          onAddTerminal={onAddTerminal}
          bootstrapAgentsTitle={bootstrapAgentsTitle || bootstrapAgentsLabel}
          bootstrapAgentsDisabledTitle={bootstrapAgentsDisabledTitle}
          showBootstrapAgents={showBootstrapAgents && entities.length > 0}
          canBootstrapAgents={canBootstrapAgents}
          onBootstrapAgents={onBootstrapAgents}
        />
      )}

      {wikiMapOpen ? (
        <WikiGraphView
          data={wikiGraphData}
          cwd={projectFolder.trim()}
          active={tabActive}
          onClose={() => setWikiMapOpen(false)}
          onOpenNode={slug => setWikiNodeSlugs([slug])}
          onRefetchGraph={() => {
            setWikiGraphRefreshToken(token => token + 1)
            const cwd = projectFolder.trim()
            if (cwd) onWikiMutated?.(cwd)
          }}
          curator={projectFolder.trim() ? (
            <WikiCuratorComposer
              cwd={projectFolder.trim()}
              systemSoundsEnabled={systemSoundsEnabled}
              onViewSlugs={slugs => setWikiNodeSlugs(slugs.slice(0, 3))}
              onWikiChanged={() => setWikiGraphSoftToken(token => token + 1)}
            />
          ) : null}
        />
      ) : null}

      {/* Páginas reales de la wiki (markdown crudo; el render md rico llega después).
          Cascada de hasta 3 (view del curador), 24px de offset por paso; z por
          encima del mapa (APP_OVERLAY_MODAL_Z) — el default 640 quedaría debajo. */}
      {wikiNodeSlugs.map((slug, index) => {
        const node = wikiGraphData?.nodes.find(item => item.slug === slug)
        if (!node) return null
        return (
          <TerminalModal
            key={slug}
            open
            active={tabActive}
            title={node.title}
            size="sm"
            zIndex={APP_OVERLAY_MODAL_Z + 10 + index}
            cascadeStep={index}
            onClose={() => setWikiNodeSlugs(prev => prev.filter(item => item !== slug))}
          >
            <div className="wiki-graph-node-page">
              <p className="wiki-graph-node-page__type">
                {t(wikiTypeLabelKey(node.type))}
              </p>
              <p className="wiki-graph-node-page__body">
                {node.body ?? ''}
              </p>
            </div>
          </TerminalModal>
        )
      })}

      <PulseModal open={pulseOpen} onClose={() => setPulseOpen(false)} />

      <ConfirmTerminalModal
        open={pendingWorkspaceAction !== null}
        active={tabActive}
        zIndex={APP_OVERLAY_MODAL_Z}
        message={
          pendingWorkspaceAction === 'upload'
            ? t('tabs.uploadWorkspaceConfirmMessage')
            : t('tabs.resyncWorkspaceConfirmMessage')
        }
        detail={
          pendingWorkspaceAction === 'upload'
            ? t('tabs.uploadWorkspaceConfirmDetail')
            : t('tabs.resyncWorkspaceConfirmDetail')
        }
        onConfirm={() => {
          const action = pendingWorkspaceAction
          setPendingWorkspaceAction(null)
          if (action === 'upload') onUploadWorkspace?.()
          else if (action === 'resync') onResyncWorkspace?.()
        }}
        onCancel={() => setPendingWorkspaceAction(null)}
      />
    </div>
  )
}
