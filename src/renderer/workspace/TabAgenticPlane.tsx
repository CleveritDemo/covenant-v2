import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useT } from '@i18n/useT'
import type { AgentCliImageAttachment } from '@shared/agentCliTypes'
import type { GitListedRepo } from '@shared/gitSessionTypes'
import type { PlaneLoopChain } from '@shared/planeLoopChain'
import {
  computePlaneChatColumnWidth,
  PLANE_CHAT_BASE_WIDTH,
} from '@shared/paneWindows'
import type { AgentPlaneStatus } from '../agent/AgentPane'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import { PlaneChatComposer, type PlaneChatAgentOption } from './PlaneChatComposer'
import { PlaneChatContextsBar } from './PlaneChatContextsBar'
import { PlaneChatDock } from './PlaneChatDock'
import { PlaneFabStack } from './PlaneFabStack'
import { PlaneMap, type PlaneMapEntity } from './PlaneMap'
import { PlaneIdleGravity } from './PlaneIdleGravity'
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
import type { WikiGraphNodeScreenPosition } from './useWikiGraphScene'
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
import { APP_OVERLAY_MODAL_Z, PLANE_CHROME_STACK_Z, PLANE_CHAT_STACK_Z } from '@shared/overlayZIndex'
import {
  computeWikiModalPositionNearPoint,
  computeWikiModalSpreadPositions,
  WIKI_MODAL_ESTIMATED_HEIGHT,
  WIKI_MODAL_WIDTH,
} from '@shared/wikiModalPositions'
import { mergeWikiNodeModalsOpen } from '@shared/wikiNodeModalOpen'
import { AiMarkdown } from '../components/AiMarkdown'
import { ConfirmTerminalModal } from '../components/ConfirmTerminalModal'
import { TerminalModal } from '../components/TerminalModal'
import { formatWikiPageBodyForHuman } from '@shared/wikiPagePlain'
import './TabAgenticPlane.css'

type PendingWorkspaceAction = 'resync' | 'upload'

type WikiNodeModalState = {
  slug: string
  x: number
  y: number
  originX?: number
  originY?: number
}

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
  /** Catálogo de agentes del workspace (preview de cola humanizada). */
  projectAgents?: ProjectAgentDefinition[]
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
  brainstormNeedFolderHint?: string
  canOpenBrainstorm?: boolean
  /**
   * Vista del módulo: la biblioteca, el alta, una sala por id, o nada. Un solo
   * campo para las tres, que son excluyentes.
   */
  brainstormView?: 'rooms' | 'setup' | string | null
  onBrainstormViewChange?: (next: 'rooms' | 'setup' | string | null) => void
  /** Actas en disco: con historial el botón abre la biblioteca, sin él el alta. */
  brainstormSavedCount?: number
  brainstormsListButtonLabel?: string
  /**
   * Salas del workspace, en orden: vivas y también las terminadas sin soltar.
   * Corren en paralelo, así que el botón lleva el número y el flyout la lista.
   */
  brainstormRooms?: readonly BrainstormLiveSummary[]
  brainstormDockOpen?: boolean
  onBrainstormDockOpenChange?: (open: boolean) => void
  /** Volver a mirar una sala que sigue corriendo. */
  onOpenBrainstormRoom?: (roomId: string) => void
  onStopBrainstormRoom?: (roomId: string) => void
  onDiscardBrainstormRoom?: (roomId: string) => void
  /**
   * Overlays de la sala (alta y una vista por sala). Se montan aquí dentro
   * porque van `absolute` contra este plano, igual que el mapa de la wiki; el
   * estado sigue viviendo arriba, donde ya estaba.
   */
  brainstormOverlays?: React.ReactNode
  /**
   * Alguna sala ocupa el plano: la barra de navegación sube por encima y el
   * pool de contextos se retira, que es de quien hereda su esquina.
   */
  brainstormOverlayOpen?: boolean
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
  projectAgents = [],
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
  brainstormNeedFolderHint,
  canOpenBrainstorm = false,
  brainstormView = null,
  onBrainstormViewChange,
  brainstormSavedCount = 0,
  brainstormRooms = [],
  brainstormDockOpen = false,
  onBrainstormDockOpenChange,
  onOpenBrainstormRoom,
  onStopBrainstormRoom,
  onDiscardBrainstormRoom,
  brainstormOverlays,
  brainstormOverlayOpen = false,
  brainstormsListButtonLabel = 'Brainstorms',
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
  /** Salas que siguen corriendo: son las que cuenta el badge del botón. */
  const liveBrainstormRooms = useMemo(
    () => brainstormRooms.filter(room => isBrainstormLive(room.status)),
    [brainstormRooms],
  )
  // Pila de pages abiertas en modales (clic en nodo = 1; view del curador ≤ 3).
  const [wikiNodeModals, setWikiNodeModals] = useState<WikiNodeModalState[]>([])
  const wikiNodeScreenPositionsRef = useRef<ReadonlyMap<string, WikiGraphNodeScreenPosition>>(new Map())
  // null = cargando; nodes vacíos = wiki sin pages (empty state en la vista).
  const [wikiGraphData, setWikiGraphData] = useState<WikiGraphData | null>(null)
  const [wikiGraphError, setWikiGraphError] = useState<string | null>(null)
  // Incrementar relanza el fetch del grafo sin cerrar el mapa (CTA 'Crear wiki').
  const [wikiGraphRefreshToken, setWikiGraphRefreshToken] = useState(0)
  // Refetch suave (ingest del curador aplicado): swap de data sin cerrar modales.
  const [wikiGraphSoftToken, setWikiGraphSoftToken] = useState(0)
  // Tras bootstrap wiki desde el CTA: auto-/init del curador.
  const [wikiBootstrapInitToken, setWikiBootstrapInitToken] = useState(0)

  const getWikiModalBounds = useCallback((): { width: number; height: number } => {
    const el = planeRef.current
    if (el && el.clientWidth > 0 && el.clientHeight > 0) {
      return { width: el.clientWidth, height: el.clientHeight }
    }
    if (viewport.width > 0 && viewport.height > 0) {
      return viewport
    }
    return { width: 960, height: 640 }
  }, [viewport])

  const openWikiNodeModals = useCallback((
    slugs: string[],
    origins?: ReadonlyMap<string, { x: number; y: number }>,
  ) => {
    const trimmed = slugs.slice(0, 3)
    if (trimmed.length === 0) {
      setWikiNodeModals([])
      return
    }
    const bounds = getWikiModalBounds()
    const modalInput = {
      width: bounds.width,
      height: bounds.height,
      modalWidth: WIKI_MODAL_WIDTH,
      modalHeight: WIKI_MODAL_ESTIMATED_HEIGHT,
    }

    const incoming = trimmed.map(slug => {
      const fromArg = origins?.get(slug)
      const fromRef = wikiNodeScreenPositionsRef.current.get(slug)
      const origin = fromArg
        ?? (fromRef?.visible ? { x: fromRef.x, y: fromRef.y } : null)

      let pos: { x: number; y: number }
      let originX: number | undefined
      let originY: number | undefined
      if (origin) {
        pos = computeWikiModalPositionNearPoint({
          originX: origin.x,
          originY: origin.y,
          ...modalInput,
        })
        originX = origin.x
        originY = origin.y
      } else {
        const [spread] = computeWikiModalSpreadPositions({
          count: 1,
          ...modalInput,
        })
        pos = spread!
      }

      return {
        slug,
        x: pos.x,
        y: pos.y,
        ...(originX != null && originY != null ? { originX, originY } : {}),
      }
    })

    setWikiNodeModals(previous => mergeWikiNodeModalsOpen(previous, incoming, 3))
  }, [getWikiModalBounds])

  const loadWikiGraph = useCallback(async (): Promise<{
    data: WikiGraphData | null
    error: string | null
  }> => {
    const cwd = projectFolder.trim()
    if (!cwd) return { data: { nodes: [], edges: [] }, error: null }
    try {
      const result = await window.api.getWikiGraph(cwd)
      if (!result.ok) {
        return { data: null, error: result.error ?? '' }
      }
      return { data: result.data ?? { nodes: [], edges: [] }, error: null }
    } catch {
      return { data: null, error: '' }
    }
  }, [projectFolder])

  // Pages reales vía IPC, refetch en cada apertura: la wiki puede haber
  // cambiado entre una y otra. ok:false o error → overlay de error.
  useEffect(() => {
    if (!wikiMapOpen) return
    let cancelled = false
    setWikiGraphData(null)
    setWikiGraphError(null)
    setWikiNodeModals([])
    void loadWikiGraph().then(({ data, error }) => {
      if (cancelled) return
      if (error !== null) {
        setWikiGraphError(error)
        setWikiGraphData(null)
      } else {
        setWikiGraphData(data)
        setWikiGraphError(null)
      }
    })
    return () => { cancelled = true }
  }, [wikiMapOpen, loadWikiGraph, wikiGraphRefreshToken])

  // Camino suave: el curador aplicó ops — los nodos se actualizan en vivo,
  // sin resetear la escena ni cerrar los modales abiertos.
  useEffect(() => {
    if (!wikiMapOpen || wikiGraphSoftToken === 0) return
    let cancelled = false
    void loadWikiGraph().then(({ data, error }) => {
      if (cancelled || error || !data) return
      setWikiGraphData(data)
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

  const terminalWindowOpen = entities.some(
    entity => entity.kind !== 'agent' && entity.window.open,
  )

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
    && (quickChatStatus.busy || quickChatStatus.messages.length > 0)
    && !terminalWindowOpen,
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
        ['--plane-chat-stack-z' as string]: `${PLANE_CHAT_STACK_Z}`,
        ['--plane-chrome-stack-z' as string]: `${PLANE_CHROME_STACK_Z}`,
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
          '.plane-context-pool-shell',
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
      {/* Con un overlay ocupando el plano (mapa o sala) la barra sube por
          encima: es lo único que permite moverse y no se puede tapar. */}
      {!anyFullscreen && (
        <div
          className={`plane-top-left-bar${
            wikiMapOpen || brainstormOverlayOpen ? ' plane-top-left-bar--over-wiki' : ''
          }`}
        >
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
          {onBrainstormViewChange ? (
            <span className="plane-brainstorm-anchor">
              {/*
                Toggle con el contrato del mapa de wiki: pulsa y la sala ocupa el
                plano, vuelve a pulsar y se va la vista —no la sala, que sigue
                corriendo en main. Sin ninguna sala entra directo al alta; con
                varias abre la lista, porque hay que elegir a cuál volver.
              */}
              <PlaneBrainstormsListButton
                label={brainstormsListButtonLabel}
                pressed={brainstormOverlayOpen || brainstormDockOpen}
                liveCount={liveBrainstormRooms.length}
                disabled={!canOpenBrainstorm}
                disabledTitle={brainstormNeedFolderHint}
                onClick={() => {
                  if (brainstormOverlayOpen) {
                    onBrainstormViewChange(null)
                    return
                  }
                  if (brainstormDockOpen) {
                    onBrainstormDockOpenChange?.(false)
                    return
                  }
                  // Con más de una sala viva hay que elegir a cuál volver.
                  if (liveBrainstormRooms.length > 1) {
                    onBrainstormDockOpenChange?.(true)
                    return
                  }
                  if (liveBrainstormRooms.length === 1) {
                    onBrainstormViewChange(liveBrainstormRooms[0].roomId)
                    return
                  }
                  onBrainstormViewChange(
                    brainstormSavedCount > 0 || brainstormRooms.length > 0 ? 'rooms' : 'setup',
                  )
                }}
              />
              {liveBrainstormRooms.length > 0 ? (
                <span
                  className={[
                    'plane-brainstorm-anchor__badge',
                    liveBrainstormRooms.some(room => room.status === 'running')
                      ? 'plane-brainstorm-anchor__badge--pulse'
                      : '',
                  ].filter(Boolean).join(' ')}
                >
                  {liveBrainstormRooms.length}
                </span>
              ) : null}
              {brainstormDockOpen ? (
                <PlaneBrainstormDock
                  rooms={brainstormRooms}
                  onOpen={roomId => {
                    onBrainstormDockOpenChange?.(false)
                    onOpenBrainstormRoom?.(roomId)
                  }}
                  onStop={roomId => onStopBrainstormRoom?.(roomId)}
                  onDiscard={roomId => onDiscardBrainstormRoom?.(roomId)}
                  onCreate={() => {
                    onBrainstormDockOpenChange?.(false)
                    onBrainstormViewChange('setup')
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
        stageHidden={wikiMapOpen}
        wikiOverlay={wikiMapOpen ? (
          <WikiGraphView
            data={wikiGraphData}
            error={wikiGraphError}
            onRetry={() => setWikiGraphRefreshToken(token => token + 1)}
            cwd={projectFolder.trim()}
            active={tabActive}
            onClose={() => {
              setWikiMapOpen(false)
              setWikiNodeModals([])
            }}
            onOpenNode={(slug, screen) => openWikiNodeModals(
              [slug],
              screen ? new Map([[slug, screen]]) : undefined,
            )}
            onNodeScreenPositions={positions => {
              wikiNodeScreenPositionsRef.current = positions
            }}
            onRefetchGraph={() => {
              setWikiGraphRefreshToken(token => token + 1)
              const cwd = projectFolder.trim()
              if (cwd) onWikiMutated?.(cwd)
              setWikiBootstrapInitToken(token => token + 1)
            }}
            curator={projectFolder.trim() ? (
              <WikiCuratorComposer
                cwd={projectFolder.trim()}
                systemSoundsEnabled={systemSoundsEnabled}
                bootstrapInitToken={wikiBootstrapInitToken}
                onViewSlugs={slugs => openWikiNodeModals(slugs)}
                onWikiChanged={() => setWikiGraphSoftToken(token => token + 1)}
              />
            ) : null}
          />
        ) : null}
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

      {/* La esquina de arriba a la derecha se la queda el chrome del overlay:
          el pool se retira mientras el mapa o una sala ocupan el plano. */}
      {!anyFullscreen && !wikiMapOpen && !brainstormOverlayOpen && (
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

      {!anyFullscreen && !wikiMapOpen && (
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
              projectAgents={projectAgents}
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
              agentCatalog={projectAgents}
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

      {!anyFullscreen && !wikiMapOpen && (
        <PlaneFabStack
          canAdd={canAdd}
          canAddAgent={canAddAgent}
          canAddTerminal={canAddTerminal}
          agentTitle={agentFabTitle}
          terminalTitle={terminalFabTitle}
          agentDisabledTitle={agentFabDisabledTitle}
          terminalDisabledTitle={terminalFabDisabledTitle}
          onAddAgent={onAddAgent}
          onAddTerminal={onAddTerminal}
          bootstrapAgentsTitle={bootstrapAgentsTitle || bootstrapAgentsLabel}
          bootstrapAgentsDisabledTitle={bootstrapAgentsDisabledTitle}
          showBootstrapAgents={showBootstrapAgents && entities.length > 0}
          canBootstrapAgents={canBootstrapAgents}
          onBootstrapAgents={onBootstrapAgents}
        />
      )}

      {/* Sala sobre el plano: mismo montaje que el mapa (absolute contra este
          contenedor). El estado vive arriba; aquí solo tiene su sitio. */}
      {brainstormOverlays}

      {/* Páginas reales de la wiki (cuerpo legible vía preprocess + AiMarkdown).
          Hasta 3 modales movibles con posiciones dispersas sobre el plano. */}
      {wikiNodeModals.map((modal, index) => {
        const node = wikiGraphData?.nodes.find(item => item.slug === modal.slug)
        if (!node) return null
        return (
          <TerminalModal
            key={modal.slug}
            open
            active={tabActive}
            movable
            portalContainerRef={planeRef}
            boundsRef={planeRef}
            initialPosition={{ x: modal.x, y: modal.y }}
            enterOrigin={
              modal.originX != null && modal.originY != null
                ? { x: modal.originX, y: modal.originY }
                : undefined
            }
            onPositionChange={pos => {
              setWikiNodeModals(prev => prev.map(item => (
                item.slug === modal.slug ? { ...item, x: pos.x, y: pos.y } : item
              )))
            }}
            title={node.title}
            size="sm"
            zIndex={APP_OVERLAY_MODAL_Z + 10 + index}
            onClose={() => setWikiNodeModals(prev => prev.filter(item => item.slug !== modal.slug))}
          >
            <div className="wiki-graph-node-page">
              <p className="wiki-graph-node-page__type">
                {t(wikiTypeLabelKey(node.type))}
              </p>
              <div className="wiki-graph-node-page__body">
                <AiMarkdown content={formatWikiPageBodyForHuman(node.body ?? '')} />
              </div>
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
