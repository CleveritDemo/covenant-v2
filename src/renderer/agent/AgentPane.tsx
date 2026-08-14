import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ClipboardEvent, DragEvent } from 'react'
import type {
  AgentCliProvider,
  AgentPaneMeta,
  AgentPermissionMode,
} from '@shared/tabSession'
import type {
  AgentChatEntry,
  AgentChatImage,
  AgentCliImageAttachment,
  AgentCliStartRequest,
  AgentCliUiEvent,
} from '@shared/agentCliTypes'
import type { TabContext } from '@shared/tabContext'
import {
  extractTabContextUpdates,
  defaultAssignedContextIds,
  resolveTurnContextsRefreshing,
} from '@shared/tabContext'
import {
  LOOP_INTERVAL_PRESETS,
  MAX_AGENT_LOOP_ITERATIONS,
  stripLoopDoneMarker,
} from '@shared/agentLoop'
import { buildModeHandoffPrompt } from '@shared/agentModeHandoff'
import {
  applyAgentIdentityDraft,
  type AgentIdentityDraft,
  normalizeAgentRules,
} from '@shared/agentIdentity'
import { pulseWorkspaceTag } from '@shared/pulseEvents'
import {
  DEFAULT_THREAD_ID,
  deleteThread,
  newThread,
  sanitizeThreadState,
  threadPatch,
  touchActiveThread,
} from '@shared/agentThreads'
import { buildRunKey } from '@shared/agentRunKey'
import { normalizeAgentSlug, isAgentOwnResultContext, withCatalogAgentResultContexts } from '@shared/projectAgentCatalog'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import {
  orchestrationAwaitingSignature,
  type OrchestrationAwaitingView,
} from '@shared/orchestrationAwaiting'
import type {
  DelegateRequest,
  DelegateResult,
  OrchestrationAgentRef,
} from '@shared/agentOrchestration'
import {
  MAX_ORCHESTRATION_ROUNDS,
  coordinationCanDelegate,
  resolveOrchestrationMaxRounds,
  resolveOrchestrationWorkStyle,
} from '@shared/agentOrchestration'
import { resolveOrchestrationJobIdForTurn } from '@shared/orchestrationJobs'
import { useT } from '@i18n/useT'
import { playAgentFinishSound } from '../uiSounds'
import { ConfirmTerminalModal } from '../components/ConfirmTerminalModal'
import { createPlaneStatusThrottler } from './planeStatusThrottle'
import { shouldResumeCliSessionForTurn } from './shouldResumeCliSessionForTurn'
import { TabContextsModal } from './TabContextsModal'
import { AgentConfigModal } from './AgentConfigModal'
import type { DelegateToPeerAgent } from './AgentDelegateToPolicyEditor'
import { AgentLoopIntervalModal } from './AgentLoopIntervalModal'
import { AgentPaneMessages } from './AgentPaneMessages'
import { useJiraMention } from '../workspace/useJiraMention'
import { jiraDraftFromKey } from './TabContextFormModal'
import type { JiraIssueRef } from '@shared/jiraIssue'
import { AgentPaneFooter } from './AgentPaneFooter'
import type { AgentChatBubblesHandle } from './AgentChatBubbles'
import { QueuedTurnEditModal } from './QueuedTurnEditModal'
import {
  canDrainAgentQueue,
  canStartHumanTurnNow as computeCanStartHumanTurnNow,
  isAgentHumanInputBlocked,
  shouldShowComposerStop,
} from './agentInputGuards'
import {
  filterQueuedTurnsAfterOrchestrationAbort,
  filterQueuedTurnsAfterSingleDelegationAbort,
} from '../orchestrationAbort'
import {
  attachmentsToPendingImages,
  blobToBase64,
  blobToThumbnailDataUrl,
  extensionForMime,
  imagesFromClipboard,
  materializeClipboardImage,
  MAX_PENDING_IMAGES,
  type ComposerPendingImage,
} from './composerImages'
import {
  clearActiveParentDelegation,
  peekActiveParentDelegation,
  rememberActiveParentDelegation,
} from './activeParentDelegation'
import { decideParentDelegationNotify } from './parentDelegationNotify'
import { canApplyDeferredNewThread, shouldDeferNewThread } from './newThreadIntent'
import {
  workspaceContextBody,
  type WorkspaceContextBodyScope,
} from '@shared/orgWorkspaceContent'
import { filterContextIdsAfterDiscover } from '@shared/orgWorkspaceLocalSync'
import { agentChatRefFor } from '@shared/agentChatPersistence'
import { buildAgentTurnContextPayload } from './agentTurnContextPayload'
import { contextsToRematerializeAfterTurn } from './contextsToRematerializeAfterTurn'
import { mergeQueuedTurns } from './mergeQueuedTurns'
import {
  appendLaneText,
  endLane,
  getLane,
  setLaneActivity,
  startLane,
  type LaneState,
} from './paneThreadLanes'
import { useAiMessagesFollowScroll } from '../components/ai/useAiMessagesFollowScroll'
import { mcpConfigLabelFor, mcpsNeedingAuth } from '@shared/mcpContext'
import { mcpConnectHint } from '@shared/mcpProbe'
import { agentCliSpec } from '@shared/agentCliProviders'
import { MAX_VISIBLE_QUEUED_TURNS } from '@shared/planeHumanSendFifo'
import { Button } from '../components/ui'
import './AgentPane.css'

/** Reintentos silenciosos si el CLI cierra sin texto antes de mostrar el error. */
const EMPTY_RESPONSE_MAX_RETRIES = 3
/** Alto máximo del composer en líneas visibles antes de scroll interno. */
const MAX_COMPOSER_ROWS = 8

function resizeComposerTextarea(el: HTMLTextAreaElement): void {
  el.style.height = 'auto'
  const styles = getComputedStyle(el)
  const lineHeight = parseFloat(styles.lineHeight) || 18
  const padY = (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0)
  const maxH = lineHeight * MAX_COMPOSER_ROWS + padY
  el.style.height = `${Math.min(el.scrollHeight, maxH)}px`
}

type PendingImage = ComposerPendingImage

/** Subtarea originada por un orquestador (preferSend / FIFO / cola local). */
export interface PlaneSendDelegation {
  id: string
  fromPaneId: string
  toAgentId: string
  orchestrationJobId: string
  threadId?: string
  cwd?: string
}

/** Mensaje escrito mientras la IA trabajaba; se envía solo al liberarse el turno. */
interface QueuedTurn {
  id: string
  text: string
  images: PendingImage[]
  /** Se encoló un turno de loop: al drenarlo sigue siendo de loop. */
  viaLoop?: boolean
  /** Contextos adjuntos solo a este turno; se encolan con él. */
  extraContextIds?: string[]
  orchestrationFollowUp?: boolean
  allowDelegations?: boolean
  /** Turbo: follow-up / redelegación anclada a este job. */
  orchestrationJobId?: string
  delegation?: PlaneSendDelegation
}

export interface AgentPreferSend {
  text: string
  images?: AgentCliImageAttachment[]
  /** Si false, no enfoca la ventana del pane (p. ej. cadenas en background). */
  focusPane?: boolean
  /** Lo despachó una cadena de loop del plano, no una persona. */
  viaLoop?: boolean
  /** Contextos adjuntos a este turno desde el composer (no van al catálogo). */
  extraContextIds?: string[]
  /** Follow-up de orquestación (no resetea oleadas). */
  orchestrationFollowUp?: boolean
  /** Si false, el host prohíbe nuevas delegaciones en este turno. */
  allowDelegations?: boolean
  /** Turbo: job dueño del follow-up. */
  orchestrationJobId?: string
  /** Subtarea originada por un orquestador. */
  delegation?: PlaneSendDelegation
}

interface Props {
  paneId: string
  meta: AgentPaneMeta
  /** Carpeta del proyecto de la pestaña (única fuente de cwd del agente). */
  cwd: string
  /**
   * Si está presente, el turno usa este cwd (worktree) en vez de la carpeta del
   * proyecto. SOLO afecta al spawn del CLI (`startAgentTurn`): contextos, results
   * y catálogo de agentes en disco siguen resolviéndose contra `cwd` (base), porque
   * `.gravity/` vive en la carpeta del proyecto, no en el worktree.
   */
  cwdOverride?: string
  /** Sube al remapear results por rename de slug (fuerza rediscovery). */
  contextsRevision?: number
  /** El catálogo de contextos del proyecto cambió en disco (p. ej. results creado). */
  onProjectContextsChanged?: () => void
  tabActive: boolean
  isActivePane: boolean
  /** Ventana del agente abierta en el plano (no mini). Dispara scroll al fondo. */
  windowOpen?: boolean
  /** Mismo tamaño tipográfico que las terminales (`config.fontSize`). */
  fontSize: number
  /** Sonidos del sistema (fin de agente / dictado). */
  systemSoundsEnabled?: boolean
  onMetaChange: (
    meta: AgentPaneMeta | ((previous: AgentPaneMeta) => AgentPaneMeta),
  ) => void | Promise<boolean>
  onRequestPaneFocus: () => void
  onClosePane?: () => void
  onBusyChange?: (busy: boolean) => void
  /** Estado para el mapa 2D del plano (preview / satélites). */
  onPlaneStatusChange?: (status: AgentPlaneStatus) => void
  /** Registra el toggle de loop para el chat del plano (null al desmontar). */
  onPlaneLoopToggleReady?: (toggle: (() => void) | null) => void
  /** Controles de cola (quitar / editar) para el composer del plano. */
  onPlaneQueueControlsReady?: (controls: AgentPlaneQueueControls | null) => void
  /** Especialistas visibles para un orquestador (cada turno). */
  getOrchestrationAgents?: () => OrchestrationAgentRef[]
  /** Otros agentes del tab (config delegateTo / exclusiones). */
  peerAgents?: DelegateToPeerAgent[]
  /** Catálogo de agentes del proyecto (cara de las filas de results). */
  projectAgents?: ProjectAgentDefinition[]
  /**
   * Catálogo de contextos del tab (App). En org es el SSOT en memoria;
   * en personal suele coincidir con el discover de disco.
   */
  tabContexts?: TabContext[]
  /** Workspace org: contexts se borran/crean vía backend, no disco. */
  orgWorkspace?: { slug: string; workspaceId: string }
  /** El CLI del orquestador emitió delegaciones (jobId = dueño del turno en turbo). */
  onOrchestratorDelegations?: (
    delegations: DelegateRequest[],
    orchestrationJobId?: string,
  ) => void
  /** Stop del orquestador: cancelar subtareas pendientes originadas aquí. */
  onOrchestratorStop?: () => void
  /** Stop por fila en Waiting: cancela solo esa delegación. */
  onAbortDelegation?: (delegationId: string) => void
  /** Un turno delegado en este pane terminó. */
  onDelegationTurnComplete?: (result: DelegateResult) => void
  /** Pedido humano nuevo: reinicia el contador de oleadas de orquestación. */
  onOrchestrationUserTurn?: () => void
  /** Oleada actual / tope para el prompt del orquestador. */
  getOrchestrationRound?: () => {
    round: number
    maxRounds: number
    jobId?: string
    workStyle?: 'linear' | 'turbo'
  }
  /** Pedido externo: abrir modal de configuración (p. ej. desde el plano). */
  preferOpenConfig?: boolean
  onPreferOpenConfigConsumed?: () => void
  /** Tras abrir el modal de config (bloquea expand del mini). */
  onConfigOpen?: () => void
  /** Tras cerrar el modal de config (evita click-through que expande el mini). */
  onConfigClose?: () => void
  /** Pedido externo: abrir editor de un contexto (p. ej. clic en satélite del plano). */
  preferOpenContextId?: string | null
  onPreferOpenContextConsumed?: () => void
  /** Pedido externo: enviar un prompt (y opcionalmente imágenes) desde el plano. */
  preferSend?: AgentPreferSend | null
  onPreferSendConsumed?: () => void
  /** Pedido externo: detener el turno/bucle desde el composer del plano. */
  preferStop?: boolean
  onPreferStopConsumed?: () => void
  /** Pedido externo: arrancar el loop (p. ej. encadenamiento desde otro agente). */
  preferStartLoop?: { objective?: string } | null
  onPreferStartLoopConsumed?: () => void
  /** Pedido externo: abrir el modal de crear/iniciar loop. */
  preferCreateLoop?: boolean
  onPreferCreateLoopConsumed?: () => void
  /** Pedido externo: pedir confirmación para borrar la conversación activa. */
  preferClearConversation?: boolean
  onPreferClearConversationConsumed?: () => void
  /** Pedido externo: abrir una conversación nueva (no borra la actual). */
  preferNewThread?: boolean
  onPreferNewThreadConsumed?: () => void
  /**
   * El pane participa en una cadena Loops running/waiting:
   * el botón de loop del chat debe verse encendido (mismo estado visual).
   */
  chainLoopActive?: boolean
  /** El orquestador espera subtareas (Stop / drain; ya no bloquea teclear). */
  awaitingDelegations?: boolean
  /** Estilo efectivo desde App (evita meta stale en turbo). */
  orchestrationWorkStyle?: 'linear' | 'turbo'
  /** Detalle de ola (done/total + filas) mientras awaitingDelegations. */
  orchestrationAwaiting?: OrchestrationAwaitingView | null
  /** Este pane ejecuta una subtarea pendiente para un orquestador. */
  delegationWorkActive?: boolean
  /** App aún tiene FIFO/preferSend de orquestación para este pane. */
  systemFollowUpsPending?: boolean
  /** Pedido externo: detener cadenas que incluyen este pane (p. ej. stop en waiting). */
  onChainLoopStop?: () => void
  paneReorder?: {
    enabled: boolean
    isGrabbed: boolean
    onDragHandleStart: (event: DragEvent) => void
    onDragHandleEnd: () => void
  }
  registerShortcutCloseInterceptor?: (openConfirm: () => void) => () => void
}

/** Hilos con carril vivo o turno activo del pane; orden estable, sin duplicados. */
export function collectRunningThreadIds(
  lanes: ReadonlyMap<string, LaneState>,
  activeThreadId: string,
  paneBusy: boolean,
): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const [threadId, lane] of lanes) {
    if (!lane.busy || seen.has(threadId)) continue
    seen.add(threadId)
    ids.push(threadId)
  }
  if (paneBusy && !seen.has(activeThreadId)) {
    ids.push(activeThreadId)
  }
  return ids
}

/** Une los hilos reportados por cada pane al mapa de delegaciones pendientes. */
export function mergePaneReportedRunningThreadIds(
  byPane: Map<string, Set<string>>,
  paneStatuses: Record<string, { runningThreadIds?: readonly string[] } | undefined>,
): void {
  for (const [paneId, status] of Object.entries(paneStatuses)) {
    const reported = status?.runningThreadIds
    if (!reported?.length) continue
    let set = byPane.get(paneId)
    if (!set) {
      set = new Set()
      byPane.set(paneId, set)
    }
    for (const threadId of reported) {
      set.add(threadId)
    }
  }
}

export interface AgentPlaneStatus {
  busy: boolean
  activity: string
  lastSnippet: string
  contexts: Array<{ id: string; name: string; kind: string }>
  /** Conversación user/assistant para el chat del plano (sin system). */
  messages: AgentChatEntry[]
  activeAssistantId: string | null
  enteringIds: string[]
  materializingIds: string[]
  settlingId: string | null
  awaitingDelegations: boolean
  orchestrationAwaiting: OrchestrationAwaitingView | null
  delegationWorkActive: boolean
  orchestratorBusy: boolean
  /** Estilo de trabajo del orquestador (para placeholder/cola del plano). */
  orchestrationWorkStyle?: 'linear' | 'turbo'
  loopMode: boolean
  loopActive: boolean
  /** Solo el loop local del chat (no cadenas del modal Loops). */
  localLoopActive: boolean
  /**
   * Motivo del último cierre de turno (busy true→false).
   * La orquestación de cadenas solo avanza si es `completed`.
   */
  turnCloseReason: 'completed' | 'aborted' | null
  /** Última causa de fin de loop (para encadenar nests solo en done/max). */
  loopEndReason: 'done' | 'max' | 'stopped' | null
  queuedTurns: Array<{
    id: string
    text: string
    images: Array<{ id: string; previewUrl: string; name: string }>
    orchestrationFollowUp?: boolean
    delegation?: {
      id: string
      fromPaneId: string
      toAgentId: string
      orchestrationJobId: string
    }
  }>
  /** Hay historial, cola o sesión CLI que se pueden limpiar. */
  canClearConversation: boolean
  /** Hilos con carril vivo o turno activo del pane (para dot del selector). */
  runningThreadIds: string[]
}

export interface AgentPlaneQueueControls {
  remove: (id: string) => void
  update: (id: string, text: string) => void
  /** Fusiona los turnos humanos encolados (sin delegation/follow-up) en uno. */
  merge: () => void
  /** Quita subtareas del orquestador y follow-ups locales de ese pane. */
  cancelDelegationsFrom: (fromPaneId: string) => void
  /** Quita la subtarea con este delegationId (Stop por fila). */
  cancelDelegation: (delegationId: string) => void
}

function systemMessage(content: string): AgentChatEntry {
  return { id: crypto.randomUUID(), role: 'system', content }
}

export const AgentPane: React.FC<Props> = ({
  paneId,
  meta,
  cwd,
  cwdOverride,
  contextsRevision = 0,
  onProjectContextsChanged,
  tabActive,
  isActivePane,
  windowOpen = true,
  fontSize,
  systemSoundsEnabled = true,
  onMetaChange,
  onRequestPaneFocus,
  onClosePane,
  onBusyChange,
  onPlaneStatusChange,
  onPlaneLoopToggleReady,
  onPlaneQueueControlsReady,
  getOrchestrationAgents,
  peerAgents = [],
  projectAgents = [],
  tabContexts = [],
  orgWorkspace,
  onOrchestratorDelegations,
  onOrchestratorStop,
  onAbortDelegation,
  onDelegationTurnComplete,
  onOrchestrationUserTurn,
  getOrchestrationRound,
  preferOpenConfig = false,
  onPreferOpenConfigConsumed,
  onConfigOpen,
  onConfigClose,
  preferOpenContextId = null,
  onPreferOpenContextConsumed,
  preferSend = null,
  onPreferSendConsumed,
  preferStop = false,
  onPreferStopConsumed,
  preferStartLoop = null,
  onPreferStartLoopConsumed,
  preferCreateLoop = false,
  onPreferCreateLoopConsumed,
  preferClearConversation = false,
  onPreferClearConversationConsumed,
  preferNewThread = false,
  onPreferNewThreadConsumed,
  chainLoopActive = false,
  awaitingDelegations = false,
  orchestrationWorkStyle: orchestrationWorkStyleProp,
  orchestrationAwaiting = null,
  delegationWorkActive = false,
  systemFollowUpsPending = false,
  onChainLoopStop,
  paneReorder,
  registerShortcutCloseInterceptor,
}) => {
  const { t } = useT()
  const [messages, setMessages] = useState<AgentChatEntry[]>([])
  const [input, setInput] = useState('')
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [queuedTurns, setQueuedTurns] = useState<QueuedTurn[]>([])
  const [editingQueuedId, setEditingQueuedId] = useState<string | null>(null)
  const editingQueuedText = editingQueuedId
    ? (queuedTurns.find(item => item.id === editingQueuedId)?.text ?? '')
    : ''
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [activity, setActivity] = useState('')
  const [confirmClose, setConfirmClose] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [contextsOpen, setContextsOpen] = useState(false)
  const [loopOpen, setLoopOpen] = useState(false)
  const [loopIntervalModalOpen, setLoopIntervalModalOpen] = useState(false)
  const [loopActive, setLoopActive] = useState(false)
  const orchestratorBusy = coordinationCanDelegate(meta.coordination) && busy
  const orchestrationWorkStyle = orchestrationWorkStyleProp
    ?? resolveOrchestrationWorkStyle(meta.coordination, meta.orchestrationWorkStyle)
  const humanInputBlocked = isAgentHumanInputBlocked({ loopActive })
  const canStartHumanTurnNow = computeCanStartHumanTurnNow({
    busy,
    loopActive,
    awaitingDelegations,
    delegationWorkActive,
    systemFollowUpsPending,
    orchestrationWorkStyle,
  })
  const [loopEndReason, setLoopEndReason] = useState<'done' | 'max' | 'stopped' | null>(null)
  const [loopIteration, setLoopIteration] = useState(0)
  const [turnCloseReason, setTurnCloseReason] = useState<'completed' | 'aborted' | null>(null)
  /**
   * Catálogo vivo de contextos para este pane.
   * Personal y org local-first: discover de `.gravity/*.md`.
   */
  const [diskContexts, setDiskContexts] = useState<TabContext[]>([])
  /** MCPs permitidos que el probe marca como needsAuth (banner del pane). */
  const [mcpAuthNeeded, setMcpAuthNeeded] = useState<{ name: string; url?: string }[]>([])
  const [mcpAuthNotice, setMcpAuthNotice] = useState('')
  /** IDs que deben hacer pop-in; solo mensajes nuevos tras hidratar el chat. */
  const [enteringIds, setEnteringIds] = useState<ReadonlySet<string>>(() => new Set())
  /** Zoom de la burbuja de IA al materializar el primer token (no al crearla vacía). */
  const [materializingIds, setMaterializingIds] = useState<ReadonlySet<string>>(() => new Set())
  /** Tras el live: aterrizaje suave de vuelta a la posición normal. */
  const [settlingId, setSettlingId] = useState<string | null>(null)
  const knownMessageIdsRef = useRef<Set<string> | null>(null)
  /** Contenido previo por id: detecta el paso de vacío → primer token. */
  const messageContentLenRef = useRef<Map<string, number>>(new Map())
  const activeAssistantIdRef = useRef<string | null>(null)
  /** Estado espejo del ref: el chat del plano/panel necesita re-render al cambiar. */
  const [activeAssistantId, setActiveAssistantId] = useState<string | null>(null)
  /** Id del asistente del turno que acaba de cerrarse; acepta texto tardío tras done/EXIT. */
  const lastAssistantIdRef = useRef<string | null>(null)
  /** Evita procesar EXIT duplicado después de `done` (mismo turno). */
  const turnClosedRef = useRef(false)
  /** Generación del turno; EXIT rezagado no debe cerrar un turno más nuevo. */
  const turnGenRef = useRef(0)
  /** Último request CLI; sirve para reintentar respuesta vacía sin duplicar el user. */
  const lastTurnRequestRef = useRef<AgentCliStartRequest | null>(null)
  /** Reintentos ya hechos por emptyResponse en el turno actual. */
  const emptyResponseRetriesRef = useRef(0)
  /** Stop del usuario: el cierre diferido no debe reintentar ni mostrar emptyResponse. */
  const suppressEmptyHandlingRef = useRef(false)
  /** Chat hidratado; hasta entonces se encolan eventos CLI (remount durante stream). */
  const loadedRef = useRef(false)
  const pendingCliEventsRef = useRef<AgentCliUiEvent[]>([])
  const applyCliEventRef = useRef<(event: AgentCliUiEvent) => void>(() => undefined)
  const applyLaneCliEventRef = useRef<(threadId: string, event: AgentCliUiEvent) => void>(() => undefined)
  const completeTurnRef = useRef<(expectedGen?: number) => void>(() => undefined)
  const runLoopIterationRef = useRef<(iteration: number) => void>(() => undefined)
  const liveSettleTimerRef = useRef<number | null>(null)
  const planeStatusThrottlerRef = useRef(createPlaneStatusThrottler<AgentPlaneStatus>())
  const messagesRef = useRef(messages)
  const metaRef = useRef(meta)
  const diskContextsRef = useRef(diskContexts)
  const cwdRef = useRef(cwd)
  /** Override efímero (worktree) para el cwd del turno; ver prop `cwdOverride`. */
  const cwdOverrideRef = useRef(cwdOverride)
  const onMetaChangeRef = useRef(onMetaChange)
  const onProjectContextsChangedRef = useRef(onProjectContextsChanged)
  const busyRef = useRef(busy)
  const activityRef = useRef(activity)
  const loopActiveRef = useRef(false)
  /**
   * Petición diferida de nueva conversación: si el pane está busy, tiene una
   * delegación activa o está en settle, `startNewThread` la marca aquí y un
   * effect la aplica sin abortar cuando el pane vuelve a idle limpio.
   */
  const pendingNewThreadRef = useRef(false)
  const loopObjectiveRef = useRef('')
  const loopIterationRef = useRef(0)
  const loopDoneRef = useRef(false)
  const skipLoopContinueRef = useRef(false)
  const loopContinueTimerRef = useRef<number | null>(null)
  /** Pausa elegida en el modal antes de la siguiente iteración. */
  const loopContinueDelayMsRef = useRef<number>(LOOP_INTERVAL_PRESETS[0].ms)
  const [loopContinueDelayMs, setLoopContinueDelayMs] = useState<number>(LOOP_INTERVAL_PRESETS[0].ms)
  const contextWriteQueueRef = useRef<Promise<unknown>>(Promise.resolve())
  const discoveryHydratedRef = useRef(false)
  /** CWD al que pertenece diskContexts; impide reutilizar catálogo entre proyectos. */
  const discoveredCwdRef = useRef<string | null>(null)
  /** Tras migración de ids en disco, el próximo turno fuerza refresh del snapshot. */
  const forceContextFullRefreshRef = useRef(false)
  /**
   * Workspace org en un ref y no en las deps de `startTurn`: solo lo lee la
   * instrumentación al armar el request, y meterlo en las deps recrearía el
   * callback en cada cambio de pestaña sin ninguna otra razón.
   */
  const orgWorkspaceRef = useRef<string | null>(null)
  orgWorkspaceRef.current = pulseWorkspaceTag(orgWorkspace)
  /** Scope de caché de bodies notes (aislado por workspace org). */
  const orgBodyScope = useMemo((): WorkspaceContextBodyScope | undefined => {
    const slug = orgWorkspace?.slug?.trim()
    const workspaceId = orgWorkspace?.workspaceId?.trim()
    if (!slug || !workspaceId) return undefined
    return {
      slug,
      workspaceId,
      ...(cwd.trim() ? { localDir: cwd.trim() } : {}),
    }
  }, [cwd, orgWorkspace?.slug, orgWorkspace?.workspaceId])
  const orgBodyScopeRef = useRef(orgBodyScope)
  orgBodyScopeRef.current = orgBodyScope
  /** Transcript local por agentId+scope (sobrevive sync aunque cambie paneId). */
  const chatRef = useMemo(
    () => agentChatRefFor(
      {
        projectFolder: cwd,
        ...(orgWorkspace?.slug && orgWorkspace?.workspaceId
          ? { orgWorkspace: { slug: orgWorkspace.slug, workspaceId: orgWorkspace.workspaceId } }
          : {}),
      },
      meta.id,
      paneId,
    ),
    [cwd, meta.id, orgWorkspace?.slug, orgWorkspace?.workspaceId, paneId],
  )
  /** Tras resetear la sesión CLI por cambio de modo, el próximo turno lleva historial. */
  const pendingModeHandoffRef = useRef(false)
  /** ¿El turno en curso se queda con el `cliSessionId` que emita su CLI? */
  const adoptsCliSessionRef = useRef(true)
  /** Dedup de preferSend (mismo objeto no debe despachar dos veces). */
  const handledPreferSendRef = useRef<AgentPreferSend | null>(null)
  /**
   * Delegación abre un hilo nuevo en el mismo tick que el turno: no recargar
   * el chat ni tumbar busy/messages del stream que acaba de arrancar.
   */
  const retainLiveThreadIdRef = useRef<string | null>(null)
  /**
   * Delegación en vuelo (especialista / orch ejecutando subtarea del padre).
   * `awaitingNested`: si este pane emitió delegaciones anidadas dentro del
   * turno delegado, guardamos sus ids. Mientras haya entradas, mantenemos el
   * hold: el padre NO debe recibir `onDelegationTurnComplete` hasta que el
   * turno agregado del orquestador cierre sin nuevas emisiones. Reemplaza el
   * booleano `nestedDelegationsDispatchedThisTurnRef` con estado explícito.
   */
  type ActiveDelegationRuntime = {
    id: string
    fromPaneId: string
    toAgentId: string
    orchestrationJobId: string
    threadId?: string
    awaitingNested: Set<string>
  }
  const hydrateActiveParentDelegationForPane = (
    id: string,
    threadId?: string,
  ): ActiveDelegationRuntime | null => {
    const persisted = peekActiveParentDelegation(id, threadId ?? meta.activeThreadId)
    return persisted
      ? { ...persisted, awaitingNested: new Set<string>() }
      : null
  }
  const activeDelegationRef = useRef<ActiveDelegationRuntime | null>(
    hydrateActiveParentDelegationForPane(paneId),
  )
  /** Carriles de delegación en segundo plano (threadId → estado). */
  const lanesRef = useRef<Map<string, LaneState>>(new Map())
  const [lanesVersion, setLanesVersion] = useState(0)
  const laneDelegationRef = useRef<Map<string, ActiveDelegationRuntime>>(new Map())
  const onOrchestratorDelegationsRef = useRef(onOrchestratorDelegations)
  onOrchestratorDelegationsRef.current = onOrchestratorDelegations
  const onOrchestratorStopRef = useRef(onOrchestratorStop)
  onOrchestratorStopRef.current = onOrchestratorStop
  const onAbortDelegationRef = useRef(onAbortDelegation)
  onAbortDelegationRef.current = onAbortDelegation
  const onDelegationTurnCompleteRef = useRef(onDelegationTurnComplete)
  onDelegationTurnCompleteRef.current = onDelegationTurnComplete
  const emitDelegationResult = useCallback((
    delegation: Pick<
      ActiveDelegationRuntime,
      'id' | 'fromPaneId' | 'toAgentId' | 'orchestrationJobId' | 'threadId'
    > | null | undefined,
    payload: {
      status: DelegateResult['status']
      summary: string
      toThreadId?: string
    },
    warnContext: string,
  ): void => {
    if (!delegation) return
    const fromPaneId = delegation.fromPaneId?.trim()
    const orchestrationJobId = delegation.orchestrationJobId?.trim()
    if (!fromPaneId || !orchestrationJobId) {
      console.warn('[orchestration] delegation result omitted', {
        reason: 'missing_sender',
        context: warnContext,
        delegationId: delegation.id,
      })
      return
    }
    const toThreadId = payload.toThreadId?.trim()
      || delegation.threadId?.trim()
      || undefined
    onDelegationTurnCompleteRef.current?.({
      id: delegation.id,
      fromPaneId,
      orchestrationJobId,
      status: payload.status,
      summary: payload.summary,
      toAgentId: delegation.toAgentId,
      toPaneId: paneId,
      ...(toThreadId ? { toThreadId } : {}),
    })
  }, [paneId])
  const onOrchestrationUserTurnRef = useRef(onOrchestrationUserTurn)
  onOrchestrationUserTurnRef.current = onOrchestrationUserTurn
  const getOrchestrationAgentsRef = useRef(getOrchestrationAgents)
  getOrchestrationAgentsRef.current = getOrchestrationAgents
  const getOrchestrationRoundRef = useRef(getOrchestrationRound)
  getOrchestrationRoundRef.current = getOrchestrationRound
  const scrollRef = useRef<HTMLDivElement>(null)
  const bubblesRef = useRef<AgentChatBubblesHandle>(null)
  const composerInputRef = useRef<HTMLTextAreaElement>(null)
  /**
   * Issues mencionadas en el mensaje que se está escribiendo. Son contextos del
   * turno (como los chips del plano), no del agente: se envían y se limpian.
   */
  const [pendingJiraContextIds, setPendingJiraContextIds] = useState<string[]>([])
  /** Conversación viva del pane: fija de qué archivo se lee y a cuál se escribe. */
  const activeThreadId = meta.activeThreadId ?? DEFAULT_THREAD_ID
  const runKey = buildRunKey(paneId, activeThreadId)
  const prevActiveThreadIdRef = useRef(activeThreadId)
  messagesRef.current = messages
  metaRef.current = meta
  diskContextsRef.current = diskContexts
  cwdRef.current = cwd
  cwdOverrideRef.current = cwdOverride
  onMetaChangeRef.current = onMetaChange
  onProjectContextsChangedRef.current = onProjectContextsChanged
  busyRef.current = busy
  activityRef.current = activity
  loopActiveRef.current = loopActive
  loopIterationRef.current = loopIteration
  const projectAgentsRef = useRef(projectAgents)
  projectAgentsRef.current = projectAgents
  const peerAgentsRef = useRef(peerAgents)
  peerAgentsRef.current = peerAgents

  /** Catálogo UI = contextos base + agentResult de cada agente vivo. */
  const commitContextsCatalog = useCallback((contexts: TabContext[]): TabContext[] => {
    const merged = withCatalogAgentResultContexts(contexts, projectAgentsRef.current)
    setDiskContexts(merged)
    diskContextsRef.current = merged
    return merged
  }, [])

  const stableOnMetaChange = useCallback((
    next: AgentPaneMeta | ((previous: AgentPaneMeta) => AgentPaneMeta),
  ): void | Promise<boolean> => onMetaChangeRef.current(next), [])

  const clearLoopTimer = useCallback((): void => {
    if (loopContinueTimerRef.current != null) {
      window.clearTimeout(loopContinueTimerRef.current)
      loopContinueTimerRef.current = null
    }
  }, [])

  /** Activa el aterrizaje suave (solo CSS) antes de quitar --live. */
  const beginLiveSettle = useCallback((id: string | null): void => {
    if (!id) return
    if (liveSettleTimerRef.current != null) {
      window.clearTimeout(liveSettleTimerRef.current)
      liveSettleTimerRef.current = null
    }
    setSettlingId(id)
  }, [])

  /** Carpeta BASE del proyecto: usar para todo lo relacionado con `.gravity/` (contexts, results, catálogo de agentes). Nunca el worktree. */
  /**
   * Mención de issues en el chat propio del pane. Misma mecánica que el chat
   * del plano — se extrajo a `useJiraMention` justo para no tener dos copias
   * que diverjan a la primera corrección.
   */
  const attachJiraMention = useCallback((issue: JiraIssueRef): void => {
    const context = jiraDraftFromKey(issue.key)
    if (!context || !cwd.trim()) return
    void window.api.materializeTabContext({ context, cwd }).then(result => {
      if (!result.ok) return
      setPendingJiraContextIds(previous => (
        previous.includes(context.id) ? previous : [...previous, context.id]
      ))
    }).catch(() => {
      // Sin `.md` en disco no hay nada real que adjuntar.
    })
  }, [cwd])

  const jiraMention = useJiraMention({
    cwd,
    value: input,
    onValueChange: setInput,
    inputRef: composerInputRef,
    onPicked: attachJiraMention,
  })

  const resolveWorkingCwd = useCallback(async (): Promise<string> => {
    return cwdRef.current.trim()
  }, [])

  /**
   * Cwd del TURNO (override-aware): si hay `cwdOverride` (worktree), lo usa; si no,
   * cae al cwd base. Úsalo SOLO para el spawn del CLI (`startAgentTurn`), nunca para
   * contexts/results/catálogo de agentes (esos siempre resuelven contra la base).
   */
  const resolveTurnCwd = useCallback(async (): Promise<string> => {
    const override = cwdOverrideRef.current?.trim()
    if (override) return override
    return cwdRef.current.trim()
  }, [])

  const applyDiscoveredContexts = useCallback((
    discovered: TabContext[],
    idRemap?: Record<string, string>,
  ): void => {
    commitContextsCatalog(discovered)
    const discoveredIds = new Set(
      withCatalogAgentResultContexts(discovered, projectAgentsRef.current).map(context => context.id),
    )
    const remap = idRemap ?? {}
    // Discover ya reescribió `.gravity/agents` vía idRemap: no upsertar desde
    // meta en memoria (puede estar stale y pisar el SSOT del disco).
    if (Object.keys(remap).length > 0) {
      discoveryHydratedRef.current = true
      return
    }
    const mapId = (id: string): string => remap[id] ?? id
    // Derivar nextIds desde `previous` del updater (no metaRef): evita que un
    // discover en vuelo pise un toggle de contexto concurrente.
    void stableOnMetaChange(previous => {
      let nextIds: string[]
      if (!discoveryHydratedRef.current) {
        discoveryHydratedRef.current = true
        nextIds = previous.contextIds == null
          ? defaultAssignedContextIds(discovered)
          // Conserva results asignados aunque aún no estén en discoveredIds.
          : filterContextIdsAfterDiscover(
            previous.contextIds.map(mapId),
            discoveredIds,
          )
      } else {
        // Conserva results asignados aunque este discover aún no los liste.
        nextIds = filterContextIdsAfterDiscover(
          (previous.contextIds ?? []).map(mapId),
          discoveredIds,
        )
      }
      const seen = new Set<string>()
      nextIds = nextIds.filter(id => {
        if (seen.has(id)) return false
        seen.add(id)
        return true
      })
      const prev = previous.contextIds ?? []
      if (
        nextIds.length === prev.length
        && nextIds.every((id, index) => id === prev[index])
      ) {
        return previous
      }
      return { ...previous, contextIds: nextIds }
    })
  }, [commitContextsCatalog, stableOnMetaChange])

  /**
   * Anota qué cwd se va a descubrir. **No vacía el catálogo**: hacerlo antes de
   * saber si el descubrimiento va a funcionar deja el pane sin contextos si
   * luego falla — y desde que `dispatchMessage` espera a `refreshDiskContexts()`
   * antes de resolver el turno, ese hueco viaja al modelo como «este agente no
   * tiene contextos», que es peor que un catálogo un instante desactualizado.
   * El reemplazo ocurre solo en el camino de éxito (`applyDiscoveredContexts`).
   *
   * Devuelve si el cwd cambió, para que el llamador sí pueda vaciar en el único
   * caso donde no hay catálogo posible: cwd vacío.
   */
  const prepareContextDiscovery = useCallback((resolvedCwd: string): boolean => {
    const next = resolvedCwd.trim()
    if (discoveredCwdRef.current === next) return false
    discoveredCwdRef.current = next
    return true
  }, [])

  const clearDiskContexts = useCallback((): void => {
    setDiskContexts([])
    diskContextsRef.current = []
  }, [])

  const refreshDiskContexts = useCallback(async (): Promise<void> => {
    const resolvedCwd = await resolveWorkingCwd()
    // Siempre descubrir (migración canónica en disco), aunque el cwd no cambie.
    const cwdChanged = prepareContextDiscovery(resolvedCwd)
    if (!resolvedCwd) {
      // Sin cwd no hay `.md` que leer: acá sí corresponde vaciar.
      if (cwdChanged) clearDiskContexts()
      return
    }
    const result = await window.api.discoverTabContexts({ cwd: resolvedCwd })
    // Descubrimiento fallido: se conserva el catálogo anterior.
    if (!result.ok) return
    if (result.contextsMigrated) forceContextFullRefreshRef.current = true
    applyDiscoveredContexts(result.contexts, result.idRemap)
  }, [applyDiscoveredContexts, clearDiskContexts, prepareContextDiscovery, resolveWorkingCwd])

  useEffect(() => {
    if (retainLiveThreadIdRef.current === activeThreadId) {
      retainLiveThreadIdRef.current = null
      loadedRef.current = true
      setLoaded(true)
      return
    }
    retainLiveThreadIdRef.current = null
    const liveLane = getLane(lanesRef.current, activeThreadId)
    if (liveLane) {
      loadedRef.current = false
      pendingCliEventsRef.current = []
      setLoaded(false)
      knownMessageIdsRef.current = null
      setEnteringIds(new Set())
      setMaterializingIds(new Set())
      setSettlingId(null)
      messageContentLenRef.current = new Map()
      setMessages(liveLane.messages)
      setBusy(liveLane.busy)
      setActivity(liveLane.activity)
      if (liveLane.busy) {
        activeAssistantIdRef.current = liveLane.assistantId
        setActiveAssistantId(liveLane.assistantId)
        turnClosedRef.current = false
      } else {
        activeAssistantIdRef.current = null
        setActiveAssistantId(null)
      }
      loadedRef.current = true
      setLoaded(true)
      return
    }
    let cancelled = false
    loadedRef.current = false
    pendingCliEventsRef.current = []
    setLoaded(false)
    knownMessageIdsRef.current = null
    setEnteringIds(new Set())
    setMaterializingIds(new Set())
    setSettlingId(null)
    messageContentLenRef.current = new Map()
    if (liveSettleTimerRef.current != null) {
      window.clearTimeout(liveSettleTimerRef.current)
      liveSettleTimerRef.current = null
    }
    clearLoopTimer()
    loopActiveRef.current = false
    loopDoneRef.current = false
    discoveryHydratedRef.current = false
    discoveredCwdRef.current = null
    setDiskContexts([])
    diskContextsRef.current = []
    setLoopOpen(false)
    setLoopActive(false)
    setLoopEndReason(null)
    setLoopIteration(0)
    setBusy(false)
    setActivity('')
    activeAssistantIdRef.current = null
    setActiveAssistantId(null)
    lastAssistantIdRef.current = null
    turnClosedRef.current = false
    void Promise.all([
      window.api.loadAgentChat(chatRef, activeThreadId),
      window.api.isAgentTurnActive(runKey).catch(() => false),
    ]).then(([entries, turnActive]) => {
      if (cancelled) return
      let nextMessages = entries
      if (turnActive) {
        // Remount durante stream (split/resize de layout): reenganchar al turno vivo.
        const lastAssistant = [...entries].reverse().find(message => message.role === 'assistant')
        if (lastAssistant) {
          activeAssistantIdRef.current = lastAssistant.id
          lastAssistantIdRef.current = lastAssistant.id
          setActiveAssistantId(lastAssistant.id)
        } else {
          const id = crypto.randomUUID()
          activeAssistantIdRef.current = id
          lastAssistantIdRef.current = id
          setActiveAssistantId(id)
          nextMessages = [...entries, { id, role: 'assistant', content: '' }]
        }
        turnClosedRef.current = false
        setBusy(true)
      }
      setMessages(nextMessages)
      loadedRef.current = true
      setLoaded(true)
      const pending = pendingCliEventsRef.current
      pendingCliEventsRef.current = []
      for (const event of pending) applyCliEventRef.current(event)
    }).catch(() => {
      if (!cancelled) {
        loadedRef.current = true
        setLoaded(true)
      }
    })
    return () => { cancelled = true }
  }, [activeThreadId, chatRef, clearLoopTimer, paneId])

  useEffect(() => {
    // `loadedRef` (síncrono) y no solo `loaded` (estado): al cambiar de thread
    // este effect corre en el mismo commit que el de carga, con los mensajes
    // del thread anterior. Sin el ref los guardaría bajo el thread nuevo.
    if (!loaded || !loadedRef.current) return
    if (getLane(lanesRef.current, activeThreadId)?.busy) return
    window.api.saveAgentChat(chatRef, activeThreadId, messages)
  }, [activeThreadId, chatRef, loaded, messages])

  useLayoutEffect(() => {
    if (!loaded) return
    const currentIds = messages.map(message => message.id)
    if (knownMessageIdsRef.current === null) {
      knownMessageIdsRef.current = new Set(currentIds)
      for (const message of messages) {
        messageContentLenRef.current.set(message.id, message.content.length)
      }
      return
    }
    // Solo animar al aparecer: mensajes del usuario siempre; el asistente
    // vacío espera al primer token (materialize), no al crearse el placeholder.
    const fresh = currentIds.filter(id => {
      if (knownMessageIdsRef.current!.has(id)) return false
      const message = messages.find(entry => entry.id === id)
      if (!message) return false
      if (message.role === 'assistant' && !message.content) return false
      return true
    })
    knownMessageIdsRef.current = new Set(currentIds)

    const newlyMaterialized: string[] = []
    for (const message of messages) {
      const previousLen = messageContentLenRef.current.get(message.id) ?? 0
      const nextLen = message.content.length
      if (
        message.role === 'assistant' &&
        previousLen === 0 &&
        nextLen > 0
      ) {
        newlyMaterialized.push(message.id)
      }
      messageContentLenRef.current.set(message.id, nextLen)
    }
    // Limpiar ids que ya no existen.
    for (const id of [...messageContentLenRef.current.keys()]) {
      if (!knownMessageIdsRef.current.has(id)) messageContentLenRef.current.delete(id)
    }

    if (fresh.length) {
      setEnteringIds(previous => {
        const next = new Set(previous)
        for (const id of fresh) next.add(id)
        return next
      })
    }
    if (newlyMaterialized.length) {
      setMaterializingIds(previous => {
        const next = new Set(previous)
        for (const id of newlyMaterialized) next.add(id)
        return next
      })
    }
  }, [loaded, messages])

  // Solo sigue el fondo si el usuario está cerca del final; si sube a leer
  // historial, no le robamos el scroll (antes forzaba scrollHeight siempre).
  // `windowOpen`: al pasar de mini → grande hace snap al fondo (layout real).
  const { nearBottom, forceFollow: snapFollowScroll } = useAiMessagesFollowScroll(
    messages,
    windowOpen,
    scrollRef,
    `${activity}\0${queuedTurns.length}`,
  )

  const forceFollow = useCallback((): void => {
    snapFollowScroll()
    bubblesRef.current?.scrollToEnd()
  }, [snapFollowScroll])

  const scrollChatToBottom = (): void => {
    forceFollow()
  }

  // Tras el zoom de apertura el alto del contenedor sigue cambiando unos frames.
  const wasWindowOpenRef = useRef(false)
  useEffect(() => {
    const becameOpen = windowOpen && !wasWindowOpenRef.current
    wasWindowOpenRef.current = windowOpen
    if (!becameOpen) return
    forceFollow()
    const t1 = window.setTimeout(() => forceFollow(), 100)
    const t2 = window.setTimeout(() => forceFollow(), 450)
    const t3 = window.setTimeout(() => forceFollow(), 1150)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
    }
  }, [windowOpen, forceFollow])

  // Crece con cada salto de línea (Shift+Enter) hasta MAX_COMPOSER_ROWS.
  useLayoutEffect(() => {
    const el = composerInputRef.current
    if (el) resizeComposerTextarea(el)
  }, [input])

  // El aterrizaje es puro CSS (fade del anillo + escala); aquí solo se
  // limpia la clase --landing cuando termina. Antes se combinaba un FLIP
  // en JS con transiciones CSS y ambos competían: era el origen del salto.
  useLayoutEffect(() => {
    if (!settlingId) return
    if (liveSettleTimerRef.current != null) {
      window.clearTimeout(liveSettleTimerRef.current)
    }
    const settled = settlingId
    liveSettleTimerRef.current = window.setTimeout(() => {
      liveSettleTimerRef.current = null
      setSettlingId(current => current === settled ? null : current)
    }, 600)
    return () => {
      if (liveSettleTimerRef.current != null) {
        window.clearTimeout(liveSettleTimerRef.current)
        liveSettleTimerRef.current = null
      }
    }
  }, [settlingId])

  useEffect(() => {
    onBusyChange?.(busy)
    return () => onBusyChange?.(false)
  }, [busy, onBusyChange])

  useEffect(() => {
    if (!preferOpenConfig) return
    onConfigOpen?.()
    setConfigOpen(true)
    onPreferOpenConfigConsumed?.()
  }, [preferOpenConfig, onPreferOpenConfigConsumed, onConfigOpen])

  // Al abrir config, refrescar contextos y asegurar results del agente.
  useEffect(() => {
    if (!configOpen) return
    void (async () => {
      await refreshDiskContexts()
      const resolvedCwd = await resolveWorkingCwd()
      const agentId = metaRef.current.id?.trim() ?? ''
      if (!resolvedCwd || !agentId) return
      const slug = normalizeAgentSlug(agentId, 'agent')
      const resultId = `iaterminal:result:${slug}`
      if (diskContextsRef.current.some(context => context.id === resultId)) return
      const agentName = metaRef.current.name?.trim() ?? ''
      const result = await window.api.ensureAiAgentResults({
        cwd: resolvedCwd,
        agentId,
        ...(agentName ? { agentName } : {}),
      })
      if (!result.ok) return
      await refreshDiskContexts()
      onProjectContextsChangedRef.current?.()
    })()
  }, [configOpen, refreshDiskContexts, resolveWorkingCwd])

  useEffect(() => {
    if (!preferOpenContextId) return
    setContextsOpen(true)
  }, [preferOpenContextId])

  useEffect(() => {
    if (!onPlaneStatusChange) return
    const assignedIds = new Set(meta.contextIds ?? [])
    const contexts = diskContexts
      .filter(context => assignedIds.has(context.id))
      .map(context => ({ id: context.id, name: context.name, kind: context.kind }))
    let lastSnippet = ''
    for (let i = messages.length - 1; i >= 0; i--) {
      const entry = messages[i]
      if (!entry || entry.role === 'system') continue
      const text = entry.content.trim()
      if (!text) continue
      lastSnippet = text.length > 120 ? `${text.slice(0, 117)}…` : text
      break
    }
    const runningThreadIds = collectRunningThreadIds(
      lanesRef.current,
      activeThreadId,
      busy,
    )
    const status: AgentPlaneStatus = {
      busy,
      activity,
      lastSnippet,
      contexts,
      messages: messages
        .filter(entry => entry.role === 'user' || entry.role === 'assistant'),
      activeAssistantId: busy ? activeAssistantId : null,
      enteringIds: [...enteringIds],
      materializingIds: [...materializingIds],
      settlingId,
      awaitingDelegations,
      orchestrationAwaiting: orchestrationAwaiting ?? null,
      delegationWorkActive,
      orchestratorBusy,
      orchestrationWorkStyle,
      loopMode: loopOpen || loopActive || chainLoopActive,
      loopActive: loopActive || chainLoopActive,
      localLoopActive: loopActive,
      turnCloseReason,
      loopEndReason,
      queuedTurns: queuedTurns.map(item => ({
        id: item.id,
        text: item.text,
        images: item.images.map(image => ({
          id: image.id,
          previewUrl: image.previewUrl,
          name: image.name,
        })),
        ...(item.orchestrationFollowUp ? { orchestrationFollowUp: true } : {}),
        ...(item.delegation ? { delegation: { ...item.delegation } } : {}),
      })),
      canClearConversation: messages.length > 0
        || queuedTurns.length > 0
        || pendingImages.length > 0
        || Boolean(meta.cliSessionId)
        || busy
        || loopActive
        || chainLoopActive
        // Un hilo nuevo y vacío no tiene nada que limpiar, pero sí hay que
        // poder descartarlo mientras quede otro al que volver.
        || (meta.threads?.length ?? 0) > 1,
      runningThreadIds,
    }
    // busy/loops/activity: inmediato. Solo messages/snippet: throttle (~150ms).
    const controlKey = [
      busy ? '1' : '0',
      activity,
      busy ? (activeAssistantId ?? '') : '',
      settlingId ?? '',
      awaitingDelegations ? '1' : '0',
      orchestrationAwaitingSignature(orchestrationAwaiting),
      delegationWorkActive ? '1' : '0',
      orchestratorBusy ? '1' : '0',
      orchestrationWorkStyle,
      loopOpen ? '1' : '0',
      loopActive ? '1' : '0',
      chainLoopActive ? '1' : '0',
      turnCloseReason ?? '',
      loopEndReason ?? '',
      String(queuedTurns.length),
      String(enteringIds.size),
      String(materializingIds.size),
      String(pendingImages.length),
      meta.cliSessionId ?? '',
      String(meta.threads?.length ?? 0),
      (meta.contextIds ?? []).join(','),
      runningThreadIds.join(','),
    ].join('\0')
    planeStatusThrottlerRef.current.schedule({
      controlKey,
      value: status,
      publish: onPlaneStatusChange,
    })
  }, [
    activeAssistantId,
    activeThreadId,
    activity,
    awaitingDelegations,
    orchestrationAwaiting,
    busy,
    chainLoopActive,
    delegationWorkActive,
    diskContexts,
    enteringIds,
    lanesVersion,
    loopActive,
    loopEndReason,
    loopOpen,
    materializingIds,
    messages,
    meta.cliSessionId,
    meta.contextIds,
    meta.threads,
    onPlaneStatusChange,
    orchestrationWorkStyle,
    orchestratorBusy,
    pendingImages.length,
    queuedTurns,
    settlingId,
    turnCloseReason,
  ])

  useEffect(() => {
    const throttler = planeStatusThrottlerRef.current
    return () => throttler.dispose()
  }, [])

  // Si cambia el catálogo de agentes, re-mezclar results (altas/bajas/renombres).
  useEffect(() => {
    setDiskContexts(previous => {
      const next = withCatalogAgentResultContexts(previous, projectAgents)
      const same = previous.length === next.length
        && previous.every((context, index) => (
          context.id === next[index]?.id && context.name === next[index]?.name
        ))
      if (same) return previous
      diskContextsRef.current = next
      return next
    })
  }, [projectAgents])

  // Catálogo = disco. Se refresca al cambiar cwd y al abrir el gestor.
  useEffect(() => {
    let cancelled = false
    void resolveWorkingCwd().then(async resolvedCwd => {
      if (cancelled) return
      const cwdChanged = prepareContextDiscovery(resolvedCwd)
      if (!resolvedCwd) {
        if (cwdChanged) clearDiskContexts()
        return
      }
      const result = await window.api.discoverTabContexts({ cwd: resolvedCwd })
      if (cancelled || !result.ok) return
      if (result.contextsMigrated) forceContextFullRefreshRef.current = true
      applyDiscoveredContexts(result.contexts, result.idRemap)
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [
    applyDiscoveredContexts,
    clearDiskContexts,
    contextsOpen,
    contextsRevision,
    cwd,
    prepareContextDiscovery,
    resolveWorkingCwd,
  ])

  // Probe MCP: si el allowlist incluye servidores que aún piden OAuth, avisar arriba.
  useEffect(() => {
    const allowed = meta.mcpsAllowed ?? []
    if (!allowed.length) {
      setMcpAuthNeeded([])
      setMcpAuthNotice('')
      return
    }
    let alive = true
    void window.api.listMcpServers({ provider: meta.provider, cwd })
      .then(result => {
        if (!alive) return
        const names = new Set(mcpsNeedingAuth(result.servers, allowed))
        setMcpAuthNeeded(
          result.servers
            .filter(server => names.has(server.name))
            .map(server => ({ name: server.name, url: server.url })),
        )
        if (!names.size) setMcpAuthNotice('')
      })
      .catch(() => {
        if (!alive) return
        setMcpAuthNeeded([])
        setMcpAuthNotice('')
      })
    return () => { alive = false }
  }, [cwd, meta.mcpsAllowed, meta.provider])

  const liveLaneThreadIds = (): Set<string> => new Set(lanesRef.current.keys())

  /** Catálogo de threads: abre uno nuevo y lo deja activo, sin tocar el live. */
  const commitNewThreadCatalog = useCallback((): string => {
    const id = crypto.randomUUID()
    const protectedIds = liveLaneThreadIds()
    onMetaChange(previous => {
      const state = newThread(
        sanitizeThreadState(previous.threads, previous.activeThreadId, undefined, protectedIds),
        id,
        Date.now(),
        protectedIds,
      )
      return { ...previous, ...threadPatch(state) }
    })
    return id
  }, [onMetaChange])

  const bumpLanes = useCallback((): void => {
    setLanesVersion(version => version + 1)
  }, [])

  const syncVisibleFromLane = useCallback((lane: LaneState): void => {
    setMessages(lane.messages)
    setBusy(lane.busy)
    setActivity(lane.activity)
    if (lane.busy) {
      activeAssistantIdRef.current = lane.assistantId
      setActiveAssistantId(lane.assistantId)
      turnClosedRef.current = false
    } else {
      activeAssistantIdRef.current = null
      setActiveAssistantId(null)
    }
  }, [])

  const patchLaneState = useCallback((
    threadId: string,
    updater: (lane: LaneState) => LaneState,
  ): void => {
    const current = getLane(lanesRef.current, threadId)
    if (!current) return
    const nextLane = updater(current)
    const nextLanes = new Map(lanesRef.current)
    nextLanes.set(threadId, nextLane)
    lanesRef.current = nextLanes
    bumpLanes()
    const visibleThreadId = metaRef.current.activeThreadId ?? DEFAULT_THREAD_ID
    if (visibleThreadId === threadId) syncVisibleFromLane(nextLane)
  }, [bumpLanes, syncVisibleFromLane])

  /** Promueve el turno vivo del hilo a carril de fondo sin abortar el CLI. */
  const promoteThreadTurnToBackgroundLane = useCallback((threadId: string): void => {
    if (getLane(lanesRef.current, threadId)) return
    const assistantId = activeAssistantIdRef.current ?? lastAssistantIdRef.current
    if (!assistantId) return
    const delegation = activeDelegationRef.current
    lanesRef.current = startLane(lanesRef.current, {
      threadId,
      delegationId: delegation?.id ?? '',
      assistantId,
      messages: [...messagesRef.current],
    })
    const lane = getLane(lanesRef.current, threadId)
    if (lane && activityRef.current) {
      const next = new Map(lanesRef.current)
      next.set(threadId, { ...lane, activity: activityRef.current })
      lanesRef.current = next
    }
    if (delegation) {
      laneDelegationRef.current.set(threadId, delegation)
      activeDelegationRef.current = null
    }
    bumpLanes()
  }, [bumpLanes])

  const detachLiveTurnWithoutAbort = useCallback((): void => {
    activeAssistantIdRef.current = null
    lastAssistantIdRef.current = null
    setActiveAssistantId(null)
    setBusy(false)
    setActivity('')
  }, [])

  useLayoutEffect(() => {
    const prevId = prevActiveThreadIdRef.current
    if (prevId === activeThreadId) return
    const hadLiveTurn = busyRef.current || activeAssistantIdRef.current != null
    if (hadLiveTurn) {
      promoteThreadTurnToBackgroundLane(prevId)
      detachLiveTurnWithoutAbort()
    }
    prevActiveThreadIdRef.current = activeThreadId
  }, [
    activeThreadId,
    detachLiveTurnWithoutAbort,
    promoteThreadTurnToBackgroundLane,
  ])

  const registerDelegationThreadInCatalog = useCallback((
    threadId: string,
    delegationId: string,
  ): void => {
    const protectedIds = liveLaneThreadIds()
    onMetaChange(previous => {
      const sanitized = sanitizeThreadState(
        previous.threads,
        previous.activeThreadId,
        undefined,
        protectedIds,
      )
      if (sanitized.threads.some(thread => thread.id === threadId)) {
        return previous
      }
      const added = newThread(sanitized, threadId, Date.now(), protectedIds)
      const threads = added.threads.map(thread => (
        thread.id === threadId
          ? { ...thread, origin: 'delegation' as const, delegationId }
          : thread
      ))
      return {
        ...previous,
        threads,
        activeThreadId: previous.activeThreadId ?? sanitized.activeThreadId,
      }
    })
  }, [onMetaChange])

  const startTurn = useCallback(async (options: {
    prompt: string
    displayUser: string
    contexts: TabContext[]
    permissionMode?: AgentPermissionMode
    images?: AgentCliImageAttachment[]
    displayImages?: AgentChatImage[]
    allowDelegations?: boolean
    orchestrationJobId?: string
    viaLoop?: boolean
    delegation?: {
      id: string
      fromPaneId: string
      toAgentId: string
      orchestrationJobId: string
      threadId?: string
      cwd?: string
    }
  }): Promise<boolean> => {
    const assistant: AgentChatEntry = { id: crypto.randomUUID(), role: 'assistant', content: '' }
    const userContent = options.delegation
      ? `${options.displayUser}\n\n_(${t('agentPane.delegationViaOrchestrator')})_`
      : options.displayUser
    const user: AgentChatEntry = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userContent,
      ...(options.displayImages?.length ? { images: options.displayImages } : {}),
    }
    const laneThreadId = options.delegation?.threadId?.trim() || undefined
    const isLaneDelegation = Boolean(laneThreadId && options.delegation)

    if (isLaneDelegation && laneThreadId && options.delegation) {
      registerDelegationThreadInCatalog(laneThreadId, options.delegation.id)
      const delegationRuntime: ActiveDelegationRuntime = {
        ...options.delegation,
        threadId: laneThreadId,
        awaitingNested: new Set<string>(),
      }
      laneDelegationRef.current.set(laneThreadId, delegationRuntime)
      rememberActiveParentDelegation(paneId, laneThreadId, options.delegation)
      lanesRef.current = startLane(lanesRef.current, {
        threadId: laneThreadId,
        delegationId: options.delegation.id,
        assistantId: assistant.id,
        messages: [user, assistant],
      })
      bumpLanes()
      const visibleThreadId = metaRef.current.activeThreadId ?? DEFAULT_THREAD_ID
      if (visibleThreadId === laneThreadId) {
        syncVisibleFromLane(getLane(lanesRef.current, laneThreadId)!)
      }
    } else {
      // Delegación legacy: hilo propio en el catálogo. El del usuario permanece.
      if (options.delegation) {
        retainLiveThreadIdRef.current = commitNewThreadCatalog()
      }
      const protectedIds = liveLaneThreadIds()
      onMetaChange(previous => ({
        ...previous,
        ...touchActiveThread(
          sanitizeThreadState(previous.threads, previous.activeThreadId, undefined, protectedIds),
          options.displayUser,
          Date.now(),
        ),
      }))
      activeAssistantIdRef.current = assistant.id
      lastAssistantIdRef.current = assistant.id
      setActiveAssistantId(assistant.id)
      turnGenRef.current += 1
      turnClosedRef.current = false
      if (activeDelegationRef.current) {
        activeDelegationRef.current.awaitingNested.clear()
      }
      if (options.delegation) {
        activeDelegationRef.current = {
          ...options.delegation,
          threadId: options.delegation.threadId,
          awaitingNested: activeDelegationRef.current?.awaitingNested ?? new Set<string>(),
        }
        rememberActiveParentDelegation(
          paneId,
          options.delegation.threadId,
          options.delegation,
        )
      }
      forceFollow()
      setMessages(prev => [...prev, user, assistant])
      setActivity('')
      setTurnCloseReason(null)
      setBusy(true)
    }

    const currentMeta = metaRef.current
    const assigned = options.contexts
    const resolvedCwd = await resolveWorkingCwd()

    const failLaneTurn = (summary: string): false => {
      if (!laneThreadId) return false
      const errorContent = `${t('agentPane.errorPrefix')}: ${summary}`
      const failedMessages = (getLane(lanesRef.current, laneThreadId)?.messages ?? []).map(message => (
        message.id === assistant.id
          ? { ...message, content: errorContent }
          : message
      ))
      const failedDelegation = laneDelegationRef.current.get(laneThreadId)
      laneDelegationRef.current.delete(laneThreadId)
      lanesRef.current = endLane(lanesRef.current, laneThreadId)
      bumpLanes()
      void window.api.saveAgentChat(chatRef, laneThreadId, failedMessages)
      if (failedDelegation) {
        clearActiveParentDelegation(paneId, laneThreadId)
        emitDelegationResult(failedDelegation, {
          status: 'fail',
          summary,
          toThreadId: laneThreadId,
        }, 'lane_materialize_failed')
      }
      const visibleThreadId = metaRef.current.activeThreadId ?? DEFAULT_THREAD_ID
      if (visibleThreadId === laneThreadId) {
        setMessages(failedMessages)
        setBusy(false)
        setActivity('')
        activeAssistantIdRef.current = null
        setActiveAssistantId(null)
      }
      return false
    }

    if (assigned.length && resolvedCwd) {
      const previews = await Promise.all(
        assigned.map(context => {
          const body = context.kind === 'notes'
            ? workspaceContextBody(context.id, orgBodyScopeRef.current)
            : ''
          return window.api.previewTabContext({
            context,
            cwd: resolvedCwd,
            ...(body.trim() ? { content: body } : {}),
          })
        }),
      )
      if (previews.every(preview => !preview.ok || !preview.content.trim())) {
        if (isLaneDelegation) {
          return failLaneTurn(t('tabContexts.materializeFailed'))
        }
        setMessages(prev => prev.map(message => (
          message.id === assistant.id
            ? {
                ...message,
                content: `${t('agentPane.errorPrefix')}: ${t('tabContexts.materializeFailed')}`,
              }
            : message
        )))
        setTurnCloseReason('aborted')
        setBusy(false)
        turnClosedRef.current = true
        activeAssistantIdRef.current = null
        setActiveAssistantId(null)
        const failedDelegation = activeDelegationRef.current
        activeDelegationRef.current = null
        clearActiveParentDelegation(paneId, failedDelegation?.threadId)
        if (failedDelegation) {
          emitDelegationResult(failedDelegation, {
            status: 'fail',
            summary: t('tabContexts.materializeFailed'),
          }, 'materialize_failed')
        }
        return false
      }
    }
    if (assigned.length && !resolvedCwd) {
      if (isLaneDelegation) {
        return failLaneTurn(t('tabContexts.missingCwd'))
      }
      setMessages(prev => prev.map(message => (
        message.id === assistant.id
          ? {
              ...message,
              content: `${t('agentPane.errorPrefix')}: ${t('tabContexts.missingCwd')}`,
            }
          : message
      )))
      setTurnCloseReason('aborted')
      setBusy(false)
      turnClosedRef.current = true
      activeAssistantIdRef.current = null
      setActiveAssistantId(null)
      const failedDelegation = activeDelegationRef.current
      activeDelegationRef.current = null
      clearActiveParentDelegation(paneId, failedDelegation?.threadId)
      if (failedDelegation) {
        emitDelegationResult(failedDelegation, {
          status: 'fail',
          summary: t('tabContexts.missingCwd'),
        }, 'missing_cwd')
      }
      return false
    }
    const priorMessages = isLaneDelegation
      ? (getLane(lanesRef.current, laneThreadId!)?.messages ?? [])
      : messagesRef.current
    let prompt = options.prompt
    if (!isLaneDelegation && pendingModeHandoffRef.current) {
      pendingModeHandoffRef.current = false
      prompt = buildModeHandoffPrompt(priorMessages, options.prompt)
    }
    if (!isLaneDelegation) {
      emptyResponseRetriesRef.current = 0
      suppressEmptyHandlingRef.current = false
    }
    const turnCwd = isLaneDelegation
      ? (options.delegation?.cwd?.trim() || resolvedCwd)
      : await resolveTurnCwd()
    const contextPayload = buildAgentTurnContextPayload(
      resolvedCwd,
      assigned,
      orgBodyScopeRef.current,
    )
    const rules = normalizeAgentRules(currentMeta.rules)
    const canDelegate = coordinationCanDelegate(currentMeta.coordination)
    const orchestrationAgents = canDelegate
      ? (getOrchestrationAgentsRef.current?.() ?? [])
      : []
    const roundInfo = canDelegate ? getOrchestrationRoundRef.current?.() : undefined
    const resumeCliSession = shouldResumeCliSessionForTurn({
      delegation: options.delegation,
    })
    if (!isLaneDelegation) {
      adoptsCliSessionRef.current = resumeCliSession
    }
    const turnThreadId = laneThreadId ?? activeThreadId
    const request: AgentCliStartRequest = {
      paneId,
      threadId: turnThreadId,
      provider: currentMeta.provider,
      prompt,
      cwd: turnCwd,
      ...(isLaneDelegation && resolvedCwd ? { projectCwd: resolvedCwd } : {}),
      ...contextPayload,
      permissionMode: options.permissionMode ?? currentMeta.permissionMode,
      ...(currentMeta.id?.trim() ? { agentId: currentMeta.id.trim() } : {}),
      ...(currentMeta.name?.trim() ? { name: currentMeta.name.trim() } : {}),
      ...(currentMeta.role?.trim() ? { role: currentMeta.role.trim() } : {}),
      ...(currentMeta.objective?.trim() ? { objective: currentMeta.objective.trim() } : {}),
      ...(rules.length ? { rules } : {}),
      ...(currentMeta.model?.trim() ? { model: currentMeta.model.trim() } : {}),
      ...(currentMeta.nativeSkills ? { nativeSkills: currentMeta.nativeSkills } : {}),
      ...(currentMeta.mcpsAllowed ? { mcpsAllowed: currentMeta.mcpsAllowed } : {}),
      contexts: assigned,
      discoveredContexts: diskContextsRef.current,
      emitResults: true,
      ...(() => {
        const ids = [
          normalizeAgentSlug(currentMeta.id),
          ...peerAgentsRef.current.map(peer => normalizeAgentSlug(peer.id)),
        ].filter(Boolean)
        const tabAgentIds = [...new Set(ids)]
        return tabAgentIds.length ? { tabAgentIds } : {}
      })(),
      ...(forceContextFullRefreshRef.current
        ? { forceContextFullRefresh: true }
        : {}),
      ...(canDelegate
        ? {
            coordination: currentMeta.coordination === 'productOwner'
              ? 'productOwner' as const
              : 'orchestrator' as const,
            orchestrationAgents,
            allowParallelLanes: true,
            ...(roundInfo?.workStyle === 'turbo'
              ? { orchestrationWorkStyle: 'turbo' as const }
              : {}),
            ...(() => {
              const jobId = resolveOrchestrationJobIdForTurn(
                options.orchestrationJobId,
                roundInfo?.jobId,
              )
              return jobId ? { orchestrationJobId: jobId } : {}
            })(),
            ...(options.allowDelegations === false ? { allowDelegations: false } : {}),
            ...(roundInfo && roundInfo.round > 0
              ? {
                  orchestrationRound: roundInfo.round,
                  orchestrationMaxRounds: roundInfo.maxRounds,
                }
              : roundInfo
                ? { orchestrationMaxRounds: roundInfo.maxRounds }
                : {}),
          }
        : {}),
      ...(!isLaneDelegation && resumeCliSession && currentMeta.cliSessionId
        ? { cliSessionId: currentMeta.cliSessionId }
        : {}),
      ...(options.images?.length ? { images: options.images } : {}),
      ...(orgWorkspaceRef.current ? { workspace: orgWorkspaceRef.current } : {}),
      ...(options.viaLoop ? { viaLoop: true } : {}),
    }
    if (forceContextFullRefreshRef.current) forceContextFullRefreshRef.current = false
    if (!isLaneDelegation) {
      lastTurnRequestRef.current = request
    }
    window.api.startAgentTurn(request)
    return true
  }, [
    activeThreadId,
    bumpLanes,
    chatRef,
    commitNewThreadCatalog,
    forceFollow,
    onMetaChange,
    paneId,
    registerDelegationThreadInCatalog,
    resolveTurnCwd,
    resolveWorkingCwd,
    syncVisibleFromLane,
    t,
  ])

  const finishLoop = useCallback((reason: 'done' | 'max' | 'stopped'): void => {
    clearLoopTimer()
    loopActiveRef.current = false
    loopDoneRef.current = false
    setLoopActive(false)
    setLoopEndReason(reason)
    setLoopIteration(0)
    loopIterationRef.current = 0
    const message = reason === 'done'
      ? t('agentPane.loopCompleted')
      : reason === 'max'
        ? t('agentPane.loopMaxIterations', { n: MAX_AGENT_LOOP_ITERATIONS })
        : t('agentPane.loopStopped')
    setMessages(prev => [...prev, systemMessage(message)])
  }, [clearLoopTimer, t])

  const completeTurn = useCallback((expectedGen?: number): void => {
    if (expectedGen != null && expectedGen !== turnGenRef.current) return
    if (turnClosedRef.current) return
    turnClosedRef.current = true
    const id = activeAssistantIdRef.current ?? lastAssistantIdRef.current
    const closedGen = turnGenRef.current
    // Mantener busy hasta confirmar contenido o agotar reintentos (evita drenar la cola).
    setActivity('')

    const finishSideEffects = (): void => {
      const assignedIds = new Set(metaRef.current.contextIds ?? [])
      const projectCwd = cwdRef.current.trim()
      if (projectCwd) {
        const assigned = diskContextsRef.current.filter(context => assignedIds.has(context.id))
        const refresh = contextsToRematerializeAfterTurn(assigned, {
          orgWorkspace: Boolean(orgWorkspaceRef.current),
        })
        contextWriteQueueRef.current = contextWriteQueueRef.current
          .catch(() => undefined)
          .then(() => Promise.all(refresh.map(context => {
            const body = context.kind === 'notes'
              ? workspaceContextBody(context.id, orgBodyScopeRef.current)
              : ''
            return window.api.materializeTabContext({
              context,
              cwd: projectCwd,
              ...(body.trim() ? { content: body } : {}),
            })
          })))
      }
      if (!loopActiveRef.current) return
      if (skipLoopContinueRef.current) {
        skipLoopContinueRef.current = false
        return
      }
      if (loopDoneRef.current) {
        finishLoop('done')
        return
      }
      const nextIteration = loopIterationRef.current + 1
      if (nextIteration > MAX_AGENT_LOOP_ITERATIONS) {
        finishLoop('max')
        return
      }
      clearLoopTimer()
      loopContinueTimerRef.current = window.setTimeout(() => {
        loopContinueTimerRef.current = null
        if (loopActiveRef.current) runLoopIterationRef.current(nextIteration)
      }, loopContinueDelayMsRef.current)
    }

    // Diferir: EXIT puede llegar antes que assistant_final (canales IPC distintos).
    window.setTimeout(() => {
      if (closedGen !== turnGenRef.current) return
      if (suppressEmptyHandlingRef.current) {
        suppressEmptyHandlingRef.current = false
        return
      }

      const message = id ? messagesRef.current.find(entry => entry.id === id) : undefined
      const isEmpty = Boolean(id && message && !message.content.trim())
      const priorRequest = lastTurnRequestRef.current

      if (
        isEmpty
        && id
        && priorRequest
        && emptyResponseRetriesRef.current < EMPTY_RESPONSE_MAX_RETRIES
      ) {
        emptyResponseRetriesRef.current += 1
        const sessionId = metaRef.current.cliSessionId
        const retryRequest: AgentCliStartRequest = {
          ...priorRequest,
          threadId: activeThreadId,
          ...(sessionId ? { cliSessionId: sessionId } : {}),
          ...(metaRef.current.nativeSkills ? { nativeSkills: metaRef.current.nativeSkills } : {}),
          ...(metaRef.current.mcpsAllowed ? { mcpsAllowed: metaRef.current.mcpsAllowed } : {}),
        }
        lastTurnRequestRef.current = retryRequest
        turnClosedRef.current = false
        turnGenRef.current += 1
        activeAssistantIdRef.current = id
        lastAssistantIdRef.current = id
        setActiveAssistantId(id)
        setBusy(true)
        setActivity('')
        setTurnCloseReason(null)
        setMessages(prev => prev.map(entry => (
          entry.id === id ? { ...entry, content: '' } : entry
        )))
        window.api.startAgentTurn(retryRequest)
        return
      }

      beginLiveSettle(id)
      // Vacío tras reintentos: el turno cerró; no tumbar la cadena entera.
      setTurnCloseReason('completed')
      playAgentFinishSound(systemSoundsEnabled)
      setBusy(false)
      activeAssistantIdRef.current = null
      setActiveAssistantId(null)
      if (isEmpty && id) {
        setMessages(prev => prev.map(entry =>
          entry.id === id
            ? {
                ...entry,
                content: `${t('agentPane.errorPrefix')}: ${t('agentPane.emptyResponse')}`,
              }
            : entry))
      }

      const delegation = activeDelegationRef.current ?? hydrateActiveParentDelegationForPane(paneId)
      if (delegation && !activeDelegationRef.current) {
        activeDelegationRef.current = delegation
      }
      const awaitingNested = delegation?.awaitingNested.size ?? 0
      const decision = decideParentDelegationNotify({
        held: Boolean(delegation),
        dispatchedNested: awaitingNested > 0,
        canDelegate: coordinationCanDelegate(metaRef.current.coordination),
      })
      if (decision === 'notify' && delegation) {
        activeDelegationRef.current = null
        clearActiveParentDelegation(paneId, delegation.threadId)
        const summary = isEmpty
          ? t('agentPane.delegationEmptySummary')
          : (message?.content ?? '').trim() || t('agentPane.delegationEmptySummary')
        emitDelegationResult(delegation, {
          status: isEmpty ? 'fail' : 'ok',
          summary,
        }, 'turn_complete')
      }

      emptyResponseRetriesRef.current = 0
      finishSideEffects()
    }, 0)
  }, [beginLiveSettle, clearLoopTimer, emitDelegationResult, finishLoop, paneId, systemSoundsEnabled, t])

  const applyCliEvent = useCallback((event: AgentCliUiEvent): void => {
    if (!loadedRef.current) {
      pendingCliEventsRef.current.push(event)
      return
    }
    const visibleThreadId = metaRef.current.activeThreadId ?? DEFAULT_THREAD_ID
    const liveLane = getLane(lanesRef.current, visibleThreadId)
    if (liveLane?.busy) {
      applyLaneCliEventRef.current(visibleThreadId, event)
      return
    }
    if (event.type === 'done') {
      completeTurn()
      return
    }
    if (event.type === 'delegate') {
      const parent = activeDelegationRef.current
      // Anota parentDelegationId sobre cada request antes de dispatch. Así
      // App enlaza estas nested al padre en el registry (no infiere por
      // "última request"). Solo aplica si este pane corre bajo delegación:
      // orquestadores sin padre pasan las delegaciones sin tag.
      const tagged = parent
        ? event.delegations.map(item => ({ ...item, parentDelegationId: parent.id }))
        : event.delegations
      if (parent) {
        for (const item of tagged) {
          parent.awaitingNested.add(item.id)
        }
      }
      const explicitJobId = event.orchestrationJobId?.trim() || undefined
      const requestJobId = lastTurnRequestRef.current?.orchestrationJobId?.trim() || undefined
      const jobId = resolveOrchestrationJobIdForTurn(explicitJobId, requestJobId)
      // Diagnóstico de correlación: si el CLI emite un jobId distinto al del
      // request del turno, algo desalineó. Ganamos el explícito, pero dejamos
      // rastro para depurar (turbo + follow-ups pisando lastTurnRequestRef).
      if (explicitJobId && requestJobId && explicitJobId !== requestJobId) {
        console.warn('[orchestration] delegate event jobId mismatch', {
          fromPaneId: paneId,
          toAgentId: tagged[0]?.toAgentId,
          reason: 'delegate_jobid_mismatch',
          eventJobId: explicitJobId,
          requestJobId,
          resolvedJobId: jobId,
          delegationIds: tagged.map(item => item.id),
          ...(parent ? { parentDelegationId: parent.id } : {}),
        })
      }
      onOrchestratorDelegationsRef.current?.(tagged, jobId)
      if (tagged.length) {
        const names = tagged
          .map(item => item.toAgentId)
          .join(', ')
        setMessages(prev => [
          ...prev,
          systemMessage(t('agentPane.delegationDispatched', { agents: names })),
        ])
      }
      return
    }
    if (event.type === 'session') {
      // Subtarea del orquestador: su CLI es de usar y tirar. El hilo conserva
      // la sesión con la que venía, así el próximo turno humano la reanuda.
      if (adoptsCliSessionRef.current) {
        onMetaChange(previous => ({ ...previous, cliSessionId: event.cliSessionId }))
      }
      return
    }
    // done/EXIT tardíos de un proceso anterior no deben reabrir el turno ni
    // pisar el mensaje nuevo al drenar la cola.
    if (turnClosedRef.current) return
    if (event.type === 'tool') {
      // Solo actualizar al empezar; al completar se mantiene el último label
      // hasta el siguiente tool o el fin del turno (evita huecos de espera vacía).
      if (event.status === 'started') {
        const toolLabel = event.detail
          ? `${event.name} · ${event.detail}`
          : event.name
        setActivity(t('agentPane.activity', { tool: toolLabel }))
      }
      return
    }
    if (event.type === 'context') {
      setActivity(event.status === 'loading'
        ? t('agentPane.contextLoading', { n: Number(event.detail ?? 0) })
        : '')
      if (event.status === 'loading') {
        const id = activeAssistantIdRef.current
        if (id) {
          // El primer proceso pudo emitir el bloque interno durante streaming.
          // Se limpia antes de continuar con la respuesta real.
          setMessages(prev => prev.map(message =>
            message.id === id ? { ...message, content: '' } : message))
        }
      }
      return
    }
    if (event.type === 'error') {
      let assistantId = activeAssistantIdRef.current ?? lastAssistantIdRef.current
      if (!assistantId) {
        const existing = [...messagesRef.current].reverse().find(message => message.role === 'assistant')
        assistantId = existing?.id ?? crypto.randomUUID()
        if (!existing) {
          const createdId = assistantId
          setMessages(prev => [...prev, { id: createdId, role: 'assistant', content: '' }])
        }
      }
      activeAssistantIdRef.current = assistantId
      lastAssistantIdRef.current = assistantId
      setActiveAssistantId(assistantId)
      setBusy(true)
      setMessages(prev => {
        const content = `${t('agentPane.errorPrefix')}: ${event.message}`
        const existing = prev.findIndex(message => message.id === assistantId)
        if (existing < 0) return [...prev, { id: assistantId, role: 'assistant', content }]
        return prev.map(message => message.id === assistantId ? { ...message, content } : message)
      })
      return
    }
    // Tras remount el ref puede estar vacío: reenganchar al último asistente.
    let assistantId = activeAssistantIdRef.current ?? lastAssistantIdRef.current
    if (!assistantId) {
      const existing = [...messagesRef.current].reverse().find(message => message.role === 'assistant')
      assistantId = existing?.id ?? crypto.randomUUID()
      if (!existing) {
        const createdId = assistantId
        setMessages(prev => [...prev, { id: createdId, role: 'assistant', content: '' }])
      }
      activeAssistantIdRef.current = assistantId
      lastAssistantIdRef.current = assistantId
      setActiveAssistantId(assistantId)
      setBusy(true)
    }
    if (event.type === 'assistant_final') {
      // Solo limpia el fence ia-terminal-context del texto visible; nunca se aplica.
      let { visibleText } = extractTabContextUpdates(event.text)
      if (loopActiveRef.current) {
        const stripped = stripLoopDoneMarker(visibleText)
        visibleText = stripped.text
        if (stripped.done) loopDoneRef.current = true
      }
      // Un final vacío no debe borrar deltas ya mostrados (p. ej. result filtrado).
      setMessages(prev => prev.map(message => {
        if (message.id !== assistantId) return message
        const next = visibleText.trim() ? visibleText : message.content
        return { ...message, content: next }
      }))
      return
    }
    setMessages(prev => prev.map(message => {
      if (message.id !== assistantId) return message
      return { ...message, content: message.content + event.text }
    }))
  }, [completeTurn, onMetaChange, t])

  const laneCompletingRef = useRef<Set<string>>(new Set())

  const commitLanes = useCallback((
    nextLanes: Map<string, LaneState>,
    threadId: string,
  ): void => {
    lanesRef.current = nextLanes
    bumpLanes()
    const visibleThreadId = metaRef.current.activeThreadId ?? DEFAULT_THREAD_ID
    if (visibleThreadId === threadId) {
      const lane = getLane(nextLanes, threadId)
      if (lane) syncVisibleFromLane(lane)
    }
  }, [bumpLanes, syncVisibleFromLane])

  const completeLaneTurn = useCallback((threadId: string): void => {
    if (laneCompletingRef.current.has(threadId)) return
    const lane = getLane(lanesRef.current, threadId)
    if (!lane?.busy) return
    laneCompletingRef.current.add(threadId)
    const assistantMessage = [...lane.messages].reverse().find(message => message.role === 'assistant')
    const isEmpty = !assistantMessage?.content.trim()
    const finalMessages = isEmpty && assistantMessage
      ? lane.messages.map(message => (
        message.id === assistantMessage.id
          ? {
              ...message,
              content: `${t('agentPane.errorPrefix')}: ${t('agentPane.emptyResponse')}`,
            }
          : message
      ))
      : lane.messages
    void window.api.saveAgentChat(chatRef, threadId, finalMessages)
    const delegation = laneDelegationRef.current.get(threadId)
    laneDelegationRef.current.delete(threadId)
    lanesRef.current = endLane(lanesRef.current, threadId)
    bumpLanes()
    const decision = decideParentDelegationNotify({
      held: Boolean(delegation),
      dispatchedNested: (delegation?.awaitingNested.size ?? 0) > 0,
      canDelegate: coordinationCanDelegate(metaRef.current.coordination),
    })
    if (decision === 'notify' && delegation) {
      clearActiveParentDelegation(paneId, threadId)
      const summary = isEmpty
        ? t('agentPane.delegationEmptySummary')
        : (assistantMessage?.content ?? '').trim() || t('agentPane.delegationEmptySummary')
      emitDelegationResult(delegation, {
        status: isEmpty ? 'fail' : 'ok',
        summary,
        toThreadId: threadId,
      }, 'lane_turn_complete')
    }
    const visibleThreadId = metaRef.current.activeThreadId ?? DEFAULT_THREAD_ID
    if (visibleThreadId === threadId) {
      setMessages(finalMessages)
      setBusy(false)
      setActivity('')
      activeAssistantIdRef.current = null
      setActiveAssistantId(null)
    }
    laneCompletingRef.current.delete(threadId)
  }, [bumpLanes, chatRef, emitDelegationResult, paneId, t])

  const applyLaneCliEvent = useCallback((threadId: string, event: AgentCliUiEvent): void => {
    const lane = getLane(lanesRef.current, threadId)
    if (!lane?.busy) return
    if (event.type === 'done') {
      completeLaneTurn(threadId)
      return
    }
    if (event.type === 'delegate') {
      const parent = laneDelegationRef.current.get(threadId)
      const tagged = parent
        ? event.delegations.map(item => ({ ...item, parentDelegationId: parent.id }))
        : event.delegations
      if (parent) {
        for (const item of tagged) {
          parent.awaitingNested.add(item.id)
        }
      }
      const explicitJobId = event.orchestrationJobId?.trim() || undefined
      const jobId = resolveOrchestrationJobIdForTurn(explicitJobId, explicitJobId)
      onOrchestratorDelegationsRef.current?.(tagged, jobId)
      return
    }
    if (event.type === 'session') return
    if (event.type === 'tool') {
      if (event.status === 'started') {
        const toolLabel = event.detail
          ? `${event.name} · ${event.detail}`
          : event.name
        commitLanes(
          setLaneActivity(lanesRef.current, threadId, t('agentPane.activity', { tool: toolLabel })),
          threadId,
        )
      }
      return
    }
    if (event.type === 'context') {
      commitLanes(
        setLaneActivity(
          lanesRef.current,
          threadId,
          event.status === 'loading'
            ? t('agentPane.contextLoading', { n: Number(event.detail ?? 0) })
            : '',
        ),
        threadId,
      )
      if (event.status === 'loading') {
        patchLaneState(threadId, current => ({
          ...current,
          messages: current.messages.map(message => (
            message.id === current.assistantId
              ? { ...message, content: '' }
              : message
          )),
        }))
      }
      return
    }
    if (event.type === 'error') {
      const errorContent = `${t('agentPane.errorPrefix')}: ${event.message}`
      patchLaneState(threadId, current => ({
        ...current,
        messages: current.messages.map(message => (
          message.id === current.assistantId
            ? { ...message, content: errorContent }
            : message
        )),
      }))
      return
    }
    if (event.type === 'assistant_final') {
      let { visibleText } = extractTabContextUpdates(event.text)
      patchLaneState(threadId, current => ({
        ...current,
        messages: current.messages.map(message => {
          if (message.id !== current.assistantId) return message
          const next = visibleText.trim() ? visibleText : message.content
          return { ...message, content: next }
        }),
      }))
      return
    }
    if (event.type === 'assistant_delta') {
      commitLanes(appendLaneText(lanesRef.current, threadId, event.text), threadId)
    }
  }, [commitLanes, completeLaneTurn, patchLaneState, t])

  applyLaneCliEventRef.current = applyLaneCliEvent
  const completeLaneTurnRef = useRef(completeLaneTurn)
  completeLaneTurnRef.current = completeLaneTurn

  applyCliEventRef.current = applyCliEvent
  completeTurnRef.current = completeTurn

  useEffect(() => {
    // Suscripción estable por paneId: no re-suscribir al re-render (resize/split
    // recreaba callbacks y perdía eventos done/delta a mitad de stream).
    const offEvent = window.api.onAgentCliEvent(runKey, event => {
      applyCliEventRef.current(event)
    })
    const offExit = window.api.onAgentCliExit(runKey, () => {
      // Fallback si el runtime antiguo no emite `done`, o si done se perdió.
      // Capturar generación: un EXIT tardío no debe cerrar el siguiente turno en cola.
      const gen = turnGenRef.current
      window.setTimeout(() => {
        completeTurnRef.current(gen)
      }, 0)
    })
    return () => {
      offEvent()
      offExit()
    }
  }, [runKey])

  useEffect(() => {
    const cleanups: Array<() => void> = []
    for (const [threadId, lane] of lanesRef.current.entries()) {
      if (!lane.busy) continue
      const laneRunKey = buildRunKey(paneId, threadId)
      cleanups.push(window.api.onAgentCliEvent(laneRunKey, event => {
        applyLaneCliEventRef.current(threadId, event)
      }))
      cleanups.push(window.api.onAgentCliExit(laneRunKey, () => {
        window.setTimeout(() => {
          completeLaneTurnRef.current(threadId)
        }, 0)
      }))
    }
    return () => {
      for (const cleanup of cleanups) cleanup()
    }
  }, [lanesVersion, paneId])

  useEffect(() => {
    return () => {
      clearLoopTimer()
      for (const threadId of lanesRef.current.keys()) {
        const lane = getLane(lanesRef.current, threadId)
        if (lane?.busy) {
          window.api.stopAgentTurn(buildRunKey(paneId, threadId))
        }
      }
    }
  }, [clearLoopTimer, paneId])

  useEffect(() => {
    if (!onClosePane || !registerShortcutCloseInterceptor) return
    return registerShortcutCloseInterceptor(() => setConfirmClose(true))
  }, [onClosePane, registerShortcutCloseInterceptor])

  /** Convierte adjuntos y lanza el turno; contexts se resuelven al despachar. */
  const dispatchMessage = useCallback(async (
    prompt: string,
    imagesSnapshot: PendingImage[],
    options?: {
      delegation?: QueuedTurn['delegation']
      allowDelegations?: boolean
      orchestrationFollowUp?: boolean
      orchestrationJobId?: string
      viaLoop?: boolean
      extraContextIds?: string[]
    },
  ): Promise<boolean> => {
    const extraContextIds = options?.extraContextIds ?? []
    /**
     * `contextsRevision` (bump en `App.tsx`'s `refreshTabContexts`) es el
     * camino normal para que este pane vuelva a leer disco, pero es async y
     * el usuario puede pulsar Enter a los pocos ms de elegir una mención.
     * Guarda determinista: si algo que este turno pide adjuntar todavía no
     * está en el catálogo en memoria, refrescar ANTES de resolver — si no,
     * `resolveTurnContexts` lo descarta en silencio (el id llegó, el `.md`
     * existe, pero nadie lo había leído todavía aquí). La regla vive en
     * `src/shared/tabContext.ts` porque este archivo no tiene harness de test.
     */
    const assigned = await resolveTurnContextsRefreshing(
      metaRef.current.contextIds ?? [],
      extraContextIds,
      () => diskContextsRef.current,
      refreshDiskContexts,
    )
    const images: AgentCliImageAttachment[] = []
    const displayImages: AgentChatImage[] = []
    for (const [index, image] of imagesSnapshot.entries()) {
      try {
        const base64 = await blobToBase64(image.blob)
        if (!base64) continue
        const name = image.name || `paste-${index + 1}${extensionForMime(image.mimeType)}`
        images.push({
          name,
          mimeType: image.mimeType,
          base64,
        })
        const thumbnail = await blobToThumbnailDataUrl(image.blob)
        if (thumbnail) displayImages.push({ name, dataUrl: thumbnail })
      } catch {
        // Ignorar adjuntos que no se pudieron leer.
      } finally {
        URL.revokeObjectURL(image.previewUrl)
      }
    }
    // Sin miniaturas (fallo de canvas) se conserva el texto de respaldo.
    const fallbackText = images.length && !displayImages.length
      ? t('agentPane.imagesAttached', { n: images.length })
      : ''
    const displayUser = [prompt, fallbackText].filter(Boolean).join('\n')
    return startTurn({
      prompt,
      displayUser: displayUser || (displayImages.length ? '' : t('agentPane.imageOnlyMessage')),
      contexts: assigned,
      ...(images.length ? { images } : {}),
      ...(displayImages.length ? { displayImages } : {}),
      ...(options?.delegation ? { delegation: options.delegation } : {}),
      ...(options?.allowDelegations === false ? { allowDelegations: false } : {}),
      ...(options?.orchestrationJobId?.trim()
        ? { orchestrationJobId: options.orchestrationJobId.trim() }
        : {}),
      ...(options?.viaLoop ? { viaLoop: true } : {}),
    })
  }, [refreshDiskContexts, startTurn, t])

  /** Cada ciclo del loop = el mismo despacho que un mensaje del chat. */
  const runLoopIteration = useCallback((iteration: number): void => {
    const objective = loopObjectiveRef.current.trim()
    if (!objective || !loopActiveRef.current) return
    loopIterationRef.current = iteration
    setLoopIteration(iteration)
    void dispatchMessage(objective, [], { viaLoop: true }).then(ok => {
      if (!ok && loopActiveRef.current) finishLoop('stopped')
    })
  }, [dispatchMessage, finishLoop])
  runLoopIterationRef.current = runLoopIteration

  const send = useCallback((overrideText?: string): void => {
    const prompt = (overrideText ?? input).trim()
    if ((!prompt && pendingImages.length === 0) || humanInputBlocked) return
    if (!canStartHumanTurnNow && queuedTurns.length >= MAX_VISIBLE_QUEUED_TURNS) return
    onRequestPaneFocus()
    const imagesSnapshot = pendingImages
    setInput('')
    setPendingImages([])
    // Encolar mientras hay trabajo/delegaciones; abort solo al iniciar turno humano.
    if (!canStartHumanTurnNow) {
      setQueuedTurns(prev => [
        ...prev,
        { id: crypto.randomUUID(), text: prompt, images: imagesSnapshot },
      ])
      return
    }
    if (coordinationCanDelegate(metaRef.current.coordination)) {
      onOrchestrationUserTurnRef.current?.()
    }
    // Las issues mencionadas en ESTE mensaje viajan como contextos del turno,
    // igual que en el chat del plano; no se quedan pegadas al agente.
    const jiraSnapshot = pendingJiraContextIds
    setPendingJiraContextIds([])
    void dispatchMessage(
      prompt,
      imagesSnapshot,
      jiraSnapshot.length ? { extraContextIds: jiraSnapshot } : undefined,
    )
  }, [
    canStartHumanTurnNow,
    dispatchMessage,
    humanInputBlocked,
    input,
    onRequestPaneFocus,
    pendingImages,
    pendingJiraContextIds,
    queuedTurns.length,
  ])

  useEffect(() => {
    if (!preferSend) {
      handledPreferSendRef.current = null
      return
    }
    // El + tiene que crear el hilo antes de consumir el send; si no, startTurn
    // retitula el activo y startNewThread aborta la delegación al resetear.
    if (preferNewThread) {
      handledPreferSendRef.current = null
      return
    }
    // Evitar doble envío: startTurn pone busy y re-ejecuta el effect con el
    // mismo preferSend antes de que el padre lo limpie.
    if (handledPreferSendRef.current === preferSend) return
    // Loop local activo: no consumir; App reintentará cuando termine.
    if (loopActive) return
    const prompt = preferSend.text.trim()
    const inboundImages = preferSend.images ?? []
    const delegation = preferSend.delegation
    const orchestrationFollowUp = preferSend.orchestrationFollowUp === true
    const viaLoop = preferSend.viaLoop === true
    const extraContextIds = preferSend.extraContextIds ?? []
    const allowDelegations = preferSend.allowDelegations
    const orchestrationJobId = preferSend.orchestrationJobId
    const isHumanTurn = !orchestrationFollowUp && !delegation
    const delegationId = delegation?.id
    // Prompt vacío sin imágenes: no consumir; marcar local para no re-loguear.
    if (!prompt && inboundImages.length === 0) {
      handledPreferSendRef.current = preferSend
      console.warn('[AgentPane] preferSend ignored', {
        reason: 'empty_prefer_send',
        delegationId,
        orchestrationJobId,
      })
      return
    }
    const imagesSnapshot = attachmentsToPendingImages(inboundImages)
    const turnOptions = {
      ...(delegation ? { delegation } : {}),
      ...(allowDelegations === false ? { allowDelegations: false as const } : {}),
      ...(orchestrationFollowUp ? { orchestrationFollowUp: true as const } : {}),
      ...(orchestrationJobId?.trim() ? { orchestrationJobId: orchestrationJobId.trim() } : {}),
      ...(viaLoop ? { viaLoop: true as const } : {}),
      ...(extraContextIds.length ? { extraContextIds } : {}),
    }
    // Busy o humano sin slot → encolar (delegaciones en carril arrancan en background).
    const isLaneDelegation = Boolean(delegation?.threadId?.trim())
    const shouldEnqueue = !isLaneDelegation && (busy || (isHumanTurn && !canStartHumanTurnNow))
    if (shouldEnqueue) {
      let didEnqueue = false
      setQueuedTurns(prev => {
        if (prev.length >= MAX_VISIBLE_QUEUED_TURNS) return prev
        didEnqueue = true
        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            text: prompt,
            images: imagesSnapshot,
            ...turnOptions,
          },
        ]
      })
      if (!didEnqueue) {
        imagesSnapshot.forEach(image => URL.revokeObjectURL(image.previewUrl))
        console.warn('[AgentPane] preferSend rejected', {
          reason: 'queue_full',
          delegationId,
          orchestrationJobId,
        })
        handledPreferSendRef.current = null
        return
      }
      handledPreferSendRef.current = preferSend
      onPreferSendConsumed?.()
      return
    }
    if (preferSend.focusPane !== false) onRequestPaneFocus()
    if (
      isHumanTurn
      && coordinationCanDelegate(metaRef.current.coordination)
    ) {
      onOrchestrationUserTurnRef.current?.()
    }
    handledPreferSendRef.current = preferSend
    onPreferSendConsumed?.()
    void dispatchMessage(prompt, imagesSnapshot, turnOptions)
  }, [
    busy,
    canStartHumanTurnNow,
    dispatchMessage,
    loopActive,
    onPreferSendConsumed,
    onRequestPaneFocus,
    preferNewThread,
    preferSend,
    queuedTurns.length,
  ])

  const removeQueuedTurn = useCallback((id: string): void => {
    setQueuedTurns(previous => {
      const target = previous.find(item => item.id === id)
      target?.images.forEach(image => URL.revokeObjectURL(image.previewUrl))
      return previous.filter(item => item.id !== id)
    })
  }, [])

  const updateQueuedTurn = useCallback((id: string, text: string): void => {
    setQueuedTurns(previous => previous.map(item => (
      item.id === id ? { ...item, text } : item
    )))
  }, [])

  const handleMergeQueuedTurns = useCallback((): void => {
    const next = mergeQueuedTurns(queuedTurns)
    if (next === queuedTurns) return
    setQueuedTurns(next)
    setEditingQueuedId(current => (
      current && !next.some(item => item.id === current) ? null : current
    ))
  }, [queuedTurns])

  const cancelDelegationsFrom = useCallback((fromPaneId: string): void => {
    setQueuedTurns(previous => {
      const { kept, removed } = filterQueuedTurnsAfterOrchestrationAbort(
        previous,
        paneId,
        fromPaneId,
      )
      for (const item of removed) {
        item.images.forEach(image => URL.revokeObjectURL(image.previewUrl))
      }
      return kept
    })
  }, [paneId])

  const cancelDelegation = useCallback((delegationId: string): void => {
    setQueuedTurns(previous => {
      const { kept, removed } = filterQueuedTurnsAfterSingleDelegationAbort(
        previous,
        delegationId,
      )
      for (const item of removed) {
        item.images.forEach(image => URL.revokeObjectURL(image.previewUrl))
      }
      return kept
    })
  }, [])

  useEffect(() => {
    if (!onPlaneQueueControlsReady) return
    onPlaneQueueControlsReady({
      remove: removeQueuedTurn,
      update: updateQueuedTurn,
      merge: handleMergeQueuedTurns,
      cancelDelegationsFrom,
      cancelDelegation,
    })
    return () => onPlaneQueueControlsReady(null)
  }, [
    cancelDelegation,
    cancelDelegationsFrom,
    handleMergeQueuedTurns,
    onPlaneQueueControlsReady,
    removeQueuedTurn,
    updateQueuedTurn,
  ])

  /** Drenaje automático: al liberarse el turno sale el siguiente FIFO. */
  const drainingRef = useRef(false)
  useEffect(() => {
    const head = queuedTurns[0]
    const headIsDelegation = Boolean(head?.delegation)
    const headIsLaneDelegation = Boolean(head?.delegation?.threadId?.trim())
    const queueReady = headIsLaneDelegation
      ? loaded && !loopActive && !(systemFollowUpsPending || preferSend != null)
      : canDrainAgentQueue({
        loaded,
        busy,
        loopActive,
        awaitingDelegations,
        delegationWorkActive,
        systemFollowUpsPending: systemFollowUpsPending || preferSend != null,
        headIsDelegation,
        orchestrationWorkStyle,
      })
    if (!queueReady || drainingRef.current) return
    const next = head
    if (!next) return
    drainingRef.current = true
    setQueuedTurns(prev => prev.filter(item => item.id !== next.id))
    const isHumanTurn = !next.orchestrationFollowUp && !next.delegation
    if (
      isHumanTurn
      && coordinationCanDelegate(metaRef.current.coordination)
    ) {
      onOrchestrationUserTurnRef.current?.()
    }
    void dispatchMessage(next.text, next.images, {
      ...(next.delegation ? { delegation: next.delegation } : {}),
      ...(next.allowDelegations === false ? { allowDelegations: false } : {}),
      ...(next.orchestrationFollowUp ? { orchestrationFollowUp: true } : {}),
      ...(next.orchestrationJobId?.trim()
        ? { orchestrationJobId: next.orchestrationJobId.trim() }
        : {}),
      ...(next.viaLoop ? { viaLoop: true } : {}),
      ...(next.extraContextIds?.length ? { extraContextIds: next.extraContextIds } : {}),
    }).finally(() => {
      drainingRef.current = false
    })
  }, [
    awaitingDelegations,
    busy,
    delegationWorkActive,
    dispatchMessage,
    loaded,
    loopActive,
    orchestrationWorkStyle,
    preferSend,
    queuedTurns,
    systemFollowUpsPending,
  ])

  const appendPendingImages = useCallback((images: PendingImage[]): void => {
    if (!images.length) return
    setPendingImages(previous => {
      const room = Math.max(0, MAX_PENDING_IMAGES - previous.length)
      if (!room) {
        images.forEach(image => URL.revokeObjectURL(image.previewUrl))
        return previous
      }
      const accepted = images.slice(0, room)
      images.slice(room).forEach(image => URL.revokeObjectURL(image.previewUrl))
      return [...previous, ...accepted]
    })
  }, [])

  const removePendingImage = useCallback((id: string): void => {
    setPendingImages(previous => {
      const target = previous.find(image => image.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return previous.filter(image => image.id !== id)
    })
  }, [])

  const handleComposerPaste = useCallback((event: ClipboardEvent<HTMLTextAreaElement>): void => {
    if (loopActive) return
    const files = imagesFromClipboard(event.clipboardData)
    if (!files.length) return
    event.preventDefault()
    // arrayBuffer() debe arrancar en el mismo tick del paste; si no, Chromium
    // suelta los bytes del clipboard y la miniatura queda vacía.
    const jobs = files.map((file, index) =>
      materializeClipboardImage(
        file,
        `paste-${index + 1}${extensionForMime(file.type || 'image/png')}`,
      ),
    )
    void Promise.all(jobs).then(results => {
      appendPendingImages(results.filter((image): image is PendingImage => image != null))
    })
  }, [appendPendingImages, loopActive])

  const pendingImagesRef = useRef(pendingImages)
  pendingImagesRef.current = pendingImages
  const queuedTurnsRef = useRef(queuedTurns)
  queuedTurnsRef.current = queuedTurns
  useEffect(() => {
    return () => {
      pendingImagesRef.current.forEach(image => URL.revokeObjectURL(image.previewUrl))
      queuedTurnsRef.current.forEach(item =>
        item.images.forEach(image => URL.revokeObjectURL(image.previewUrl)))
    }
  }, [])

  const stop = useCallback((): void => {
    clearLoopTimer()
    const wasLoop = loopActiveRef.current
    turnClosedRef.current = true
    emptyResponseRetriesRef.current = 0
    lastTurnRequestRef.current = null
    suppressEmptyHandlingRef.current = true
    window.api.stopAgentTurn(paneId)
    const abortedSummary = t('agentPane.delegationAbortedSummary')
    let nextLanes = lanesRef.current
    for (const [threadId, lane] of lanesRef.current.entries()) {
      void window.api.saveAgentChat(chatRef, threadId, lane.messages)
      const delegation = laneDelegationRef.current.get(threadId)
      laneDelegationRef.current.delete(threadId)
      laneCompletingRef.current.delete(threadId)
      nextLanes = endLane(nextLanes, threadId)
      if (delegation) {
        emitDelegationResult(delegation, {
          status: 'fail',
          summary: abortedSummary,
          toThreadId: threadId,
        }, 'lane_stop')
      }
    }
    lanesRef.current = nextLanes
    bumpLanes()
    beginLiveSettle(activeAssistantIdRef.current)
    setTurnCloseReason('aborted')
    setBusy(false)
    setActivity('')
    activeAssistantIdRef.current = null
    setActiveAssistantId(null)
    const delegation = activeDelegationRef.current
      ?? peekActiveParentDelegation(paneId, metaRef.current.activeThreadId)
    const decision = decideParentDelegationNotify({
      held: Boolean(delegation),
      dispatchedNested: false,
      aborted: true,
    })
    activeDelegationRef.current = null
    if (delegation) clearActiveParentDelegation(paneId, delegation.threadId)
    if (decision === 'notify' && delegation) {
      emitDelegationResult(delegation, {
        status: 'aborted',
        summary: t('agentPane.delegationAbortedSummary'),
      }, 'stop')
    }
    if (wasLoop) finishLoop('stopped')
    if (chainLoopActive) onChainLoopStop?.()
    if (coordinationCanDelegate(metaRef.current.coordination)) {
      onOrchestratorStopRef.current?.()
    }
  }, [beginLiveSettle, bumpLanes, chainLoopActive, chatRef, clearLoopTimer, emitDelegationResult, finishLoop, onChainLoopStop, paneId, t])

  useEffect(() => {
    if (!preferStop) return
    onPreferStopConsumed?.()
    stop()
  }, [onPreferStopConsumed, preferStop, stop])

  /**
   * Deja el pane sin turno, sin loop y sin cola: lo que hace falta antes de
   * cambiar de conversación. No toca disco ni el catálogo de threads.
   */
  const resetLiveState = useCallback((): void => {
    clearLoopTimer()
    const wasLoop = loopActiveRef.current
    const wasRunning = busyRef.current || wasLoop
    turnClosedRef.current = true
    emptyResponseRetriesRef.current = 0
    lastTurnRequestRef.current = null
    suppressEmptyHandlingRef.current = true
    if (wasRunning) {
      window.api.stopAgentTurn(runKey)
    }
    beginLiveSettle(activeAssistantIdRef.current)
    loopActiveRef.current = false
    loopDoneRef.current = false
    loopObjectiveRef.current = ''
    loopIterationRef.current = 0
    skipLoopContinueRef.current = false
    pendingModeHandoffRef.current = false
    pendingCliEventsRef.current = []
    setLoopOpen(false)
    setLoopActive(false)
    setLoopEndReason(wasLoop ? 'stopped' : null)
    setLoopIteration(0)
    setBusy(false)
    setActivity('')
    activeAssistantIdRef.current = null
    lastAssistantIdRef.current = null
    setActiveAssistantId(null)
    setSettlingId(null)
    setEnteringIds(new Set())
    setMaterializingIds(new Set())
    knownMessageIdsRef.current = new Set()
    messageContentLenRef.current = new Map()
    const clearedDelegation = activeDelegationRef.current
      ?? peekActiveParentDelegation(paneId, metaRef.current.activeThreadId)
    activeDelegationRef.current = null
    if (clearedDelegation) {
      clearActiveParentDelegation(paneId, clearedDelegation.threadId)
      emitDelegationResult(clearedDelegation, {
        status: 'aborted',
        summary: t('agentPane.delegationAbortedSummary'),
      }, 'reset_live_state')
    }
    setPendingImages(previous => {
      previous.forEach(image => URL.revokeObjectURL(image.previewUrl))
      return []
    })
    setQueuedTurns(previous => {
      previous.forEach(item =>
        item.images.forEach(image => URL.revokeObjectURL(image.previewUrl)))
      return []
    })
    setEditingQueuedId(null)
    setInput('')
    setMessages([])
  }, [beginLiveSettle, clearLoopTimer, emitDelegationResult, paneId, runKey, t])

  /**
   * Abre una conversación nueva. No borra nada: el thread anterior conserva su
   * transcript y su `cliSessionId`, y se puede reanudar desde el selector.
   *
   * Si hay delegación viva en el hilo activo, la petición queda diferida hasta
   * que cierre. Si el pane está busy por un turno humano, el turno se promueve
   * a carril de fondo y el hilo nuevo arranca limpio sin abortar el CLI.
   */
  const startNewThread = useCallback((): void => {
    if (shouldDeferNewThread({
      hasActiveDelegation: Boolean(activeDelegationRef.current),
    })) {
      pendingNewThreadRef.current = true
      return
    }
    if (busyRef.current || activeAssistantIdRef.current) {
      const threadId = metaRef.current.activeThreadId ?? DEFAULT_THREAD_ID
      promoteThreadTurnToBackgroundLane(threadId)
      detachLiveTurnWithoutAbort()
    } else {
      resetLiveState()
    }
    commitNewThreadCatalog()
    pendingNewThreadRef.current = false
  }, [
    commitNewThreadCatalog,
    detachLiveTurnWithoutAbort,
    promoteThreadTurnToBackgroundLane,
    resetLiveState,
  ])

  /** Borra la conversación activa (transcript incluido) y salta a otra. */
  const deleteActiveThread = useCallback((): void => {
    resetLiveState()
    const currentMeta = metaRef.current
    const sessionId = currentMeta.cliSessionId?.trim()
    if (sessionId) {
      window.api.clearAgentContextDelivery({
        provider: currentMeta.provider,
        cliSessionId: sessionId,
      })
    }
    const removedId = currentMeta.activeThreadId ?? DEFAULT_THREAD_ID
    const fallbackId = crypto.randomUUID()
    const protectedIds = liveLaneThreadIds()
    onMetaChange(previous => {
      const state = deleteThread(
        sanitizeThreadState(previous.threads, previous.activeThreadId, undefined, protectedIds),
        removedId,
        fallbackId,
        Date.now(),
      )
      return { ...previous, ...threadPatch(state) }
    })
    window.api.deleteAgentChat(chatRef, removedId)
  }, [chatRef, onMetaChange, resetLiveState])

  useEffect(() => {
    if (!preferNewThread) return
    startNewThread()
    // Si quedó pendiente (busy/delegación), no consumimos aún: el plane
    // mantiene la marca para bloquear "+" y evitar duplicados, y el effect
    // reconciliador flusheará cuando el turno cierre.
    if (!pendingNewThreadRef.current) {
      onPreferNewThreadConsumed?.()
    }
  }, [onPreferNewThreadConsumed, preferNewThread, startNewThread])

  /**
   * Aplica una petición diferida de nueva conversación cuando el pane vuelve
   * a idle limpio: sin turno vivo, sin ola de delegaciones y sin animación de
   * settle. Usa `commitNewThreadCatalog` directamente para no tocar el live.
   */
  useEffect(() => {
    if (!pendingNewThreadRef.current) return
    if (!canApplyDeferredNewThread({
      busy,
      settling: settlingId != null,
      awaitingDelegations,
      hasActiveDelegation: Boolean(activeDelegationRef.current),
    })) return
    pendingNewThreadRef.current = false
    commitNewThreadCatalog()
    onPreferNewThreadConsumed?.()
  }, [
    awaitingDelegations,
    busy,
    commitNewThreadCatalog,
    onPreferNewThreadConsumed,
    settlingId,
  ])

  useEffect(() => {
    if (!preferClearConversation) return
    onPreferClearConversationConsumed?.()
    setConfirmClear(true)
  }, [onPreferClearConversationConsumed, preferClearConversation])

  const startLoop = useCallback((objectiveOverride?: string): boolean => {
    const fromOverride = objectiveOverride?.trim() ?? ''
    const fromStored = loopObjectiveRef.current.trim()
    const fromInput = input.trim()
    const fromMeta = metaRef.current.objective?.trim() ?? ''
    const objective = fromOverride || fromStored || fromInput || fromMeta
    if (!objective || loopActiveRef.current) return false
    onRequestPaneFocus()
    // Si había un turno normal en curso, se corta y se avisa al padre si era subtarea.
    if (busyRef.current) {
      skipLoopContinueRef.current = true
      turnClosedRef.current = true
      emptyResponseRetriesRef.current = 0
      lastTurnRequestRef.current = null
      suppressEmptyHandlingRef.current = true
      beginLiveSettle(activeAssistantIdRef.current)
      setTurnCloseReason('aborted')
      setBusy(false)
      setActivity('')
      activeAssistantIdRef.current = null
      setActiveAssistantId(null)
      const cutDelegation = activeDelegationRef.current
        ?? peekActiveParentDelegation(paneId, metaRef.current.activeThreadId)
      activeDelegationRef.current = null
      if (cutDelegation) {
        clearActiveParentDelegation(paneId, cutDelegation.threadId)
        emitDelegationResult(cutDelegation, {
          status: 'aborted',
          summary: t('agentPane.delegationAbortedSummary'),
        }, 'start_loop_cut')
      }
      if (chainLoopActive) onChainLoopStop?.()
    }
    clearLoopTimer()
    if (objective !== input.trim()) setInput(objective)
    loopObjectiveRef.current = objective
    loopDoneRef.current = false
    loopActiveRef.current = true
    setLoopEndReason(null)
    setLoopActive(true)
    setLoopOpen(true)
    runLoopIteration(1)
    return true
  }, [
    beginLiveSettle,
    chainLoopActive,
    clearLoopTimer,
    emitDelegationResult,
    input,
    onChainLoopStop,
    onRequestPaneFocus,
    paneId,
    runLoopIteration,
    t,
  ])

  useEffect(() => {
    if (!preferStartLoop) return
    // Esperar a idle de loop; App solo debería ofertar nests listos, pero cubre carreras.
    if (loopActive) return
    const started = startLoop(preferStartLoop.objective)
    if (started) {
      onPreferStartLoopConsumed?.()
      return
    }
    // Idle y no arrancó (sin objetivo usable): sacar para no bloquear la cola.
    onPreferStartLoopConsumed?.()
  }, [loopActive, onPreferStartLoopConsumed, preferStartLoop, startLoop])

  useEffect(() => {
    if (!preferCreateLoop) return
    onPreferCreateLoopConsumed?.()
    if (loopActiveRef.current || busyRef.current) return
    setLoopIntervalModalOpen(true)
  }, [onPreferCreateLoopConsumed, preferCreateLoop])

  const toggleLoopMode = useCallback((): void => {
    if (loopActive || busy) return
    if (loopOpen) {
      setLoopOpen(false)
      loopObjectiveRef.current = ''
      return
    }
    setLoopIntervalModalOpen(true)
  }, [busy, loopActive, loopOpen])

  useEffect(() => {
    if (!onPlaneLoopToggleReady) return
    onPlaneLoopToggleReady(toggleLoopMode)
    return () => onPlaneLoopToggleReady(null)
  }, [onPlaneLoopToggleReady, toggleLoopMode])

  const confirmLoopSetup = useCallback((delayMs: number, objective: string): void => {
    const trimmed = objective.trim()
    if (!trimmed || busyRef.current || loopActiveRef.current) return
    loopContinueDelayMsRef.current = delayMs
    setLoopContinueDelayMs(delayMs)
    setLoopIntervalModalOpen(false)
    startLoop(trimmed)
  }, [startLoop])

  const changePermission = (permissionMode: AgentPermissionMode): void => {
    if (permissionMode === meta.permissionMode) return
    // Bug del CLI de Cursor: --resume conserva plan en SQLite y no hay
    // --mode agent. Ante cualquier cambio de modo con sesión activa, reiniciamos
    // el hilo CLI y el próximo turno reinyecta el historial local del chat.
    const mustResetCliSession =
      meta.provider === 'cursor' && Boolean(meta.cliSessionId)
    void Promise.resolve(onMetaChange(previous => {
      if (!mustResetCliSession) return { ...previous, permissionMode }
      const { cliSessionId: _dropped, ...rest } = previous
      return { ...rest, permissionMode }
    })).then(ok => {
      if (!ok || !mustResetCliSession) return
      pendingModeHandoffRef.current = true
      setMessages(prev => [...prev, systemMessage(t('agentPane.modeSessionReset'))])
    })
  }

  const changeProvider = (provider: AgentCliProvider): void => {
    if (provider === meta.provider) return
    const hadSession = Boolean(meta.cliSessionId)
    void Promise.resolve(onMetaChange(previous => {
      const { cliSessionId: _session, model: _model, ...rest } = previous
      return { ...rest, provider }
    })).then(ok => {
      if (!ok || !hadSession) return
      pendingModeHandoffRef.current = true
      setMessages(prev => [...prev, systemMessage(t('agentPane.providerSessionReset'))])
    })
  }

  const changeModel = (model: string): void => {
    const next = model.trim()
    onMetaChange(previous => {
      const { model: _previous, ...rest } = previous
      return next ? { ...rest, model: next } : rest
    })
  }

  const commitIdentity = async (draft: AgentIdentityDraft): Promise<boolean> => {
    const result = await Promise.resolve(onMetaChange(previous => {
      const withIdentity = applyAgentIdentityDraft(previous, draft)
      const nextId = normalizeAgentSlug(draft.id, previous.id)
      return { ...withIdentity, id: nextId || previous.id }
    }))
    return result !== false
  }

  const toggleContext = (contextId: string): void => {
    onMetaChange(previous => {
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
  }

  const loopMode = loopOpen || loopActive || chainLoopActive
  const effectiveLoopActive = loopActive || chainLoopActive
  const selectedContextIds = meta.contextIds ?? []
  // Solo el loop bloquea teclear; busy/delegaciones encolan.
  const showStop = shouldShowComposerStop({
    loopActive: effectiveLoopActive,
    busy,
    awaitingDelegations,
    delegationWorkActive: false,
  })
  const showPlay = loopMode && !effectiveLoopActive && !busy
  const composerDisabled = effectiveLoopActive

  const handleEnteringAnimationEnd = useCallback((messageId: string): void => {
    setEnteringIds(previous => {
      if (!previous.has(messageId)) return previous
      const next = new Set(previous)
      next.delete(messageId)
      return next
    })
  }, [])

  const handleMaterializingAnimationEnd = useCallback((messageId: string): void => {
    setMaterializingIds(previous => {
      if (!previous.has(messageId)) return previous
      const next = new Set(previous)
      next.delete(messageId)
      return next
    })
  }, [])

  const handleComposerKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (loopActive) stop()
      else if (showPlay) startLoop()
      else send()
    }
  }, [loopActive, send, showPlay, startLoop, stop])

  const hasComposerPayload = Boolean(input.trim() || pendingImages.length > 0)
  const buttonIsStop = showStop && (
    effectiveLoopActive || (!hasComposerPayload && !showPlay)
  )

  const handleSendClick = useCallback((): void => {
    if (buttonIsStop) stop()
    else if (showPlay) startLoop()
    else if (hasComposerPayload) send()
  }, [buttonIsStop, hasComposerPayload, send, showPlay, startLoop, stop])

  const handleDictateSend = useCallback((text: string): void => {
    if (buttonIsStop || showPlay) return
    send(text)
  }, [buttonIsStop, send, showPlay])

  return (
    <div
      className={[
        'agent-pane',
        tabActive && isActivePane ? 'agent-pane--focused' : '',
        effectiveLoopActive ? 'agent-pane--looping' : '',
        busy || awaitingDelegations || delegationWorkActive ? 'agent-pane--working' : '',
      ].filter(Boolean).join(' ')}
      style={{ '--agent-chat-font-size': `${fontSize}px` } as React.CSSProperties}
      onMouseDown={onRequestPaneFocus}
    >
      {/* Chat UI solo con ventana abierta; en mini el plano usa PlaneQuickChat. */}
      {windowOpen ? (
        <>
          {mcpAuthNeeded.length > 0 ? (
            <div className="agent-pane__mcp-banner" role="status">
              <p className="agent-pane__mcp-banner-text">
                {t('agentPane.mcpAuthBanner', {
                  names: mcpAuthNeeded.map(item => item.name).join(', '),
                })}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const first = mcpAuthNeeded[0]
                  if (!first) return
                  const command = agentCliSpec(meta.provider).command
                  const hint = mcpConnectHint({
                    provider: agentCliSpec(meta.provider).label,
                    command,
                    configFile: mcpConfigLabelFor(meta.provider),
                    serverName: first.name,
                    url: first.url,
                  })
                  void navigator.clipboard.writeText(hint).then(
                    () => setMcpAuthNotice(t('agentPane.mcpConnectCopied', { cli: command })),
                    () => setMcpAuthNotice(t('agentPane.mcpConnectCopyFailed')),
                  )
                }}
              >
                {t('agentPane.mcpAuthBannerAction')}
              </Button>
              {mcpAuthNotice ? (
                <span className="agent-pane__mcp-banner-note">{mcpAuthNotice}</span>
              ) : null}
            </div>
          ) : null}
          <AgentPaneMessages
            scrollRef={scrollRef}
            bubblesRef={bubblesRef}
            messages={messages}
            busy={busy}
            activity={activity}
            awaitingDelegations={awaitingDelegations}
            orchestrationAwaiting={orchestrationAwaiting}
            loopActive={effectiveLoopActive}
            loopIteration={loopIteration}
            queuedTurns={queuedTurns}
            nearBottom={nearBottom}
            activeAssistantId={activeAssistantId}
            enteringIds={enteringIds}
            materializingIds={materializingIds}
            settlingId={settlingId}
            onEnteringAnimationEnd={handleEnteringAnimationEnd}
            onMaterializingAnimationEnd={handleMaterializingAnimationEnd}
            mergeableCount={queuedTurns.filter(item => (
              !item.delegation && !item.orchestrationFollowUp
            )).length}
            onRemoveQueuedTurn={removeQueuedTurn}
            onEditQueuedTurn={id => setEditingQueuedId(id)}
            onMergeQueuedTurns={handleMergeQueuedTurns}
            onScrollToBottom={scrollChatToBottom}
            onAbortDelegation={id => onAbortDelegationRef.current?.(id)}
          />

          <AgentPaneFooter
            pendingImages={pendingImages}
            composerDisabled={composerDisabled}
            loopMode={loopMode}
            busy={busy}
            loopActive={effectiveLoopActive}
            awaitingDelegations={awaitingDelegations}
            delegationWorkActive={delegationWorkActive}
            orchestratorBusy={orchestratorBusy}
            orchestrationWorkStyle={orchestrationWorkStyle}
            input={input}
            showStop={buttonIsStop}
            showPlay={showPlay}
            composerInputRef={composerInputRef}
            onInputChange={setInput}
            onComposerPaste={handleComposerPaste}
            onComposerKeyDown={handleComposerKeyDown}
            onComposerCaret={jiraMention.handleChange}
            mentionPicker={jiraMention.picker}
            onRemovePendingImage={removePendingImage}
            onSendClick={handleSendClick}
            onDictateSend={handleDictateSend}
            systemSoundsEnabled={systemSoundsEnabled}
          />
        </>
      ) : null}

      <AgentConfigModal
        open={configOpen}
        active={tabActive}
        meta={meta}
        cwd={cwd}
        busy={busy}
        loopMode={loopMode}
        loopActive={effectiveLoopActive}
        awaitingDelegations={awaitingDelegations}
        diskContexts={diskContexts}
        selectedContextIds={selectedContextIds}
        onClose={() => {
          // Desbloquear + suppress post-cierre (click-through al mini del plano).
          onConfigClose?.()
          setConfigOpen(false)
        }}
        closeOnBackdrop
        onCommitIdentity={commitIdentity}
        onChangeCoordination={coordination => {
          onMetaChange(previous => {
            if (coordination === 'orchestrator' || coordination === 'productOwner') {
              const { acceptDelegations: _drop, delegateTo: _dt, ...rest } = previous
              if (coordination !== 'orchestrator') {
                const { orchestrationWorkStyle: _style, ...withoutStyle } = rest
                return { ...withoutStyle, coordination }
              }
              return { ...rest, coordination }
            }
            const {
              coordination: _drop,
              orchestrationMaxRounds: _rounds,
              orchestrationWorkStyle: _style,
              delegateTo: _dt,
              allowExpertReplicas: _replicas,
              ...rest
            } = previous
            return rest
          })
        }}
        onAcceptDelegationsChange={accept => {
          onMetaChange(previous => (
            accept
              ? (() => {
                const { acceptDelegations: _drop, ...rest } = previous
                return rest
              })()
              : { ...previous, acceptDelegations: false }
          ))
        }}
        onOrchestrationMaxRoundsChange={n => {
          onMetaChange(previous => {
            const maxRounds = resolveOrchestrationMaxRounds(n)
            if (maxRounds === MAX_ORCHESTRATION_ROUNDS) {
              const { orchestrationMaxRounds: _drop, ...rest } = previous
              return rest
            }
            return { ...previous, orchestrationMaxRounds: maxRounds }
          })
        }}
        onOrchestrationWorkStyleChange={workStyle => {
          onMetaChange(previous => {
            if (previous.coordination !== 'orchestrator') return previous
            if (workStyle === 'turbo') {
              return { ...previous, orchestrationWorkStyle: 'turbo' }
            }
            const { orchestrationWorkStyle: _drop, ...rest } = previous
            // Al volver a linear no apagar réplicas automáticamente.
            return rest
          })
        }}
        onChangeDelegateTo={policy => {
          onMetaChange(previous => {
            if (!policy) {
              const { delegateTo: _drop, ...rest } = previous
              return rest
            }
            return { ...previous, delegateTo: policy }
          })
        }}
        peerAgents={peerAgents}
        onChangeProvider={changeProvider}
        onChangeModel={changeModel}
        onChangePermission={changePermission}
        onChangeNativeSkills={nativeSkills => {
          onMetaChange(previous => {
            if (!nativeSkills) {
              const { nativeSkills: _drop, ...rest } = previous
              return rest
            }
            return { ...previous, nativeSkills }
          })
        }}
        onChangeMcpsAllowed={mcpsAllowed => {
          onMetaChange(previous => {
            if (!mcpsAllowed.length) {
              const { mcpsAllowed: _drop, ...rest } = previous
              return rest
            }
            return { ...previous, mcpsAllowed }
          })
        }}
        onToggleLoopMode={toggleLoopMode}
        onToggleContext={toggleContext}
        onOpenContextsModal={() => setContextsOpen(true)}
        onContextsTabFocus={() => { void refreshDiskContexts() }}
      />

      <QueuedTurnEditModal
        open={Boolean(editingQueuedId) && tabActive}
        initialText={editingQueuedText}
        onClose={() => setEditingQueuedId(null)}
        onSave={text => {
          if (editingQueuedId) updateQueuedTurn(editingQueuedId, text)
        }}
      />

      <ConfirmTerminalModal
        open={confirmClose}
        active={tabActive}
        message={t('agentPane.closeMessage')}
        detail={t('agentPane.closeDetail')}
        onConfirm={() => {
          setConfirmClose(false)
          stop()
          onClosePane?.()
        }}
        onCancel={() => setConfirmClose(false)}
      />
      <ConfirmTerminalModal
        open={confirmClear}
        active={tabActive}
        message={t('agentPane.clearConversationMessage')}
        detail={t('agentPane.clearConversationDetail')}
        zIndex={900}
        onConfirm={() => {
          setConfirmClear(false)
          deleteActiveThread()
        }}
        onCancel={() => setConfirmClear(false)}
      />
      <TabContextsModal
        open={contextsOpen && tabActive}
        contexts={diskContexts}
        agents={projectAgents}
        cwd={cwd}
        focusContextId={preferOpenContextId}
        onFocusContextConsumed={onPreferOpenContextConsumed}
        onRefresh={() => { void refreshDiskContexts() }}
        onClose={() => setContextsOpen(false)}
      />
      <AgentLoopIntervalModal
        open={loopIntervalModalOpen && tabActive}
        initialMs={loopContinueDelayMs}
        initialObjective={loopObjectiveRef.current || input}
        onConfirm={confirmLoopSetup}
        onClose={() => setLoopIntervalModalOpen(false)}
      />
    </div>
  )
}
