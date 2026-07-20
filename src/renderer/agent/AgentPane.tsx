import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ClipboardEvent, DragEvent } from 'react'
import type {
  AgentPaneMeta,
  AgentPermissionMode,
} from '@shared/tabSession'
import type {
  AgentChatEntry,
  AgentChatImage,
  AgentCliImageAttachment,
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
import { useT } from '@i18n/useT'
import { ConfirmTerminalModal } from '../components/ConfirmTerminalModal'
import { TabContextsModal } from './TabContextsModal'
import { AgentLoopIntervalModal } from './AgentLoopIntervalModal'
import { AgentPaneHeader } from './AgentPaneHeader'
import { AgentPaneMessages } from './AgentPaneMessages'
import { AgentPaneFooter } from './AgentPaneFooter'
import { useAiMessagesFollowScroll } from '../components/ai/useAiMessagesFollowScroll'
import './AgentPane.css'

const MAX_PENDING_IMAGES = 6
const MAX_IMAGE_BYTES = 12 * 1024 * 1024
const MAX_QUEUED_TURNS = 10
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

interface PendingImage {
  id: string
  previewUrl: string
  blob: Blob
  mimeType: string
  name: string
}

/** Mensaje escrito mientras la IA trabajaba; se envía solo al liberarse el turno. */
interface QueuedTurn {
  id: string
  text: string
  images: PendingImage[]
}

function extensionForMime(mimeType: string): string {
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return '.jpg'
  if (mimeType === 'image/webp') return '.webp'
  if (mimeType === 'image/gif') return '.gif'
  return '.png'
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Miniatura pequeña (máx. 96px) en data URL para persistir junto al mensaje.
 * Se guarda la miniatura y no la imagen original para no inflar el historial.
 */
async function blobToThumbnailDataUrl(blob: Blob): Promise<string | null> {
  const MAX_THUMB_DIM = 96
  try {
    const bitmap = await createImageBitmap(blob)
    const scale = Math.min(1, MAX_THUMB_DIM / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
      bitmap.close()
      return null
    }
    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    return canvas.toDataURL('image/webp', 0.75)
  } catch {
    return null
  }
}

function imagesFromClipboard(data: DataTransfer | null): File[] {
  if (!data) return []
  const files: File[] = []
  for (const item of Array.from(data.items ?? [])) {
    if (!item.type.startsWith('image/')) continue
    const file = item.getAsFile()
    if (file && file.size > 0 && file.size <= MAX_IMAGE_BYTES) files.push(file)
  }
  if (files.length) return files
  for (const file of Array.from(data.files ?? [])) {
    if (file.type.startsWith('image/') && file.size > 0 && file.size <= MAX_IMAGE_BYTES) {
      files.push(file)
    }
  }
  return files
}

/**
 * Copia los bytes del archivo del portapapeles a un Blob estable.
 * En Chromium/Electron el File de clipboard se invalida al terminar el
 * evento paste; createObjectURL sobre ese File deja la preview rota.
 */
async function materializeClipboardImage(
  file: File,
  fallbackName: string,
): Promise<PendingImage | null> {
  try {
    const buffer = await file.arrayBuffer()
    if (!buffer.byteLength || buffer.byteLength > MAX_IMAGE_BYTES) return null
    const mimeType = file.type || 'image/png'
    const blob = new Blob([buffer], { type: mimeType })
    return {
      id: crypto.randomUUID(),
      previewUrl: URL.createObjectURL(blob),
      blob,
      mimeType,
      name: file.name || fallbackName,
    }
  } catch {
    return null
  }
}

export interface AgentCwdSource {
  paneId: string
  label: string
}

interface Props {
  paneId: string
  meta: AgentPaneMeta
  cwd: string
  tabActive: boolean
  isActivePane: boolean
  cwdSources: AgentCwdSource[]
  /** Mismo tamaño tipográfico que las terminales (`config.fontSize`). */
  fontSize: number
  onMetaChange: (meta: AgentPaneMeta | ((previous: AgentPaneMeta) => AgentPaneMeta)) => void
  onCwdChange: (cwd: string) => void
  onRequestPaneFocus: () => void
  onClosePane?: () => void
  onBusyChange?: (busy: boolean) => void
  paneReorder?: {
    enabled: boolean
    isGrabbed: boolean
    onDragHandleStart: (event: DragEvent) => void
    onDragHandleEnd: () => void
  }
  registerShortcutCloseInterceptor?: (openConfirm: () => void) => () => void
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
  cwdSources,
  fontSize,
  onMetaChange,
  onCwdChange,
  onRequestPaneFocus,
  onClosePane,
  onBusyChange,
  paneReorder,
  registerShortcutCloseInterceptor,
}) => {
  const { t } = useT()
  const [messages, setMessages] = useState<AgentChatEntry[]>([])
  const [input, setInput] = useState('')
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [queuedTurns, setQueuedTurns] = useState<QueuedTurn[]>([])
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [activity, setActivity] = useState('')
  const [confirmClose, setConfirmClose] = useState(false)
  const [contextsOpen, setContextsOpen] = useState(false)
  const [contextsPickerOpen, setContextsPickerOpen] = useState(false)
  const [contextNotice, setContextNotice] = useState('')
  const [cwdChoices, setCwdChoices] = useState<Record<string, string>>({})
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
  /** Chat hidratado; hasta entonces se encolan eventos CLI (remount durante stream). */
  const loadedRef = useRef(false)
  const pendingCliEventsRef = useRef<AgentCliUiEvent[]>([])
  const applyCliEventRef = useRef<(event: AgentCliUiEvent) => void>(() => undefined)
  const completeTurnRef = useRef<() => void>(() => undefined)
  const liveSettleTimerRef = useRef<number | null>(null)
  const messagesRef = useRef(messages)
  const metaRef = useRef(meta)
  const diskContextsRef = useRef(diskContexts)
  const contextsPickerRef = useRef<HTMLDivElement>(null)
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
  const scrollRef = useRef<HTMLDivElement>(null)
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
    let resolved = cwdRef.current.trim()
    if (!resolved) {
      try { resolved = (await window.api.getSessionCwd(paneId)).trim() } catch { /* ignore */ }
    }
    if (!resolved && cwdSources[0]) {
      try {
        resolved = (await window.api.getSessionCwd(cwdSources[0].paneId)).trim()
      } catch { /* ignore */ }
    }
    return resolved
  }, [cwdSources, paneId])

  const applyDiscoveredContexts = useCallback((discovered: TabContext[]): void => {
    const previousIds = new Set(diskContextsRef.current.map(context => context.id))
    setDiskContexts(discovered)
    diskContextsRef.current = discovered
    const discoveredIds = new Set(discovered.map(context => context.id))
    const currentMeta = metaRef.current
    let nextIds: string[]
    if (!discoveryHydratedRef.current) {
      discoveryHydratedRef.current = true
      nextIds = currentMeta.contextIds == null
        ? defaultAssignedContextIds(discovered)
        : currentMeta.contextIds.filter(id => discoveredIds.has(id))
    } else {
      const kept = (currentMeta.contextIds ?? []).filter(id => discoveredIds.has(id))
      const added = discovered
        .filter(context => !previousIds.has(context.id) && !kept.includes(context.id))
        .map(context => context.id)
      nextIds = [...kept, ...added]
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
  const { nearBottom, forceFollow } = useAiMessagesFollowScroll(
    messages,
    true,
    scrollRef,
    `${activity}\0${queuedTurns.length}`,
  )

  const scrollChatToBottom = (): void => {
    forceFollow()
  }

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
    if (resolvedCwd && resolvedCwd !== cwdRef.current) onCwdChange(resolvedCwd)
    // messagesRef aún no incluye el user/assistant de este turno.
    const priorMessages = messagesRef.current
    let prompt = options.prompt
    if (pendingModeHandoffRef.current) {
      pendingModeHandoffRef.current = false
      prompt = buildModeHandoffPrompt(priorMessages, options.prompt)
    }
    window.api.startAgentTurn({
      paneId,
      provider: currentMeta.provider,
      prompt,
      cwd: resolvedCwd,
      permissionMode: options.permissionMode ?? currentMeta.permissionMode,
      ...(currentMeta.model?.trim() ? { model: currentMeta.model.trim() } : {}),
      contexts: assigned,
      discoveredContexts: diskContextsRef.current,
      autoImproveContexts: currentMeta.autoImproveContexts === true,
      cliSessionId: currentMeta.cliSessionId,
      ...(options.images?.length ? { images: options.images } : {}),
    })
    return true
  }, [forceFollow, onCwdChange, paneId, resolveWorkingCwd, t])

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

  const completeTurn = useCallback((): void => {
    if (turnClosedRef.current) return
    turnClosedRef.current = true
    const id = activeAssistantIdRef.current ?? lastAssistantIdRef.current
    beginLiveSettle(activeAssistantIdRef.current)
    setBusy(false)
    setActivity('')
    activeAssistantIdRef.current = null
    if (id) {
      // Diferir: EXIT puede llegar antes que assistant_final (canales IPC distintos).
      window.setTimeout(() => {
        setMessages(prev => {
          const message = prev.find(entry => entry.id === id)
          if (!message || message.content.trim()) return prev
          return prev.map(entry =>
            entry.id === id
              ? {
                  ...entry,
                  content: `${t('agentPane.errorPrefix')}: ${t('agentPane.emptyResponse')}`,
                }
              : entry)
        })
      }, 0)
    }
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
    if (event.type === 'tool') {
      setActivity(event.status === 'started' ? t('agentPane.activity', { tool: event.name }) : '')
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
      turnClosedRef.current = false
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
      turnClosedRef.current = false
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
        }
        setContextNotice(t('tabContexts.updated', { n: writes.length }))
        window.setTimeout(() => setContextNotice(''), 3500)
      }
      setMessages(prev => prev.map(message =>
        message.id === assistantId ? { ...message, content: visibleText } : message))
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
      completeTurnRef.current()
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

  const removeQueuedTurn = useCallback((id: string): void => {
    setQueuedTurns(previous => {
      const target = previous.find(item => item.id === id)
      target?.images.forEach(image => URL.revokeObjectURL(image.previewUrl))
      return previous.filter(item => item.id !== id)
    })
  }, [])

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
    window.api.stopAgentTurn(paneId)
    beginLiveSettle(activeAssistantIdRef.current)
    setBusy(false)
    setActivity('')
    activeAssistantIdRef.current = null
    if (wasLoop) finishLoop('stopped')
  }, [beginLiveSettle, clearLoopTimer, finishLoop, paneId])

  const startLoop = useCallback((): void => {
    const objective = input.trim()
    if (!objective || loopActive) return
    onRequestPaneFocus()
    // Si había un turno normal en curso, se corta y la instrucción se reinicia en loop.
    if (busyRef.current) {
      skipLoopContinueRef.current = true
      turnClosedRef.current = true
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

  const confirmLoopInterval = useCallback((delayMs: number): void => {
    loopContinueDelayMsRef.current = delayMs
    setLoopContinueDelayMs(delayMs)
    setLoopIntervalModalOpen(false)
    setLoopOpen(true)
  }, [])

  const loadCwdChoices = useCallback(async (): Promise<void> => {
    const entries = await Promise.all(cwdSources.map(async source => {
      try {
        return [source.paneId, (await window.api.getSessionCwd(source.paneId)).trim()] as const
      } catch {
        return [source.paneId, ''] as const
      }
    }))
    setCwdChoices(Object.fromEntries(entries))
  }, [cwdSources])

  useEffect(() => {
    void loadCwdChoices()
  }, [loadCwdChoices])

  const selectCwdSource = useCallback(async (sourcePaneId: string): Promise<void> => {
    let next = cwdChoices[sourcePaneId]
    if (!next) {
      try { next = (await window.api.getSessionCwd(sourcePaneId)).trim() } catch { /* ignore */ }
    }
    if (next) onCwdChange(next)
  }, [cwdChoices, onCwdChange])

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

  const changeModel = (model: string): void => {
    const next = model.trim()
    onMetaChange(previous => {
      const { model: _previous, ...rest } = previous
      return next ? { ...rest, model: next } : rest
    })
  }

  const toggleContext = (contextId: string): void => {
    onMetaChange(previous => {
      const selected = new Set(previous.contextIds ?? [])
      if (selected.has(contextId)) selected.delete(contextId)
      else selected.add(contextId)
      return { ...previous, contextIds: [...selected] }
    })
  }

  // Cierra el desplegable de contextos al hacer clic fuera o Escape.
  useEffect(() => {
    if (!contextsPickerOpen) return
    const onPointerDown = (event: MouseEvent): void => {
      const root = contextsPickerRef.current
      if (root && !root.contains(event.target as Node)) {
        setContextsPickerOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setContextsPickerOpen(false)
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [contextsPickerOpen])

  // Si se abre el modal de administración o empieza un loop, cierra el picker.
  useEffect(() => {
    if (contextsOpen || loopActive) setContextsPickerOpen(false)
  }, [contextsOpen, loopActive])

  const loopMode = loopOpen || loopActive
  const selectedContextIds = meta.contextIds ?? []
  const selectedContexts = diskContexts.filter(context => selectedContextIds.includes(context.id))
  const contextsPickerLabel = selectedContexts.length === 0
    ? t('tabContexts.pickerNone')
    : selectedContexts.length === 1
      ? selectedContexts[0].name
      : t('tabContexts.pickerSelected', { n: selectedContexts.length })
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

  const handleSendClick = useCallback((): void => {
    if (showStop) stop()
    else if (showPlay) startLoop()
    else send()
  }, [send, showPlay, showStop, startLoop, stop])

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
      {tabActive && (
        <AgentPaneHeader
          meta={meta}
          cwd={cwd}
          cwdSources={cwdSources}
          cwdChoices={cwdChoices}
          busy={busy}
          loopMode={loopMode}
          loopActive={loopActive}
          onClosePane={onClosePane}
          onRequestClose={() => setConfirmClose(true)}
          onLoadCwdChoices={() => { void loadCwdChoices() }}
          onSelectCwdSource={sourcePaneId => { void selectCwdSource(sourcePaneId) }}
          onChangeModel={changeModel}
          onChangePermission={changePermission}
          onToggleLoopMode={toggleLoopMode}
          paneReorder={paneReorder}
        />
      )}

      <AgentPaneMessages
        scrollRef={scrollRef}
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
        onScrollToBottom={scrollChatToBottom}
      />

      <AgentPaneFooter
        pendingImages={pendingImages}
        composerDisabled={composerDisabled}
        loopMode={loopMode}
        busy={busy}
        loopActive={loopActive}
        input={input}
        showStop={showStop}
        showPlay={showPlay}
        meta={meta}
        diskContexts={diskContexts}
        selectedContextIds={selectedContextIds}
        selectedContexts={selectedContexts}
        contextsPickerOpen={contextsPickerOpen}
        contextsPickerRef={contextsPickerRef}
        contextsPickerLabel={contextsPickerLabel}
        contextNotice={contextNotice}
        composerInputRef={composerInputRef}
        onInputChange={setInput}
        onComposerPaste={handleComposerPaste}
        onComposerKeyDown={handleComposerKeyDown}
        onRemovePendingImage={removePendingImage}
        onToggleContextsPicker={() => setContextsPickerOpen(open => !open)}
        onToggleContext={toggleContext}
        onOpenContextsModal={() => setContextsOpen(true)}
        onAutoImproveChange={checked => onMetaChange(previous => ({
          ...previous,
          autoImproveContexts: checked,
        }))}
        onSendClick={handleSendClick}
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
      <TabContextsModal
        open={contextsOpen}
        contexts={diskContexts}
        cwd={cwd}
        paneId={paneId}
        cwdSources={cwdSources}
        onRefresh={() => { void refreshDiskContexts() }}
        onAssign={contextId => {
          onMetaChange(previous => {
            if ((previous.contextIds ?? []).includes(contextId)) return previous
            return { ...previous, contextIds: [...(previous.contextIds ?? []), contextId] }
          })
        }}
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
