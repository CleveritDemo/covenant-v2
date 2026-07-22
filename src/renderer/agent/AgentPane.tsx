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
  buildLoopPrompt,
  formatLoopIntervalMs,
  LOOP_INTERVAL_PRESETS,
  MAX_AGENT_LOOP_ITERATIONS,
  stripLoopDoneMarker,
} from '@shared/agentLoop'
import { buildModeHandoffPrompt } from '@shared/agentModeHandoff'
import {
  AGENT_NAME_MAX_LENGTH,
  AGENT_OBJECTIVE_MAX_LENGTH,
  AGENT_ROLE_MAX_LENGTH,
} from '@shared/agentIdentity'
import { useT } from '@i18n/useT'
import { ConfirmTerminalModal } from '../components/ConfirmTerminalModal'
import { TabContextsModal } from './TabContextsModal'
import { AgentConfigModal } from './AgentConfigModal'
import { AgentLoopIntervalModal } from './AgentLoopIntervalModal'
import { AgentPaneMessages } from './AgentPaneMessages'
import { AgentPaneFooter } from './AgentPaneFooter'
import type { AgentChatBubblesHandle } from './AgentChatBubbles'
import { QueuedTurnEditModal } from './QueuedTurnEditModal'
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
}

export interface AgentPreferSend {
  text: string
  images?: AgentCliImageAttachment[]
}

interface Props {
  paneId: string
  meta: AgentPaneMeta
  /** Carpeta del proyecto de la pestaña (única fuente de cwd del agente). */
  cwd: string
  tabActive: boolean
  isActivePane: boolean
  /** Ventana del agente abierta en el plano (no mini). Dispara scroll al fondo. */
  windowOpen?: boolean
  /** Mismo tamaño tipográfico que las terminales (`config.fontSize`). */
  fontSize: number
  onMetaChange: (meta: AgentPaneMeta | ((previous: AgentPaneMeta) => AgentPaneMeta)) => void
  onRequestPaneFocus: () => void
  onClosePane?: () => void
  onBusyChange?: (busy: boolean) => void
  /** Estado para el mapa 2D del plano (preview / satélites). */
  onPlaneStatusChange?: (status: AgentPlaneStatus) => void
  /** Registra el toggle de loop para el chat del plano (null al desmontar). */
  onPlaneLoopToggleReady?: (toggle: (() => void) | null) => void
  /** Controles de cola (quitar / editar) para el composer del plano. */
  onPlaneQueueControlsReady?: (controls: AgentPlaneQueueControls | null) => void
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
  /** Pedido externo: pedir confirmación para limpiar la conversación. */
  preferClearConversation?: boolean
  onPreferClearConversationConsumed?: () => void
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
  loopMode: boolean
  loopActive: boolean
  queuedTurns: Array<{
    id: string
    text: string
    images: Array<{ id: string; previewUrl: string; name: string }>
  }>
  /** Hay historial, cola o sesión CLI que se pueden limpiar. */
  canClearConversation: boolean
}

export interface AgentPlaneQueueControls {
  remove: (id: string) => void
  update: (id: string, text: string) => void
}

function systemMessage(content: string): AgentChatEntry {
  return { id: crypto.randomUUID(), role: 'system', content }
}

export const AgentPane: React.FC<Props> = ({
  paneId,
  meta,
  cwd,
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
  preferClearConversation = false,
  onPreferClearConversationConsumed,
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
  const [loopIteration, setLoopIteration] = useState(0)
  /** Catálogo vivo desde `.iaterminal/*.md` (no se persiste en session). */
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
  const liveSettleTimerRef = useRef<number | null>(null)
  const messagesRef = useRef(messages)
  const metaRef = useRef(meta)
  const diskContextsRef = useRef(diskContexts)
  const cwdRef = useRef(cwd)
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
  /** Tras resetear la sesión CLI por cambio de modo, el próximo turno lleva historial. */
  const pendingModeHandoffRef = useRef(false)
  /** Dedup de preferSend (mismo objeto no debe despachar dos veces). */
  const handledPreferSendRef = useRef<AgentPreferSend | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bubblesRef = useRef<AgentChatBubblesHandle>(null)
  const composerInputRef = useRef<HTMLTextAreaElement>(null)
  messagesRef.current = messages
  metaRef.current = meta
  diskContextsRef.current = diskContexts
  cwdRef.current = cwd
  busyRef.current = busy
  loopActiveRef.current = loopActive
  loopIterationRef.current = loopIteration

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

  const resolveWorkingCwd = useCallback(async (): Promise<string> => {
    return cwdRef.current.trim()
  }, [])

  const applyDiscoveredContexts = useCallback((discovered: TabContext[]): void => {
    setDiskContexts(discovered)
    diskContextsRef.current = discovered
    const discoveredIds = new Set(discovered.map(context => context.id))
    const currentMeta = metaRef.current
    let nextIds: string[]
    if (!discoveryHydratedRef.current) {
      discoveryHydratedRef.current = true
      // Solo la primera carga: si el agente nunca eligió contextos, aplica defaults.
      // Crear/editar un contexto no debe asignarlo solo.
      nextIds = currentMeta.contextIds == null
        ? defaultAssignedContextIds(discovered)
        : currentMeta.contextIds.filter(id => discoveredIds.has(id))
    } else {
      // Conservar asignaciones existentes; no auto-asignar contextos recién creados.
      nextIds = (currentMeta.contextIds ?? []).filter(id => discoveredIds.has(id))
    }
    const prev = currentMeta.contextIds ?? []
    if (nextIds.length !== prev.length || nextIds.some((id, index) => id !== prev[index])) {
      // Updater funcional: evita pisar autoImprove u otros campos si hay otra
      // actualización de meta en vuelo (p. ej. el switch de Auto improve).
      onMetaChange(previous => ({ ...previous, contextIds: nextIds }))
    }
  }, [onMetaChange])

  const prepareContextDiscovery = useCallback((resolvedCwd: string): void => {
    const next = resolvedCwd.trim()
    if (discoveredCwdRef.current === next) return
    discoveredCwdRef.current = next
    setDiskContexts([])
    diskContextsRef.current = []
  }, [])

  const refreshDiskContexts = useCallback(async (): Promise<void> => {
    const resolvedCwd = await resolveWorkingCwd()
    prepareContextDiscovery(resolvedCwd)
    if (!resolvedCwd) {
      return
    }
    const result = await window.api.discoverTabContexts({ cwd: resolvedCwd })
    if (!result.ok) return
    applyDiscoveredContexts(result.contexts)
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
    setLoopActive(false)
    setLoopIteration(0)
    setBusy(false)
    setActivity('')
    activeAssistantIdRef.current = null
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
        } else {
          const id = crypto.randomUUID()
          activeAssistantIdRef.current = id
          lastAssistantIdRef.current = id
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
    onPlaneStatusChange({
      busy,
      activity,
      lastSnippet,
      contexts,
      messages: messages
        .filter(entry => entry.role === 'user' || entry.role === 'assistant'),
      activeAssistantId: busy ? activeAssistantIdRef.current : null,
      enteringIds: [...enteringIds],
      materializingIds: [...materializingIds],
      settlingId,
      loopMode: loopOpen || loopActive,
      loopActive,
      queuedTurns: queuedTurns.map(item => ({
        id: item.id,
        text: item.text,
        images: item.images.map(image => ({
          id: image.id,
          previewUrl: image.previewUrl,
          name: image.name,
        })),
      })),
      canClearConversation: messages.length > 0
        || queuedTurns.length > 0
        || pendingImages.length > 0
        || Boolean(meta.cliSessionId)
        || busy
        || loopActive,
    })
  }, [
    activity,
    busy,
    diskContexts,
    enteringIds,
    loopActive,
    loopOpen,
    materializingIds,
    messages,
    meta.cliSessionId,
    meta.contextIds,
    onPlaneStatusChange,
    pendingImages.length,
    queuedTurns,
    settlingId,
  ])

  // Catálogo = disco. Se refresca al cambiar cwd y al abrir el gestor.
  useEffect(() => {
    let cancelled = false
    void resolveWorkingCwd().then(async resolvedCwd => {
      if (cancelled) return
      prepareContextDiscovery(resolvedCwd)
      if (!resolvedCwd) {
        return
      }
      const result = await window.api.discoverTabContexts({ cwd: resolvedCwd })
      if (cancelled || !result.ok) return
      applyDiscoveredContexts(result.contexts)
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [applyDiscoveredContexts, contextsOpen, cwd, prepareContextDiscovery, resolveWorkingCwd])

  const startTurn = useCallback(async (options: {
    prompt: string
    displayUser: string
    contexts: TabContext[]
    permissionMode?: AgentPermissionMode
    images?: AgentCliImageAttachment[]
    displayImages?: AgentChatImage[]
  }): Promise<boolean> => {
    const assistant: AgentChatEntry = { id: crypto.randomUUID(), role: 'assistant', content: '' }
    const user: AgentChatEntry = {
      id: crypto.randomUUID(),
      role: 'user',
      content: options.displayUser,
      ...(options.displayImages?.length ? { images: options.displayImages } : {}),
    }
    activeAssistantIdRef.current = assistant.id
    lastAssistantIdRef.current = assistant.id
    turnGenRef.current += 1
    turnClosedRef.current = false
    // Al enviar, siempre aterrizar en el fondo (aunque el follow estuviera off).
    forceFollow()
    setMessages(prev => [...prev, user, assistant])
    setActivity('')
    setBusy(true)

    const currentMeta = metaRef.current
    const assigned = options.contexts
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
        setBusy(false)
        turnClosedRef.current = true
        activeAssistantIdRef.current = null
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
      setBusy(false)
      turnClosedRef.current = true
      activeAssistantIdRef.current = null
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
    const request: AgentCliStartRequest = {
      paneId,
      provider: currentMeta.provider,
      prompt,
      cwd: resolvedCwd,
      permissionMode: options.permissionMode ?? currentMeta.permissionMode,
      ...(currentMeta.name?.trim() ? { name: currentMeta.name.trim() } : {}),
      ...(currentMeta.role?.trim() ? { role: currentMeta.role.trim() } : {}),
      ...(currentMeta.objective?.trim() ? { objective: currentMeta.objective.trim() } : {}),
      ...(currentMeta.model?.trim() ? { model: currentMeta.model.trim() } : {}),
      contexts: assigned,
      discoveredContexts: diskContextsRef.current,
      autoImproveContexts: currentMeta.autoImproveContexts === true,
      emitResults: currentMeta.emitResults === true,
      cliSessionId: currentMeta.cliSessionId,
      ...(options.images?.length ? { images: options.images } : {}),
    }
    lastTurnRequestRef.current = request
    window.api.startAgentTurn(request)
    return true
  }, [forceFollow, paneId, resolveWorkingCwd, t])

  const finishLoop = useCallback((reason: 'stopped' | 'done' | 'max'): void => {
    clearLoopTimer()
    loopActiveRef.current = false
    loopDoneRef.current = false
    setLoopActive(false)
    setLoopIteration(0)
    loopIterationRef.current = 0
    const message = reason === 'done'
      ? t('agentPane.loopCompleted')
      : reason === 'max'
        ? t('agentPane.loopMaxIterations', { n: MAX_AGENT_LOOP_ITERATIONS })
        : t('agentPane.loopStopped')
    setMessages(prev => [...prev, systemMessage(message)])
  }, [clearLoopTimer, t])

  const runLoopIteration = useCallback((iteration: number): void => {
    const objective = loopObjectiveRef.current.trim()
    if (!objective || !loopActiveRef.current) return
    loopIterationRef.current = iteration
    setLoopIteration(iteration)
    const assigned = diskContextsRef.current.filter(context =>
      (metaRef.current.contextIds ?? []).includes(context.id))
    setMessages(prev => [
      ...prev,
      systemMessage(t('agentPane.loopIteration', { n: iteration, objective })),
    ])
    void startTurn({
      prompt: buildLoopPrompt(objective, iteration),
      displayUser: iteration === 1
        ? `${t('agentPane.loopObjectiveLabel')}: ${objective}`
        : t('agentPane.loopContinueLabel', { n: iteration }),
      contexts: assigned,
    }).then(ok => {
      if (!ok && loopActiveRef.current) finishLoop('stopped')
    })
  }, [finishLoop, startTurn, t])

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
        if (loopActiveRef.current) runLoopIteration(nextIteration)
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
        }
        lastTurnRequestRef.current = retryRequest
        turnClosedRef.current = false
        turnGenRef.current += 1
        activeAssistantIdRef.current = id
        lastAssistantIdRef.current = id
        setBusy(true)
        setActivity('')
        setMessages(prev => prev.map(entry => (
          entry.id === id ? { ...entry, content: '' } : entry
        )))
        window.api.startAgentTurn(retryRequest)
        return
      }

      beginLiveSettle(id)
      setBusy(false)
      activeAssistantIdRef.current = null
      if (isEmpty && id) {
        setMessages(prev => prev.map(entry =>
          entry.id === id
            ? {
                ...entry,
                content: `${t('agentPane.errorPrefix')}: ${t('agentPane.emptyResponse')}`,
              }
            : entry))
      }
      emptyResponseRetriesRef.current = 0
      finishSideEffects()
    }, 0)
  }, [beginLiveSettle, clearLoopTimer, finishLoop, runLoopIteration, t])

  const applyCliEvent = useCallback((event: AgentCliUiEvent): void => {
    if (!loadedRef.current) {
      pendingCliEventsRef.current.push(event)
      return
    }
    if (event.type === 'done') {
      completeTurn()
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
  ): Promise<void> => {
    const assigned = diskContextsRef.current.filter(context =>
      (metaRef.current.contextIds ?? []).includes(context.id))
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
    await startTurn({
      prompt,
      displayUser: displayUser || (displayImages.length ? '' : t('agentPane.imageOnlyMessage')),
      contexts: assigned,
      ...(images.length ? { images } : {}),
      ...(displayImages.length ? { displayImages } : {}),
    })
  }, [startTurn, t])

  const send = useCallback((): void => {
    const prompt = input.trim()
    if ((!prompt && pendingImages.length === 0) || loopActive) return
    if (busy && queuedTurns.length >= MAX_QUEUED_TURNS) return
    onRequestPaneFocus()
    const imagesSnapshot = pendingImages
    setInput('')
    setPendingImages([])
    if (busy) {
      setQueuedTurns(prev => [
        ...prev,
        { id: crypto.randomUUID(), text: prompt, images: imagesSnapshot },
      ])
      return
    }
    void dispatchMessage(prompt, imagesSnapshot)
  }, [
    busy,
    dispatchMessage,
    input,
    loopActive,
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
    handledPreferSendRef.current = preferSend
    const prompt = preferSend.text.trim()
    const inboundImages = preferSend.images ?? []
    onPreferSendConsumed?.()
    if ((!prompt && inboundImages.length === 0) || loopActive) return
    onRequestPaneFocus()
    const imagesSnapshot = attachmentsToPendingImages(inboundImages)
    if (busy) {
      setQueuedTurns(prev => {
        if (prev.length >= MAX_QUEUED_TURNS) {
          imagesSnapshot.forEach(image => URL.revokeObjectURL(image.previewUrl))
          return prev
        }
        return [...prev, { id: crypto.randomUUID(), text: prompt, images: imagesSnapshot }]
      })
      return
    }
    void dispatchMessage(prompt, imagesSnapshot)
  }, [
    busy,
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

  useEffect(() => {
    if (!onPlaneQueueControlsReady) return
    onPlaneQueueControlsReady({ remove: removeQueuedTurn, update: updateQueuedTurn })
    return () => onPlaneQueueControlsReady(null)
  }, [onPlaneQueueControlsReady, removeQueuedTurn, updateQueuedTurn])

  /** Drenaje automático: al liberarse el turno sale el siguiente FIFO. */
  const drainingRef = useRef(false)
  useEffect(() => {
    if (!loaded || busy || loopActive || drainingRef.current) return
    const next = queuedTurns[0]
    if (!next) return
    drainingRef.current = true
    setQueuedTurns(prev => prev.filter(item => item.id !== next.id))
    void dispatchMessage(next.text, next.images).finally(() => {
      drainingRef.current = false
    })
  }, [busy, dispatchMessage, loaded, loopActive, queuedTurns])

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
    setBusy(false)
    setActivity('')
    activeAssistantIdRef.current = null
    if (wasLoop) finishLoop('stopped')
  }, [beginLiveSettle, clearLoopTimer, finishLoop, paneId])

  useEffect(() => {
    if (!preferStop) return
    onPreferStopConsumed?.()
    stop()
  }, [onPreferStopConsumed, preferStop, stop])

  const clearConversation = useCallback((): void => {
    clearLoopTimer()
    const wasRunning = busyRef.current || loopActiveRef.current
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
    setLoopActive(false)
    setLoopIteration(0)
    setBusy(false)
    setActivity('')
    activeAssistantIdRef.current = null
    lastAssistantIdRef.current = null
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

  const startLoop = useCallback((): void => {
    const objective = input.trim()
    if (!objective || loopActive) return
    onRequestPaneFocus()
    // Si había un turno normal en curso, se corta y la instrucción se reinicia en loop.
    if (busyRef.current) {
      skipLoopContinueRef.current = true
      turnClosedRef.current = true
      emptyResponseRetriesRef.current = 0
      lastTurnRequestRef.current = null
      suppressEmptyHandlingRef.current = true
      window.api.stopAgentTurn(paneId)
      beginLiveSettle(activeAssistantIdRef.current)
      setBusy(false)
      setActivity('')
      activeAssistantIdRef.current = null
    }
    clearLoopTimer()
    loopObjectiveRef.current = objective
    loopDoneRef.current = false
    loopActiveRef.current = true
    setLoopActive(true)
    setLoopOpen(true)
    setMessages(prev => [
      ...prev,
      systemMessage(t('agentPane.loopStarted', {
        objective,
        interval: formatLoopIntervalMs(loopContinueDelayMsRef.current),
      })),
    ])
    runLoopIteration(1)
  }, [beginLiveSettle, clearLoopTimer, input, loopActive, onRequestPaneFocus, paneId, runLoopIteration, t])

  const toggleLoopMode = useCallback((): void => {
    if (loopActive) return
    if (loopOpen) {
      setLoopOpen(false)
      return
    }
    setLoopIntervalModalOpen(true)
  }, [loopActive, loopOpen])

  useEffect(() => {
    if (!onPlaneLoopToggleReady) return
    onPlaneLoopToggleReady(toggleLoopMode)
    return () => onPlaneLoopToggleReady(null)
  }, [onPlaneLoopToggleReady, toggleLoopMode])

  const confirmLoopInterval = useCallback((delayMs: number): void => {
    loopContinueDelayMsRef.current = delayMs
    setLoopContinueDelayMs(delayMs)
    setLoopIntervalModalOpen(false)
    setLoopOpen(true)
  }, [])

  const changePermission = (permissionMode: AgentPermissionMode): void => {
    if (permissionMode === meta.permissionMode) return
    // Bug del CLI de Cursor: --resume conserva ask/plan en SQLite y no hay
    // --mode agent. Ante cualquier cambio de modo con sesión activa, reiniciamos
    // el hilo CLI y el próximo turno reinyecta el historial local del chat.
    const mustResetCliSession =
      meta.provider === 'cursor' && Boolean(meta.cliSessionId)
    onMetaChange(previous => {
      if (!mustResetCliSession) return { ...previous, permissionMode }
      const { cliSessionId: _dropped, ...rest } = previous
      return { ...rest, permissionMode }
    })
    if (mustResetCliSession) {
      pendingModeHandoffRef.current = true
      setMessages(prev => [...prev, systemMessage(t('agentPane.modeSessionReset'))])
    }
  }

  const changeProvider = (provider: AgentCliProvider): void => {
    if (provider === meta.provider) return
    const hadSession = Boolean(meta.cliSessionId)
    onMetaChange(previous => {
      const { cliSessionId: _session, model: _model, ...rest } = previous
      return { ...rest, provider }
    })
    if (hadSession) {
      pendingModeHandoffRef.current = true
      setMessages(prev => [...prev, systemMessage(t('agentPane.providerSessionReset'))])
    }
  }

  const changeModel = (model: string): void => {
    const next = model.trim()
    onMetaChange(previous => {
      const { model: _previous, ...rest } = previous
      return next ? { ...rest, model: next } : rest
    })
  }

  const changeName = (name: string): void => {
    const next = name.slice(0, AGENT_NAME_MAX_LENGTH)
    onMetaChange(previous => {
      const trimmed = next.trim()
      if (!trimmed) {
        const { name: _removed, ...rest } = previous
        return rest
      }
      return { ...previous, name: next }
    })
  }

  const changeRole = (role: string): void => {
    const next = role.slice(0, AGENT_ROLE_MAX_LENGTH)
    onMetaChange(previous => {
      const trimmed = next.trim()
      if (!trimmed) {
        const { role: _removed, ...rest } = previous
        return rest
      }
      return { ...previous, role: next }
    })
  }

  const changeObjective = (objective: string): void => {
    const next = objective.slice(0, AGENT_OBJECTIVE_MAX_LENGTH)
    onMetaChange(previous => {
      const trimmed = next.trim()
      if (!trimmed) {
        const { objective: _removed, ...rest } = previous
        return rest
      }
      return { ...previous, objective: next }
    })
  }

  const changeColor = (color: string): void => {
    onMetaChange(previous => ({ ...previous, color }))
  }

  const toggleContext = (contextId: string): void => {
    onMetaChange(previous => {
      const selected = new Set(previous.contextIds ?? [])
      if (selected.has(contextId)) selected.delete(contextId)
      else selected.add(contextId)
      return { ...previous, contextIds: [...selected] }
    })
  }

  const loopMode = loopOpen || loopActive
  const selectedContextIds = meta.contextIds ?? []
  // Con el agente ocupado el input sigue habilitado para encolar mensajes;
  // solo el modo loop bloquea la escritura.
  const showStop = loopActive || busy
  const showPlay = loopMode && !loopActive && !busy
  const composerDisabled = loopActive

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
  const buttonIsStop = showStop && !hasComposerPayload && !showPlay

  const handleSendClick = useCallback((): void => {
    if (showPlay) startLoop()
    else if (hasComposerPayload) send()
    else if (showStop) stop()
    else send()
  }, [hasComposerPayload, send, showPlay, showStop, startLoop, stop])

  return (
    <div
      className={[
        'agent-pane',
        tabActive && isActivePane ? 'agent-pane--focused' : '',
        loopActive ? 'agent-pane--looping' : '',
        busy ? 'agent-pane--working' : '',
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
            loopActive={loopActive}
            loopIteration={loopIteration}
            queuedTurns={queuedTurns}
            nearBottom={nearBottom}
            activeAssistantId={activeAssistantIdRef.current}
            enteringIds={enteringIds}
            materializingIds={materializingIds}
            settlingId={settlingId}
            onEnteringAnimationEnd={handleEnteringAnimationEnd}
            onMaterializingAnimationEnd={handleMaterializingAnimationEnd}
            onRemoveQueuedTurn={removeQueuedTurn}
            onEditQueuedTurn={id => setEditingQueuedId(id)}
            onScrollToBottom={scrollChatToBottom}
          />

          <AgentPaneFooter
            pendingImages={pendingImages}
            composerDisabled={composerDisabled}
            loopMode={loopMode}
            busy={busy}
            loopActive={loopActive}
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
        meta={meta}
        paneId={paneId}
        cwd={cwd}
        busy={busy}
        loopMode={loopMode}
        loopActive={loopActive}
        diskContexts={diskContexts}
        selectedContextIds={selectedContextIds}
        contextNotice={contextNotice}
        onClose={() => {
          // Desbloquear + suppress post-cierre (click-through al mini del plano).
          onConfigClose?.()
          setConfigOpen(false)
        }}
        closeOnBackdrop
        onChangeName={changeName}
        onChangeRole={changeRole}
        onChangeObjective={changeObjective}
        onChangeColor={changeColor}
        onChangeProvider={changeProvider}
        onChangeModel={changeModel}
        onChangePermission={changePermission}
        onToggleLoopMode={toggleLoopMode}
        onToggleContext={toggleContext}
        onOpenContextsModal={() => setContextsOpen(true)}
        onAutoImproveChange={checked => onMetaChange(previous => ({
          ...previous,
          autoImproveContexts: checked,
        }))}
        onEmitResultsChange={checked => onMetaChange(previous => ({
          ...previous,
          emitResults: checked,
        }))}
      />

      <QueuedTurnEditModal
        open={Boolean(editingQueuedId)}
        initialText={editingQueuedText}
        onClose={() => setEditingQueuedId(null)}
        onSave={text => {
          if (editingQueuedId) updateQueuedTurn(editingQueuedId, text)
        }}
      />

      <ConfirmTerminalModal
        open={confirmClose}
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
        open={contextsOpen}
        contexts={diskContexts}
        cwd={cwd}
        focusContextId={preferOpenContextId}
        onFocusContextConsumed={onPreferOpenContextConsumed}
        onRefresh={() => { void refreshDiskContexts() }}
        onClose={() => setContextsOpen(false)}
      />
      <AgentLoopIntervalModal
        open={loopIntervalModalOpen}
        initialMs={loopContinueDelayMs}
        onConfirm={confirmLoopInterval}
        onClose={() => setLoopIntervalModalOpen(false)}
      />
    </div>
  )
}
