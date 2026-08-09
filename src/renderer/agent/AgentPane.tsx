import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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
import { extractTabContextUpdates, defaultAssignedContextIds } from '@shared/tabContext'
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
import { normalizeAgentSlug, isAgentOwnResultContext, withCatalogAgentResultContexts } from '@shared/projectAgentCatalog'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import type { OrchestrationAwaitingView } from '@shared/orchestrationAwaiting'
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
import { useT } from '@i18n/useT'
import { ConfirmTerminalModal } from '../components/ConfirmTerminalModal'
import { createPlaneStatusThrottler } from './planeStatusThrottle'
import { TabContextsModal } from './TabContextsModal'
import { AgentConfigModal } from './AgentConfigModal'
import type { DelegateToPeerAgent } from './AgentDelegateToPolicyEditor'
import { AgentLoopIntervalModal } from './AgentLoopIntervalModal'
import { AgentPaneMessages } from './AgentPaneMessages'
import { AgentPaneFooter } from './AgentPaneFooter'
import type { AgentChatBubblesHandle } from './AgentChatBubbles'
import { QueuedTurnEditModal } from './QueuedTurnEditModal'
import { canDrainAgentQueue, isAgentHumanInputBlocked } from './agentInputGuards'
import { filterQueuedTurnsAfterOrchestrationAbort } from '../orchestrationAbort'
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
import { decideParentDelegationNotify } from './parentDelegationNotify'
import { mergeQueuedTurns } from './mergeQueuedTurns'
import { useAiMessagesFollowScroll } from '../components/ai/useAiMessagesFollowScroll'
import './AgentPane.css'

const MAX_QUEUED_TURNS = 10
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
  delegation?: {
    id: string
    fromPaneId: string
    toAgentId: string
  }
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
  delegation?: {
    id: string
    fromPaneId: string
    toAgentId: string
  }
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
  /** El CLI del orquestador emitió delegaciones. */
  onOrchestratorDelegations?: (delegations: DelegateRequest[]) => void
  /** Stop del orquestador: cancelar subtareas pendientes originadas aquí. */
  onOrchestratorStop?: () => void
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
  /** Pedido externo: pedir confirmación para limpiar la conversación. */
  preferClearConversation?: boolean
  onPreferClearConversationConsumed?: () => void
  /**
   * El pane participa en una cadena Loops running/waiting:
   * el botón de loop del chat debe verse encendido (mismo estado visual).
   */
  chainLoopActive?: boolean
  /** El orquestador espera subtareas (Stop / drain; ya no bloquea teclear). */
  awaitingDelegations?: boolean
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
    delegation?: { id: string; fromPaneId: string; toAgentId: string }
  }>
  /** Hay historial, cola o sesión CLI que se pueden limpiar. */
  canClearConversation: boolean
}

export interface AgentPlaneQueueControls {
  remove: (id: string) => void
  update: (id: string, text: string) => void
  /** Fusiona los turnos humanos encolados (sin delegation/follow-up) en uno. */
  merge: () => void
  /** Quita subtareas del orquestador y follow-ups locales de ese pane. */
  cancelDelegationsFrom: (fromPaneId: string) => void
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
  chainLoopActive = false,
  awaitingDelegations = false,
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
  const [contextNotice, setContextNotice] = useState('')
  const [loopOpen, setLoopOpen] = useState(false)
  const [loopIntervalModalOpen, setLoopIntervalModalOpen] = useState(false)
  const [loopActive, setLoopActive] = useState(false)
  const orchestratorBusy = coordinationCanDelegate(meta.coordination) && busy
  const orchestrationWorkStyle = resolveOrchestrationWorkStyle(
    meta.coordination,
    meta.orchestrationWorkStyle,
  )
  const humanInputBlocked = isAgentHumanInputBlocked({ loopActive })
  const awaitingBlocksHuman = orchestrationWorkStyle !== 'turbo' && awaitingDelegations
  const canStartHumanTurnNow = !busy
    && !awaitingBlocksHuman
    && !delegationWorkActive
    && !systemFollowUpsPending
    && !loopActive
  const [loopEndReason, setLoopEndReason] = useState<'done' | 'max' | 'stopped' | null>(null)
  const [loopIteration, setLoopIteration] = useState(0)
  const [turnCloseReason, setTurnCloseReason] = useState<'completed' | 'aborted' | null>(null)
  /**
   * Catálogo vivo de contextos para este pane.
   * Personal: discover de `.gravity/*.md`. Org: `tabContexts` desde App/API.
   */
  const [diskContexts, setDiskContexts] = useState<TabContext[]>([])
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
  const loopActiveRef = useRef(false)
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
  /** Tras resetear la sesión CLI por cambio de modo, el próximo turno lleva historial. */
  const pendingModeHandoffRef = useRef(false)
  /** Dedup de preferSend (mismo objeto no debe despachar dos veces). */
  const handledPreferSendRef = useRef<AgentPreferSend | null>(null)
  /** Delegación en vuelo (especialista / orch ejecutando subtarea del padre). */
  const activeDelegationRef = useRef<{
    id: string
    fromPaneId: string
    toAgentId: string
  } | null>(null)
  /** Este turno emitió fences anidados; no despertar al padre aún. */
  const nestedDelegationsDispatchedThisTurnRef = useRef(false)
  const onOrchestratorDelegationsRef = useRef(onOrchestratorDelegations)
  onOrchestratorDelegationsRef.current = onOrchestratorDelegations
  const onOrchestratorStopRef = useRef(onOrchestratorStop)
  onOrchestratorStopRef.current = onOrchestratorStop
  const onDelegationTurnCompleteRef = useRef(onDelegationTurnComplete)
  onDelegationTurnCompleteRef.current = onDelegationTurnComplete
  const onOrchestrationUserTurnRef = useRef(onOrchestrationUserTurn)
  onOrchestrationUserTurnRef.current = onOrchestrationUserTurn
  const getOrchestrationAgentsRef = useRef(getOrchestrationAgents)
  getOrchestrationAgentsRef.current = getOrchestrationAgents
  const getOrchestrationRoundRef = useRef(getOrchestrationRound)
  getOrchestrationRoundRef.current = getOrchestrationRound
  const scrollRef = useRef<HTMLDivElement>(null)
  const bubblesRef = useRef<AgentChatBubblesHandle>(null)
  const composerInputRef = useRef<HTMLTextAreaElement>(null)
  messagesRef.current = messages
  metaRef.current = meta
  diskContextsRef.current = diskContexts
  cwdRef.current = cwd
  cwdOverrideRef.current = cwdOverride
  onMetaChangeRef.current = onMetaChange
  onProjectContextsChangedRef.current = onProjectContextsChanged
  busyRef.current = busy
  loopActiveRef.current = loopActive
  loopIterationRef.current = loopIteration
  const projectAgentsRef = useRef(projectAgents)
  projectAgentsRef.current = projectAgents

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
    // Org: el SSOT de contextos es el catálogo en memoria (API), no el discover
    // local. Podar contextIds contra disco borraría asignaciones por drag.
    if (orgWorkspaceRef.current) {
      discoveryHydratedRef.current = true
      return
    }
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
          : previous.contextIds.map(mapId).filter(id => discoveredIds.has(id))
      } else {
        // Conserva results asignados aunque este discover aún no los liste.
        nextIds = (previous.contextIds ?? []).map(mapId).filter(id => (
          discoveredIds.has(id) || id.startsWith('iaterminal:result:')
        ))
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

  const prepareContextDiscovery = useCallback((resolvedCwd: string): void => {
    const next = resolvedCwd.trim()
    if (discoveredCwdRef.current === next) return
    discoveredCwdRef.current = next
    setDiskContexts([])
    diskContextsRef.current = []
  }, [])

  const refreshDiskContexts = useCallback(async (): Promise<void> => {
    // Org: refrescar vía App (API), no discover de `.gravity`.
    if (orgWorkspaceRef.current) {
      onProjectContextsChangedRef.current?.()
      return
    }
    const resolvedCwd = await resolveWorkingCwd()
    // Siempre descubrir (migración canónica en disco), aunque el cwd no cambie.
    prepareContextDiscovery(resolvedCwd)
    if (!resolvedCwd) {
      return
    }
    const result = await window.api.discoverTabContexts({ cwd: resolvedCwd })
    if (!result.ok) return
    if (result.contextsMigrated) forceContextFullRefreshRef.current = true
    applyDiscoveredContexts(result.contexts, result.idRemap)
  }, [applyDiscoveredContexts, prepareContextDiscovery, resolveWorkingCwd])

  useEffect(() => {
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
      window.api.loadAgentChat(paneId),
      window.api.isAgentTurnActive(paneId).catch(() => false),
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
  }, [clearLoopTimer, paneId])

  useEffect(() => {
    if (!loaded) return
    window.api.saveAgentChat(paneId, messages)
  }, [loaded, messages, paneId])

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
    // Org: catálogo vía API (App). No discover local ni ensure de results en disco.
    if (orgWorkspaceRef.current) {
      onProjectContextsChangedRef.current?.()
      return
    }
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
        || chainLoopActive,
    }
    // busy/loops/activity: inmediato. Solo messages/snippet: throttle (~150ms).
    const controlKey = [
      busy ? '1' : '0',
      activity,
      busy ? (activeAssistantId ?? '') : '',
      settlingId ?? '',
      awaitingDelegations ? '1' : '0',
      orchestrationAwaiting
        ? `${orchestrationAwaiting.done}/${orchestrationAwaiting.total}:${orchestrationAwaiting.items.map(item => `${item.delegationId}:${item.status}`).join(',')}`
        : '',
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
      (meta.contextIds ?? []).join(','),
    ].join('\0')
    planeStatusThrottlerRef.current.schedule({
      controlKey,
      value: status,
      publish: onPlaneStatusChange,
    })
  }, [
    activeAssistantId,
    activity,
    awaitingDelegations,
    orchestrationAwaiting,
    busy,
    chainLoopActive,
    delegationWorkActive,
    diskContexts,
    enteringIds,
    loopActive,
    loopEndReason,
    loopOpen,
    materializingIds,
    messages,
    meta.cliSessionId,
    meta.contextIds,
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

  // Org: hidratar catálogo desde App (API) + results sintéticos del catálogo de agentes.
  useEffect(() => {
    if (!orgWorkspace?.slug?.trim() || !orgWorkspace?.workspaceId?.trim()) return
    commitContextsCatalog(tabContexts)
    discoveryHydratedRef.current = true
  }, [commitContextsCatalog, orgWorkspace?.slug, orgWorkspace?.workspaceId, paneId, tabContexts])

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

  // Personal: catálogo = disco. Se refresca al cambiar cwd y al abrir el gestor.
  useEffect(() => {
    if (orgWorkspace?.slug?.trim() && orgWorkspace?.workspaceId?.trim()) return
    let cancelled = false
    void resolveWorkingCwd().then(async resolvedCwd => {
      if (cancelled) return
      prepareContextDiscovery(resolvedCwd)
      if (!resolvedCwd) {
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
    contextsOpen,
    contextsRevision,
    cwd,
    orgWorkspace?.slug,
    orgWorkspace?.workspaceId,
    prepareContextDiscovery,
    resolveWorkingCwd,
  ])

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
    activeAssistantIdRef.current = assistant.id
    lastAssistantIdRef.current = assistant.id
    setActiveAssistantId(assistant.id)
    turnGenRef.current += 1
    turnClosedRef.current = false
    nestedDelegationsDispatchedThisTurnRef.current = false
    // Conservar hold del padre en follow-ups; solo fijar si llega una nueva subtarea.
    if (options.delegation) {
      activeDelegationRef.current = options.delegation
    }
    // Al enviar, siempre aterrizar en el fondo (aunque el follow estuviera off).
    forceFollow()
    setMessages(prev => [...prev, user, assistant])
    setActivity('')
    setTurnCloseReason(null)
    setBusy(true)

    const currentMeta = metaRef.current
    const assigned = options.contexts
    // Base: usada para contextos (.gravity vive en el proyecto, nunca en el worktree).
    const resolvedCwd = await resolveWorkingCwd()

    if (assigned.length && resolvedCwd) {
      const previews = await Promise.all(
        assigned.map(context => window.api.previewTabContext({ context, cwd: resolvedCwd })),
      )
      if (previews.every(preview => !preview.ok || !preview.content.trim())) {
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
        nestedDelegationsDispatchedThisTurnRef.current = false
        const failedDelegation = activeDelegationRef.current
        activeDelegationRef.current = null
        if (failedDelegation) {
          onDelegationTurnCompleteRef.current?.({
            id: failedDelegation.id,
            status: 'fail',
            summary: t('tabContexts.materializeFailed'),
            toAgentId: failedDelegation.toAgentId,
            toPaneId: paneId,
          })
        }
        return false
      }
    }
    if (assigned.length && !resolvedCwd) {
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
      nestedDelegationsDispatchedThisTurnRef.current = false
      const failedDelegation = activeDelegationRef.current
      activeDelegationRef.current = null
      if (failedDelegation) {
        onDelegationTurnCompleteRef.current?.({
          id: failedDelegation.id,
          status: 'fail',
          summary: t('tabContexts.missingCwd'),
          toAgentId: failedDelegation.toAgentId,
          toPaneId: paneId,
        })
      }
      return false
    }
    // messagesRef aún no incluye el user/assistant de este turno.
    const priorMessages = messagesRef.current
    let prompt = options.prompt
    if (pendingModeHandoffRef.current) {
      pendingModeHandoffRef.current = false
      prompt = buildModeHandoffPrompt(priorMessages, options.prompt)
    }
    emptyResponseRetriesRef.current = 0
    suppressEmptyHandlingRef.current = false
    // Override-aware: solo el spawn del CLI usa el worktree si hay uno asignado.
    const turnCwd = await resolveTurnCwd()
    const rules = normalizeAgentRules(currentMeta.rules)
    const canDelegate = coordinationCanDelegate(currentMeta.coordination)
    const orchestrationAgents = canDelegate
      ? (getOrchestrationAgentsRef.current?.() ?? [])
      : []
    const roundInfo = canDelegate ? getOrchestrationRoundRef.current?.() : undefined
    const request: AgentCliStartRequest = {
      paneId,
      provider: currentMeta.provider,
      prompt,
      cwd: turnCwd,
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
      autoImproveContexts: currentMeta.autoImproveContexts === true,
      emitResults: true,
      ...(forceContextFullRefreshRef.current
        ? { forceContextFullRefresh: true }
        : {}),
      ...(canDelegate
        ? {
            coordination: currentMeta.coordination === 'productOwner'
              ? 'productOwner' as const
              : 'orchestrator' as const,
            orchestrationAgents,
            ...((
              currentMeta.allowExpertReplicas === true
              || roundInfo?.workStyle === 'turbo'
            ) ? { allowExpertReplicas: true } : {}),
            ...(roundInfo?.workStyle === 'turbo'
              ? { orchestrationWorkStyle: 'turbo' as const }
              : {}),
            ...(roundInfo?.jobId?.trim()
              ? { orchestrationJobId: roundInfo.jobId.trim() }
              : options.orchestrationJobId?.trim()
                ? { orchestrationJobId: options.orchestrationJobId.trim() }
                : {}),
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
      cliSessionId: currentMeta.cliSessionId,
      ...(options.images?.length ? { images: options.images } : {}),
      ...(orgWorkspaceRef.current ? { workspace: orgWorkspaceRef.current } : {}),
      ...(options.viaLoop ? { viaLoop: true } : {}),
    }
    if (forceContextFullRefreshRef.current) forceContextFullRefreshRef.current = false
    lastTurnRequestRef.current = request
    window.api.startAgentTurn(request)
    return true
  }, [forceFollow, paneId, resolveTurnCwd, resolveWorkingCwd, t])

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
      const assigned = new Set(metaRef.current.contextIds ?? [])
      const currentCwd = cwdRef.current
      if (currentCwd) {
        const refresh = diskContextsRef.current.filter(context => assigned.has(context.id))
        contextWriteQueueRef.current = contextWriteQueueRef.current
          .catch(() => undefined)
          .then(() => Promise.all(refresh.map(context =>
            window.api.materializeTabContext({ context, cwd: currentCwd }))))
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

      const delegation = activeDelegationRef.current
      const decision = decideParentDelegationNotify({
        held: Boolean(delegation),
        dispatchedNested: nestedDelegationsDispatchedThisTurnRef.current,
      })
      nestedDelegationsDispatchedThisTurnRef.current = false
      if (decision === 'notify' && delegation) {
        activeDelegationRef.current = null
        const summary = isEmpty
          ? t('agentPane.delegationEmptySummary')
          : (message?.content ?? '').trim().slice(0, 500) || t('agentPane.delegationEmptySummary')
        onDelegationTurnCompleteRef.current?.({
          id: delegation.id,
          status: isEmpty ? 'fail' : 'ok',
          summary,
          toAgentId: delegation.toAgentId,
          toPaneId: paneId,
        })
      }

      emptyResponseRetriesRef.current = 0
      finishSideEffects()
    }, 0)
  }, [beginLiveSettle, clearLoopTimer, finishLoop, paneId, t])

  const applyCliEvent = useCallback((event: AgentCliUiEvent): void => {
    if (!loadedRef.current) {
      pendingCliEventsRef.current.push(event)
      return
    }
    if (event.type === 'done') {
      completeTurn()
      return
    }
    if (event.type === 'delegate') {
      if (event.delegations.length > 0) {
        nestedDelegationsDispatchedThisTurnRef.current = true
      }
      onOrchestratorDelegationsRef.current?.(event.delegations)
      if (event.delegations.length) {
        const names = event.delegations
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
      onMetaChange(previous => ({ ...previous, cliSessionId: event.cliSessionId }))
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
      let { visibleText, updates } = extractTabContextUpdates(event.text)
      if (loopActiveRef.current) {
        const stripped = stripLoopDoneMarker(visibleText)
        visibleText = stripped.text
        if (stripped.done) loopDoneRef.current = true
      }
      const currentMeta = metaRef.current
      const currentContexts = diskContextsRef.current
      const assigned = new Set(currentMeta.contextIds ?? [])
      const valid = currentMeta.autoImproveContexts === true
        ? updates.filter(update =>
            assigned.has(update.id) &&
            update.kind !== 'agentResult' &&
            update.kind !== 'notes' &&
            Array.isArray(update.annotations) &&
            update.annotations.length > 0)
        : []
      if (valid.length) {
        const writes = valid.flatMap(update => {
          const context = currentContexts.find(item =>
            item.id === update.id && item.kind === update.kind)
          const currentCwd = cwdRef.current
          if (!context || !currentCwd || !update.annotations?.length) return []
          return [{ context, cwd: currentCwd, annotations: update.annotations }]
        })
        if (writes.length) {
          contextWriteQueueRef.current = contextWriteQueueRef.current
            .catch(() => undefined)
            .then(async () => {
              for (const request of writes) {
                await window.api.mergeTabContextAnnotations(request)
              }
            })
          setContextNotice(t('tabContexts.updated', { n: writes.length }))
          window.setTimeout(() => setContextNotice(''), 3500)
        }
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

  applyCliEventRef.current = applyCliEvent
  completeTurnRef.current = completeTurn

  useEffect(() => {
    // Suscripción estable por paneId: no re-suscribir al re-render (resize/split
    // recreaba callbacks y perdía eventos done/delta a mitad de stream).
    const offEvent = window.api.onAgentCliEvent(paneId, event => {
      applyCliEventRef.current(event)
    })
    const offExit = window.api.onAgentCliExit(paneId, () => {
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
  }, [paneId])

  useEffect(() => {
    return () => {
      clearLoopTimer()
      // No llamar stopAgentTurn aquí: el layout (split/resize) remonta el panel
      // y mataría un stream vivo. App ya detiene el turno al cerrar el pane.
    }
  }, [clearLoopTimer])

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
    /**
     * Los del catálogo del agente más los que vengan adjuntos al turno. El Set
     * deduplica: adjuntar algo ya asignado no lo manda dos veces.
     */
    const wantedContextIds = new Set([
      ...(metaRef.current.contextIds ?? []),
      ...(options?.extraContextIds ?? []),
    ])
    const assigned = diskContextsRef.current.filter(context =>
      wantedContextIds.has(context.id))
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
  }, [startTurn, t])

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

  const send = useCallback((): void => {
    const prompt = input.trim()
    if ((!prompt && pendingImages.length === 0) || humanInputBlocked) return
    if (!canStartHumanTurnNow && queuedTurns.length >= MAX_QUEUED_TURNS) return
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
    void dispatchMessage(prompt, imagesSnapshot)
  }, [
    canStartHumanTurnNow,
    dispatchMessage,
    humanInputBlocked,
    input,
    onRequestPaneFocus,
    pendingImages,
    queuedTurns.length,
  ])

  useEffect(() => {
    if (!preferSend) {
      handledPreferSendRef.current = null
      return
    }
    // Evitar doble envío: startTurn pone busy y re-ejecuta el effect con el
    // mismo preferSend antes de que el padre lo limpie.
    if (handledPreferSendRef.current === preferSend) return
    // Loop local activo: no consumir; App reintentará cuando termine.
    if (loopActive) return
    handledPreferSendRef.current = preferSend
    const prompt = preferSend.text.trim()
    const inboundImages = preferSend.images ?? []
    const delegation = preferSend.delegation
    const orchestrationFollowUp = preferSend.orchestrationFollowUp === true
    const viaLoop = preferSend.viaLoop === true
    const extraContextIds = preferSend.extraContextIds ?? []
    const allowDelegations = preferSend.allowDelegations
    const orchestrationJobId = preferSend.orchestrationJobId
    const isHumanTurn = !orchestrationFollowUp && !delegation
    // Busy: no consumir follow-ups ni delegaciones; App FIFO reintenta al idle.
    if (busy && (preferSend.focusPane === false || Boolean(delegation))) {
      handledPreferSendRef.current = null
      return
    }
    onPreferSendConsumed?.()
    if (!prompt && inboundImages.length === 0) return
    if (preferSend.focusPane !== false) onRequestPaneFocus()
    const imagesSnapshot = attachmentsToPendingImages(inboundImages)
    const turnOptions = {
      ...(delegation ? { delegation } : {}),
      ...(allowDelegations === false ? { allowDelegations: false as const } : {}),
      ...(orchestrationFollowUp ? { orchestrationFollowUp: true as const } : {}),
      ...(orchestrationJobId?.trim() ? { orchestrationJobId: orchestrationJobId.trim() } : {}),
      ...(viaLoop ? { viaLoop: true as const } : {}),
      ...(extraContextIds.length ? { extraContextIds } : {}),
    }
    // Solo humanos / no-delegación encolan en local; delegaciones nunca mientras busy.
    const shouldEnqueue = busy || (isHumanTurn && !canStartHumanTurnNow)
    if (shouldEnqueue) {
      setQueuedTurns(prev => {
        if (prev.length >= MAX_QUEUED_TURNS) {
          imagesSnapshot.forEach(image => URL.revokeObjectURL(image.previewUrl))
          return prev
        }
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
      return
    }
    if (
      isHumanTurn
      && coordinationCanDelegate(metaRef.current.coordination)
    ) {
      onOrchestrationUserTurnRef.current?.()
    }
    void dispatchMessage(prompt, imagesSnapshot, turnOptions)
  }, [
    busy,
    canStartHumanTurnNow,
    dispatchMessage,
    loopActive,
    onPreferSendConsumed,
    onRequestPaneFocus,
    preferSend,
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

  useEffect(() => {
    if (!onPlaneQueueControlsReady) return
    onPlaneQueueControlsReady({
      remove: removeQueuedTurn,
      update: updateQueuedTurn,
      merge: handleMergeQueuedTurns,
      cancelDelegationsFrom,
    })
    return () => onPlaneQueueControlsReady(null)
  }, [
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
    if (!canDrainAgentQueue({
      loaded,
      busy,
      loopActive,
      awaitingDelegations,
      delegationWorkActive,
      systemFollowUpsPending: systemFollowUpsPending || preferSend != null,
      headIsDelegation,
      orchestrationWorkStyle,
    }) || drainingRef.current) return
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
    beginLiveSettle(activeAssistantIdRef.current)
    setTurnCloseReason('aborted')
    setBusy(false)
    setActivity('')
    activeAssistantIdRef.current = null
    setActiveAssistantId(null)
    nestedDelegationsDispatchedThisTurnRef.current = false
    const delegation = activeDelegationRef.current
    const decision = decideParentDelegationNotify({
      held: Boolean(delegation),
      dispatchedNested: false,
      aborted: true,
    })
    activeDelegationRef.current = null
    if (decision === 'notify' && delegation) {
      onDelegationTurnCompleteRef.current?.({
        id: delegation.id,
        status: 'aborted',
        summary: t('agentPane.delegationAbortedSummary'),
        toAgentId: delegation.toAgentId,
        toPaneId: paneId,
      })
    }
    if (wasLoop) finishLoop('stopped')
    if (chainLoopActive) onChainLoopStop?.()
    if (coordinationCanDelegate(metaRef.current.coordination)) {
      onOrchestratorStopRef.current?.()
    }
  }, [beginLiveSettle, chainLoopActive, clearLoopTimer, finishLoop, onChainLoopStop, paneId, t])

  useEffect(() => {
    if (!preferStop) return
    onPreferStopConsumed?.()
    stop()
  }, [onPreferStopConsumed, preferStop, stop])

  const clearConversation = useCallback((): void => {
    clearLoopTimer()
    const wasLoop = loopActiveRef.current
    const wasRunning = busyRef.current || wasLoop
    turnClosedRef.current = true
    emptyResponseRetriesRef.current = 0
    lastTurnRequestRef.current = null
    suppressEmptyHandlingRef.current = true
    if (wasRunning) {
      window.api.stopAgentTurn(paneId)
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
    const currentMeta = metaRef.current
    const sessionId = currentMeta.cliSessionId?.trim()
    if (sessionId) {
      window.api.clearAgentContextDelivery({
        provider: currentMeta.provider,
        cliSessionId: sessionId,
      })
    }
    onMetaChange(previous => {
      if (!previous.cliSessionId) return previous
      const { cliSessionId: _dropped, ...rest } = previous
      return rest
    })
    window.api.deleteAgentChat(paneId)
  }, [beginLiveSettle, clearLoopTimer, onMetaChange, paneId])

  const requestClearConversation = useCallback((): void => {
    setConfirmClear(true)
  }, [])

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
    // Si había un turno normal en curso, se corta sin notify: startAgentTurn
    // mata el proceso anterior en silencio (evita que un done/EXIT cierre el loop).
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
    input,
    onChainLoopStop,
    onRequestPaneFocus,
    runLoopIteration,
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
  const showStop = effectiveLoopActive || busy || awaitingDelegations
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
    else send()
  }, [buttonIsStop, hasComposerPayload, send, showPlay, startLoop, stop])

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
            onRemovePendingImage={removePendingImage}
            onSendClick={handleSendClick}
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
        contextNotice={contextNotice}
        orgWorkspace={orgWorkspace}
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
        onAllowExpertReplicasChange={allow => {
          onMetaChange(previous => (
            allow
              ? { ...previous, allowExpertReplicas: true }
              : (() => {
                const { allowExpertReplicas: _drop, ...rest } = previous
                return rest
              })()
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
              return {
                ...previous,
                orchestrationWorkStyle: 'turbo',
                allowExpertReplicas: true,
              }
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
        onAutoImproveChange={checked => onMetaChange(previous => ({
          ...previous,
          autoImproveContexts: checked,
        }))}
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
          clearConversation()
        }}
        onCancel={() => setConfirmClear(false)}
      />
      <TabContextsModal
        open={contextsOpen && tabActive}
        contexts={diskContexts}
        agents={projectAgents}
        cwd={cwd}
        orgWorkspace={orgWorkspace}
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
