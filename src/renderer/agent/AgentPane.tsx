import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ClipboardEvent, DragEvent } from 'react'
import type {
  AgentPaneMeta,
  AgentPermissionMode,
} from '@shared/tabSession'
import type {
  AgentChatEntry,
  AgentCliImageAttachment,
  AgentCliUiEvent,
} from '@shared/agentCliTypes'
import { modelsForProvider } from '@shared/agentCliModels'
import type { TabContext } from '@shared/tabContext'
import { extractTabContextUpdates } from '@shared/tabContext'
import {
  AGENT_LOOP_CONTINUE_DELAY_MS,
  buildLoopPrompt,
  MAX_AGENT_LOOP_ITERATIONS,
  stripLoopDoneMarker,
} from '@shared/agentLoop'
import { buildModeHandoffPrompt } from '@shared/agentModeHandoff'
import { useT } from '@i18n/useT'
import { ConfirmTerminalModal } from '../components/ConfirmTerminalModal'
import { Icon } from '../components/ui/Icon'
import { AiMarkdown } from '../components/AiMarkdown'
import { AiCodeBlock } from '../components/AiCodeBlock'
import { TabContextsModal } from './TabContextsModal'
import './AgentPane.css'

const MAX_PENDING_IMAGES = 6
const MAX_IMAGE_BYTES = 12 * 1024 * 1024
const MAX_QUEUED_TURNS = 10

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

type AgentBodySegment =
  | { type: 'text'; content: string }
  | { type: 'code'; lang: string; content: string }

/**
 * Separa la respuesta del agente en segmentos de texto y bloques de código
 * cercados (```lang). El texto se renderiza como markdown y el código con
 * resaltado y botón de copiar, para lectura más cómoda por no-programadores.
 */
function splitAgentBody(raw: string): AgentBodySegment[] {
  const segments: AgentBodySegment[] = []
  const pushText = (chunk: string): void => {
    if (chunk.trim()) segments.push({ type: 'text', content: chunk.replace(/\s+$/, '') })
  }
  let i = 0
  while (i < raw.length) {
    const fence = raw.indexOf('```', i)
    if (fence === -1) {
      pushText(raw.slice(i))
      break
    }
    if (fence > i) pushText(raw.slice(i, fence))
    const langEnd = raw.indexOf('\n', fence + 3)
    if (langEnd === -1) {
      segments.push({ type: 'code', lang: raw.slice(fence + 3).trim(), content: '' })
      break
    }
    const lang = raw.slice(fence + 3, langEnd).trim()
    const contentStart = langEnd + 1
    const close = raw.indexOf('\n```', contentStart)
    if (close === -1) {
      segments.push({ type: 'code', lang, content: raw.slice(contentStart) })
      break
    }
    segments.push({ type: 'code', lang, content: raw.slice(contentStart, close).replace(/\s+$/, '') })
    i = close + 4
  }
  return segments
}

const AssistantBody: React.FC<{ content: string; live: boolean }> = ({ content, live }) => {
  const segments = splitAgentBody(content)
  return (
    <div className={live ? 'agent-pane__stream' : undefined}>
      {segments.map((segment, index) =>
        segment.type === 'code' ? (
          <AiCodeBlock
            key={index}
            lang={segment.lang}
            content={segment.content}
            isStreaming={live}
            isLastSegment={index === segments.length - 1}
            onInsert={() => undefined}
          />
        ) : (
          <AiMarkdown
            key={index}
            content={segment.content}
            showCursor={live && index === segments.length - 1}
          />
        ),
      )}
    </div>
  )
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

function folderLabel(cwd: string): string {
  const normalized = cwd.replace(/[\\/]+$/, '')
  return normalized.split(/[\\/]/).pop() || cwd || '—'
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
  const [contextNotice, setContextNotice] = useState('')
  const [cwdChoices, setCwdChoices] = useState<Record<string, string>>({})
  const [loopOpen, setLoopOpen] = useState(false)
  const [loopActive, setLoopActive] = useState(false)
  const [loopIteration, setLoopIteration] = useState(0)
  /** Catálogo vivo desde `.iaterminal/*.md` (no se persiste en session). */
  const [diskContexts, setDiskContexts] = useState<TabContext[]>([])
  /** IDs que deben hacer pop-in; solo mensajes nuevos tras hidratar el chat. */
  const [enteringIds, setEnteringIds] = useState<ReadonlySet<string>>(() => new Set())
  /** Tras el live: aterrizaje suave de vuelta a la posición normal. */
  const [settlingId, setSettlingId] = useState<string | null>(null)
  const knownMessageIdsRef = useRef<Set<string> | null>(null)
  const activeAssistantIdRef = useRef<string | null>(null)
  /** Id del asistente del turno que acaba de cerrarse; acepta texto tardío tras done/EXIT. */
  const lastAssistantIdRef = useRef<string | null>(null)
  /** Evita procesar EXIT duplicado después de `done` (mismo turno). */
  const turnClosedRef = useRef(false)
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
  const contextWriteQueueRef = useRef<Promise<unknown>>(Promise.resolve())
  const discoveryHydratedRef = useRef(false)
  /** Tras resetear la sesión CLI por cambio de modo, el próximo turno lleva historial. */
  const pendingModeHandoffRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)
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
        ? discovered.map(context => context.id)
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

  const refreshDiskContexts = useCallback(async (): Promise<void> => {
    const resolvedCwd = await resolveWorkingCwd()
    if (!resolvedCwd) {
      setDiskContexts([])
      diskContextsRef.current = []
      return
    }
    const result = await window.api.discoverTabContexts({ cwd: resolvedCwd })
    if (!result.ok) return
    applyDiscoveredContexts(result.contexts)
  }, [applyDiscoveredContexts, resolveWorkingCwd])

  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    knownMessageIdsRef.current = null
    setEnteringIds(new Set())
    setSettlingId(null)
    if (liveSettleTimerRef.current != null) {
      window.clearTimeout(liveSettleTimerRef.current)
      liveSettleTimerRef.current = null
    }
    clearLoopTimer()
    loopActiveRef.current = false
    loopDoneRef.current = false
    discoveryHydratedRef.current = false
    setDiskContexts([])
    diskContextsRef.current = []
    setLoopActive(false)
    setLoopIteration(0)
    setBusy(false)
    setActivity('')
    activeAssistantIdRef.current = null
    void window.api.loadAgentChat(paneId).then(entries => {
      if (cancelled) return
      setMessages(entries)
      setLoaded(true)
    }).catch(() => {
      if (!cancelled) setLoaded(true)
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
      return
    }
    const fresh = currentIds.filter(id => !knownMessageIdsRef.current!.has(id))
    knownMessageIdsRef.current = new Set(currentIds)
    if (!fresh.length) return
    setEnteringIds(previous => {
      const next = new Set(previous)
      for (const id of fresh) next.add(id)
      return next
    })
  }, [loaded, messages])

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    // Diferir un frame: el pop-in ya tiene --enter y el layout está estable,
    // así el scroll no pinta la burbuja “ya colocada” antes de animar.
    const frame = window.requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight
    })
    return () => window.cancelAnimationFrame(frame)
  }, [messages, activity])

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
      if (!resolvedCwd) {
        setDiskContexts([])
        diskContextsRef.current = []
        return
      }
      const result = await window.api.discoverTabContexts({ cwd: resolvedCwd })
      if (cancelled || !result.ok) return
      applyDiscoveredContexts(result.contexts)
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [applyDiscoveredContexts, contextsOpen, cwd, resolveWorkingCwd])

  const startTurn = useCallback(async (options: {
    prompt: string
    displayUser: string
    contexts: TabContext[]
    permissionMode?: AgentPermissionMode
    images?: AgentCliImageAttachment[]
  }): Promise<boolean> => {
    const assistant: AgentChatEntry = { id: crypto.randomUUID(), role: 'assistant', content: '' }
    const user: AgentChatEntry = {
      id: crypto.randomUUID(),
      role: 'user',
      content: options.displayUser,
    }
    activeAssistantIdRef.current = assistant.id
    lastAssistantIdRef.current = assistant.id
    turnClosedRef.current = false
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
      autoImproveContexts: currentMeta.autoImproveContexts === true,
      cliSessionId: currentMeta.cliSessionId,
      ...(options.images?.length ? { images: options.images } : {}),
    })
    return true
  }, [onCwdChange, paneId, resolveWorkingCwd, t])

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
    }, AGENT_LOOP_CONTINUE_DELAY_MS)
  }, [beginLiveSettle, clearLoopTimer, finishLoop, runLoopIteration, t])

  const applyCliEvent = useCallback((event: AgentCliUiEvent): void => {
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
      const id = activeAssistantIdRef.current ?? lastAssistantIdRef.current ?? crypto.randomUUID()
      activeAssistantIdRef.current = id
      lastAssistantIdRef.current = id
      setMessages(prev => {
        const content = `${t('agentPane.errorPrefix')}: ${event.message}`
        const existing = prev.findIndex(message => message.id === id)
        if (existing < 0) return [...prev, { id, role: 'assistant', content }]
        return prev.map(message => message.id === id ? { ...message, content } : message)
      })
      return
    }
    const id = activeAssistantIdRef.current ?? lastAssistantIdRef.current
    if (!id) return
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
        message.id === id ? { ...message, content: visibleText } : message))
      return
    }
    setMessages(prev => prev.map(message => {
      if (message.id !== id) return message
      return { ...message, content: message.content + event.text }
    }))
  }, [completeTurn, onMetaChange, t])

  useEffect(() => {
    const offEvent = window.api.onAgentCliEvent(paneId, applyCliEvent)
    const offExit = window.api.onAgentCliExit(paneId, () => {
      // Fallback si el runtime antiguo no emite `done`, o si done se perdió.
      completeTurn()
    })
    return () => {
      offEvent()
      offExit()
    }
  }, [applyCliEvent, completeTurn, paneId])

  useEffect(() => {
    return () => {
      clearLoopTimer()
      if (loopActiveRef.current) {
        window.api.stopAgentTurn(paneId)
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
  ): Promise<void> => {
    const assigned = diskContextsRef.current.filter(context =>
      (metaRef.current.contextIds ?? []).includes(context.id))
    const images: AgentCliImageAttachment[] = []
    for (const [index, image] of imagesSnapshot.entries()) {
      try {
        const base64 = await blobToBase64(image.blob)
        if (!base64) continue
        images.push({
          name: image.name || `paste-${index + 1}${extensionForMime(image.mimeType)}`,
          mimeType: image.mimeType,
          base64,
        })
      } catch {
        // Ignorar adjuntos que no se pudieron leer.
      } finally {
        URL.revokeObjectURL(image.previewUrl)
      }
    }
    const displayUser = [
      prompt,
      images.length ? t('agentPane.imagesAttached', { n: images.length }) : '',
    ].filter(Boolean).join('\n')
    await startTurn({
      prompt,
      displayUser: displayUser || t('agentPane.imageOnlyMessage'),
      contexts: assigned,
      ...(images.length ? { images } : {}),
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
      systemMessage(t('agentPane.loopStarted', { objective })),
    ])
    runLoopIteration(1)
  }, [beginLiveSettle, clearLoopTimer, input, loopActive, onRequestPaneFocus, paneId, runLoopIteration, t])

  const toggleLoopMode = useCallback((): void => {
    if (loopActive) return
    setLoopOpen(open => !open)
  }, [loopActive])

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

  const PERMISSION_MODES: Array<{ value: AgentPermissionMode; label: string; hint: string }> = [
    { value: 'ask', label: t('agentPane.permissionAsk'), hint: t('agentPane.permissionAskHint') },
    { value: 'auto', label: t('agentPane.permissionAuto'), hint: t('agentPane.permissionAutoHint') },
    { value: 'plan', label: t('agentPane.permissionPlan'), hint: t('agentPane.permissionPlanHint') },
  ]

  const modelOptions = modelsForProvider(meta.provider)
  const selectedModel = meta.model?.trim() ?? ''
  const modelIsCustom = Boolean(selectedModel && !modelOptions.some(option => option.id === selectedModel))
  const providerLabel = meta.provider === 'claude' ? t('agentPane.claude') : t('agentPane.cursor')
  const loopMode = loopOpen || loopActive
  // Con el agente ocupado el input sigue habilitado para encolar mensajes;
  // solo el modo loop bloquea la escritura.
  const showStop = loopActive || busy
  const showPlay = loopMode && !loopActive && !busy
  const composerDisabled = loopActive

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
        <div className="agent-pane__header">
          <div className="agent-pane__header-left">
            {paneReorder?.enabled && (
              <button
                className="agent-pane__icon-button"
                draggable
                aria-label="Reordenar panel"
                aria-pressed={paneReorder.isGrabbed}
                onDragStart={paneReorder.onDragHandleStart}
                onDragEnd={paneReorder.onDragHandleEnd}
                onMouseDown={event => event.stopPropagation()}
              >
                <Icon name="drag-handle" size={13} />
              </button>
            )}
            <span className="agent-pane__avatar" aria-hidden="true">
              <Icon name="sparkles" size={13} />
            </span>
            <div className="agent-pane__identity">
              <span className="agent-pane__provider">{providerLabel}</span>
              <span className="agent-pane__cwd">
                <span className="agent-pane__cwd-icon" aria-hidden="true">
                  <Icon name="folder" size={11} />
                </span>
                <select
                  className="agent-pane__cwd-select"
                  value=""
                  disabled={busy || cwdSources.length === 0}
                  title={cwdSources.length ? t('agentPane.changeDirectory') : t('agentPane.noTerminals')}
                  onFocus={() => { void loadCwdChoices() }}
                  onChange={event => {
                    const selected = event.target.value
                    if (selected) void selectCwdSource(selected)
                    event.target.value = ''
                  }}
                  onMouseDown={event => event.stopPropagation()}
                >
                  <option value="">{folderLabel(cwd)}</option>
                  {cwdSources.map(source => (
                    <option key={source.paneId} value={source.paneId}>
                      {cwdChoices[source.paneId] || source.label}
                    </option>
                  ))}
                </select>
              </span>
            </div>
          </div>

          <label className="agent-pane__model">
            <span className="agent-pane__model-icon" aria-hidden="true">
              <Icon name="brain" size={13} />
            </span>
            <select
              value={selectedModel}
              disabled={busy}
              aria-label={t('agentPane.modelLabel')}
              title={t('agentPane.modelHint')}
              onChange={event => changeModel(event.target.value)}
              onMouseDown={event => event.stopPropagation()}
            >
              <option value="">{t('agentPane.modelDefault')}</option>
              {modelOptions.map(option => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
              {modelIsCustom && (
                <option value={selectedModel}>{selectedModel}</option>
              )}
            </select>
          </label>

          <div
            className="agent-pane__modes"
            role="radiogroup"
            aria-label={t('agentPane.permissionLabel')}
          >
            {PERMISSION_MODES.map(mode => (
              <button
                key={mode.value}
                role="radio"
                aria-checked={meta.permissionMode === mode.value}
                className={[
                  'agent-pane__mode',
                  meta.permissionMode === mode.value ? 'agent-pane__mode--active' : '',
                ].filter(Boolean).join(' ')}
                title={mode.hint}
                disabled={busy}
                onClick={() => changePermission(mode.value)}
                onMouseDown={event => event.stopPropagation()}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={[
              'agent-pane__icon-button',
              'agent-pane__loop-mode',
              loopMode ? 'agent-pane__loop-mode--on' : '',
            ].filter(Boolean).join(' ')}
            aria-pressed={loopMode}
            title={t('agentPane.loopTitle')}
            disabled={loopActive}
            onClick={toggleLoopMode}
            onMouseDown={event => event.stopPropagation()}
          >
            <Icon name="refresh" size={13} />
          </button>

          {onClosePane && (
            <button
              className="agent-pane__icon-button agent-pane__close"
              title={t('common.cancel')}
              onClick={() => setConfirmClose(true)}
              onMouseDown={event => event.stopPropagation()}
            >
              <Icon name="close" size={12} />
            </button>
          )}
        </div>
      )}

      <div ref={scrollRef} className="agent-pane__messages">
        {messages.length === 0 && (
          <div className="agent-pane__empty">
            <span className="agent-pane__empty-icon" aria-hidden="true">
              <Icon name="sparkles" size={22} />
            </span>
            <strong>{t('agentPane.emptyTitle')}</strong>
            <p>{t('agentPane.empty')}</p>
          </div>
        )}
        {messages.map(message => {
          const live = busy &&
            message.role === 'assistant' &&
            message.id === activeAssistantIdRef.current
          const landing = !live && settlingId === message.id
          const entering = enteringIds.has(message.id)
          // Orbe solo mientras piensa sin texto; al primer token toma forma de burbuja.
          const orb = live && !message.content
          return (
            <div
              key={message.id}
              className={[
                'agent-pane__row',
                `agent-pane__row--${message.role}`,
                entering ? 'agent-pane__row--enter' : '',
                live ? 'agent-pane__row--live' : '',
                landing ? 'agent-pane__row--landing' : '',
                orb ? 'agent-pane__row--orb' : '',
              ].filter(Boolean).join(' ')}
              onAnimationEnd={entering
                ? event => {
                    if (event.target !== event.currentTarget) return
                    setEnteringIds(previous => {
                      if (!previous.has(message.id)) return previous
                      const next = new Set(previous)
                      next.delete(message.id)
                      return next
                    })
                  }
                : undefined}
            >
              <div
                className={[
                  `agent-pane__bubble agent-pane__bubble--${message.role}`,
                  live ? 'agent-pane__bubble--live' : '',
                  landing ? 'agent-pane__bubble--landing' : '',
                  orb ? 'agent-pane__bubble--orb' : '',
                ].filter(Boolean).join(' ')}
                aria-label={orb ? t('agentPane.thinking') : undefined}
              >
                {orb ? (
                  <span className="agent-pane__orb" aria-hidden="true">
                    <span className="agent-pane__orb-glow" />
                    <span className="agent-pane__orb-bubble" />
                    <span className="agent-pane__orb-reflections" />
                    {Array.from({ length: 8 }, (_, index) => (
                      <span
                        key={index}
                        className={`agent-pane__orb-particle agent-pane__orb-particle--${index + 1}`}
                      />
                    ))}
                  </span>
                ) : message.content
                  ? (
                      message.role === 'assistant'
                        ? <AssistantBody content={message.content} live={live} />
                        : (
                            <span className={live ? 'agent-pane__stream' : undefined}>
                              {message.content}
                              {live && <span className="agent-pane__caret" aria-hidden="true" />}
                            </span>
                          )
                    )
                  : ''}
              </div>
            </div>
          )
        })}
        {activity && (
          <div className="agent-pane__activity">
            <span className="agent-pane__activity-dot" aria-hidden="true" />
            {loopActive
              ? `${t('agentPane.loopBadge', { n: loopIteration })} · ${activity}`
              : activity}
          </div>
        )}
        {loopActive && !activity && busy && (
          <div className="agent-pane__activity">
            <span className="agent-pane__activity-dot" aria-hidden="true" />
            {t('agentPane.loopWorking', { n: loopIteration })}
          </div>
        )}
      </div>

      {pendingImages.length > 0 && (
        <div className="agent-pane__attachments" aria-label={t('agentPane.imagesAttached', { n: pendingImages.length })}>
          {pendingImages.map(image => (
            <div key={image.id} className="agent-pane__attachment">
              <img src={image.previewUrl} alt={image.name} />
              <button
                type="button"
                className="agent-pane__attachment-remove"
                onClick={() => removePendingImage(image.id)}
                disabled={composerDisabled}
                title={t('agentPane.removeImage')}
                aria-label={t('agentPane.removeImage')}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="agent-pane__contexts">
        <div className="agent-pane__contexts-head">
          <span>{t('tabContexts.barTitle')}</span>
          <button
            className="agent-pane__contexts-manage"
            onClick={() => setContextsOpen(true)}
            disabled={loopActive}
          >
            <Icon name="settings" size={12} />
            {t('tabContexts.manage')}
          </button>
          <label
            className="agent-pane__context-auto-improve"
            title={t('tabContexts.autoImproveHint')}
          >
            <input
              type="checkbox"
              role="switch"
              checked={meta.autoImproveContexts === true}
              disabled={busy || loopActive || !(meta.contextIds?.length)}
              onChange={event => onMetaChange(previous => ({
                ...previous,
                autoImproveContexts: event.target.checked,
              }))}
            />
            <span aria-hidden="true" />
            {t('tabContexts.autoImprove')}
          </label>
        </div>
        {diskContexts.length > 0 && (
          <div className="agent-pane__context-checks">
            {diskContexts.map(context => (
              <label key={context.id} title={t(`tabContexts.kind_${context.kind}`)}>
                <input
                  type="checkbox"
                  checked={(meta.contextIds ?? []).includes(context.id)}
                  disabled={busy || loopActive}
                  onChange={() => toggleContext(context.id)}
                />
                <span>{context.name}</span>
              </label>
            ))}
          </div>
        )}
        {contextNotice && <div className="agent-pane__context-notice">{contextNotice}</div>}
      </div>

      <div className={['agent-pane__composer', loopMode ? 'agent-pane__composer--loop' : ''].filter(Boolean).join(' ')}>
        {queuedTurns.length > 0 && (
          <div
            className="agent-pane__queue"
            aria-label={t('agentPane.queueLabel', { n: queuedTurns.length })}
          >
            {queuedTurns.map((item, index) => (
              <span key={item.id} className="agent-pane__queue-chip" title={item.text}>
                <span className="agent-pane__queue-pos" aria-hidden="true">{index + 1}</span>
                <span className="agent-pane__queue-text">
                  {item.text || t('agentPane.imageOnlyMessage')}
                </span>
                <button
                  type="button"
                  className="agent-pane__queue-remove"
                  onClick={() => removeQueuedTurn(item.id)}
                  title={t('agentPane.queueRemove')}
                  aria-label={t('agentPane.queueRemove')}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <textarea
          value={input}
          placeholder={
            loopMode ? t('agentPane.loopPlaceholder')
              : busy ? t('agentPane.queuePlaceholder')
                : t('agentPane.placeholder')
          }
          disabled={composerDisabled}
          rows={1}
          onChange={event => setInput(event.target.value)}
          onPaste={handleComposerPaste}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              if (loopActive) stop()
              else if (showPlay) startLoop()
              else send()
            }
          }}
        />
        <button
          className={[
            'agent-pane__send',
            showStop ? 'agent-pane__send--stop' : '',
            showPlay ? 'agent-pane__send--play' : '',
          ].filter(Boolean).join(' ')}
          disabled={!showStop && !input.trim() && pendingImages.length === 0}
          onClick={showStop ? stop : showPlay ? startLoop : send}
          title={
            showStop ? (loopActive ? t('agentPane.loopStop') : t('agentPane.stop'))
              : showPlay ? t('agentPane.loopStart')
                : t('agentPane.send')
          }
        >
          <Icon
            name={showStop ? 'stop' : showPlay ? 'play' : 'send'}
            size={14}
          />
        </button>
      </div>

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
    </div>
  )
}
