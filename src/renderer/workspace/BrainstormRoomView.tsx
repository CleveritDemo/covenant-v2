import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BrainstormRoom } from '@shared/brainstormRoom'
import {
  BRAINSTORM_MAX_ROUNDS_CAP,
  brainstormSeats,
  brainstormTurnCount,
  brainstormTurnsDone,
  dedupeAgentIdsPreservingOrder,
  isBrainstormHumanMessage,
  parseBrainstormClosing,
  parseCeremonyClosing,
  resolveBrainstormParticipantDisplay,
  resolveBrainstormParticipantIds,
  sanitizeBrainstormMaxRounds,
  stripBrainstormProtocolFences,
  type BrainstormCatalogAgent,
} from '@shared/brainstormRoom'
import { agentMonogram, paletteColorForSeed } from '@shared/tabContextAppearance'
import { candidateCeremonyRoles } from '@shared/agileCeremonies'
import { CEREMONY_ROLE_KEY } from './ceremonyLabels'
import { brainstormSeatTail } from '@shared/brainstormSeatTail'
import { brainstormContextLabel } from '@shared/brainstormContextLabel'
import type { TabContext } from '@shared/tabContext'
import type { AgentCliProvider } from '@shared/tabSession'
import type { AgentCoordination } from '@shared/projectAgentCatalog'
import { useT } from '@i18n/useT'
import { NO_CONTEXT_USAGE, resolveAssignedContextChips, resolveTabContextById } from './resolveAssignedContextChips'
import type { PlaneAgentContextChip } from './PlaneAgentContextNodes'
import { isReduceMotionActive } from '../reduceMotion'
import { Button, Icon, Tooltip, type IconName } from '../components/ui'
import { contextIconName } from '../agent/tabContextKindIcons'
import { BrainstormOverlay } from './BrainstormOverlay'
import { BrainstormLiveSeatCard } from './BrainstormSeatCard'
import { useBrainstormContextDrop } from './brainstormContextDrop'
import { BrainstormAgentPane } from './BrainstormAgentPane'
import { AiMarkdown } from '../components/AiMarkdown'
import { TerminalModal } from '../components/TerminalModal'
import { APP_OVERLAY_MODAL_Z } from '@shared/overlayZIndex'
import { formatWikiPageBodyForHuman } from '@shared/wikiPagePlain'
import type { WikiGraphNode } from '@shared/wikiGraph'
import { wikiTypeLabelKey } from './WikiGraphView'
import { ChatBubble } from '../components/ai/ChatBubble'
import {
  createInitialBrainstormLiveState,
  reduceBrainstormLiveEvent,
  type BrainstormLiveSummary,
} from './brainstormLiveState'
import {
  canPauseBrainstorm,
  canResumeBrainstorm,
  isBrainstormLive,
  isBrainstormStoppable,
} from './brainstormViewClose'
import { BrainstormClosingCard } from './BrainstormClosingCard'
import { BrainstormSpeakerWaiting } from './BrainstormSpeakerWaiting'
import { BrainstormWikiCard } from './BrainstormWikiCard'
import { splitBrainstormMessage } from '@shared/brainstormMessageParts'
import { BrainstormHumanComposer } from './BrainstormHumanComposer'
import './BrainstormRoomView.css'

export interface BrainstormRoomViewProps {
  /** Solo visibilidad: la sala sigue montada y viva cuando está minimizada. */
  open: boolean
  active?: boolean
  room: BrainstormRoom
  cwd: string
  /** Catálogo real del workspace (sin roles técnicos de orquestación). */
  agents?: readonly BrainstormCatalogAgent[]
  /**
   * @deprecated Preferir `agents`. Solo fallback si no hay catálogo.
   * Nombres de catálogo para el streaming (antes de speaker_final).
   */
  agentNamesById?: Record<string, string>
  /** Cerrar = minimizar: el runner sigue corriendo en main. */
  onClose: () => void
  /**
   * Soltar la sala del plano. Solo cuando ya terminó: el acta queda en disco y
   * se reabre desde «Salas guardadas», así que esto no pierde nada.
   */
  onFinish?: () => void
  /** Estado vivo hacia el plano (indicador en agentes + flyout). */
  onLive?: (summary: BrainstormLiveSummary) => void
  /**
   * Salas vivas del workspace, en orden, incluida esta: el chip del chrome dice
   * en cuál estás y deja saltar a otra sin pasar por la barra del plano.
   */
  liveRooms?: readonly { roomId: string; topic: string }[]
  onSwitchRoom?: (roomId: string) => void
  /**
   * Asientos que este agente también ocupa en otras salas vivas, por id. Se
   * permite: cada sala corre su propio CLI con su propio contexto, así que la
   * tarjeta lo dice en vez de dejar que compitan en silencio.
   */
  agentsInOtherRooms?: Readonly<Record<string, readonly string[]>>
  /**
   * Catálogo de contextos del proyecto: la tarjeta del asiento pinta los del
   * agente con su icono y color reales, igual que la mini del plano.
   */
  contexts?: readonly TabContext[]
  /** El cierre se guardó como contexto en `.gravity`: refrescar la lista de la pestaña. */
  onContextSaved?: () => void
  /**
   * Soltar un contexto del riel sobre un asiento. La sala no lo relee a mitad
   * de turno: entra en el catálogo del agente y cuenta desde su próximo turno.
   */
  onAssignContext?: (agentId: string, contextId: string) => void
}

function statusLabelKey(
  status: string,
): 'tabs.brainstormStatusRunning'
  | 'tabs.brainstormStatusDone'
  | 'tabs.brainstormStatusStopped'
  | 'tabs.brainstormStatusPaused'
  | 'tabs.brainstormStatusIdle' {
  if (status === 'running') return 'tabs.brainstormStatusRunning'
  if (status === 'done') return 'tabs.brainstormStatusDone'
  if (status === 'stopped') return 'tabs.brainstormStatusStopped'
  if (status === 'paused') return 'tabs.brainstormStatusPaused'
  return 'tabs.brainstormStatusIdle'
}

/** Vista en vivo: acta multi-agente + play/pausa/stop; cierre detiene si running/idle. */
export const BrainstormRoomView: React.FC<BrainstormRoomViewProps> = ({
  open,
  active = true,
  room,
  cwd,
  agents = [],
  agentNamesById = {},
  onClose,
  onFinish,
  onContextSaved,
  onLive,
  liveRooms = [],
  onSwitchRoom,
  agentsInOtherRooms = {},
  contexts = [],
  onAssignContext,
}) => {
  const { t } = useT()
  const { dropAgentId, handlersFor } = useBrainstormContextDrop(onAssignContext)
  /** Asiento abierto en su propio pane: solo sus turnos, al 0.7 del plano. */
  const [paneAgentId, setPaneAgentId] = useState<string | null>(null)
  const [live, setLive] = useState(() => createInitialBrainstormLiveState(room))
  const [maxRounds, setMaxRounds] = useState(() => sanitizeBrainstormMaxRounds(room.maxRounds))
  const liveStatusRef = useRef(live.status)
  const stoppedRef = useRef(false)
  const onLiveRef = useRef(onLive)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  onLiveRef.current = onLive
  /** Working set tras añadir en caliente (la sala en disco la actualiza main). */
  const [hotWorkingSet, setHotWorkingSet] = useState<{
    contextIds: string[]
    filePaths: string[]
  } | null>(null)
  const [workingSetError, setWorkingSetError] = useState<string | null>(null)
  /**
   * Página de wiki abierta desde la tarjeta de un turno. El grafo ya trae el
   * body, así que una sola llamada resuelve título, tipo y contenido — y si el
   * slug no está, eso ES la respuesta: el turno la escribió pero no llegó a
   * disco (el proyecto puede no tener wiki). La tarjeta no lo promete; abrirla
   * es la comprobación.
   */
  const [wikiPage, setWikiPage] = useState<WikiGraphNode | null>(null)
  const [wikiPageMissing, setWikiPageMissing] = useState<string | null>(null)

  const openWikiPage = useCallback((slug: string): void => {
    const root = cwd.trim()
    if (!root) return
    setWikiPage(null)
    setWikiPageMissing(null)
    void window.api.getWikiGraph(root).then(result => {
      const node = result.ok
        ? result.data?.nodes.find(item => item.slug === slug)
        : undefined
      if (node) setWikiPage(node)
      else setWikiPageMissing(slug)
    }).catch(() => setWikiPageMissing(slug))
  }, [cwd])
  liveStatusRef.current = live.status

  const participantResolution = useMemo(() => {
    // Sin catálogo aún: no marcar huérfanos (evita falso positivo al montar).
    if (!agents.length) {
      return {
        resolvedIds: dedupeAgentIdsPreservingOrder(room.participantAgentIds),
        orphanIds: [] as string[],
      }
    }
    return resolveBrainstormParticipantIds(room.participantAgentIds, agents)
  }, [agents, room.participantAgentIds])

  const speakerLabel = useCallback((agentId: string, storedName?: string): string => {
    if (agents.length > 0) {
      const display = resolveBrainstormParticipantDisplay(agentId, agents, storedName)
      if (display.known) return display.label
      return t('tabs.brainstormUnknownParticipant', { id: display.agentId })
    }
    const fromMap = agentNamesById[agentId]?.trim()
    if (fromMap) return fromMap
    const stored = storedName?.trim()
    if (stored && stored !== agentId) return stored
    return t('tabs.brainstormUnknownParticipant', { id: agentId })
  }, [agentNamesById, agents, t])

  useEffect(() => {
    setLive(createInitialBrainstormLiveState(room))
    setMaxRounds(sanitizeBrainstormMaxRounds(room.maxRounds))
    setHotWorkingSet(null)
    setWorkingSetError(null)
    stoppedRef.current = false
  }, [room.id])

  // Suscripción atada al montaje, no a `open`: minimizada sigue acumulando turnos.
  useEffect(() => {
    const unsubscribe = window.api.onBrainstormEvent(room.id, event => {
      setLive(previous => reduceBrainstormLiveEvent(previous, event))
    })
    return unsubscribe
  }, [room.id])

  /**
   * Al abrir hay que *estar* al final, no viajar hasta él: con nueve turnos, el
   * scroll suave era un paseo por un acta que el usuario no pidió releer. La
   * animación se guarda para lo que llega mientras miras, que ahí sí dice «esto
   * es nuevo».
   */
  const anchoredRef = useRef(false)
  useEffect(() => { anchoredRef.current = false }, [open, room.id])

  useEffect(() => {
    if (!open) return
    if (!anchoredRef.current) {
      // Salto directo sobre el contenedor: `behavior: 'auto'` delega en el CSS,
      // y el acta pide `scroll-behavior: smooth`, así que el «salto» acababa
      // siendo el mismo paseo animado.
      const list = messagesRef.current
      if (list) list.scrollTop = list.scrollHeight
      anchoredRef.current = true
      return
    }
    messagesEndRef.current?.scrollIntoView({
      block: 'end',
      behavior: isReduceMotionActive() ? 'auto' : 'smooth',
    })
  }, [open, room.id, live.messages.length, live.streaming?.text, live.streaming?.agentId])

  /**
   * Quién ocupa el turno ahora mismo. `speaker_start` llega bastante antes que
   * el primer delta —spawn del CLI + primer token del modelo—, así que la fila
   * viva se pinta desde el turno concedido y no desde el primer texto: si no,
   * la cabecera anuncia un orador sobre un lienzo vacío.
   */
  const liveAgentId = live.streaming?.agentId ?? live.speakingAgentId ?? null
  const liveName = useMemo(
    () => (liveAgentId ? speakerLabel(liveAgentId) : ''),
    [liveAgentId, speakerLabel],
  )

  const seats = useMemo(() => brainstormSeats({
    participantAgentIds: participantResolution.resolvedIds,
    messages: live.messages,
    // Al terminar, `round` ya apunta fuera: los asientos miran la última ronda.
    round: live.status === 'done'
      ? Math.max(0, Math.min(live.round, maxRounds - 1))
      : live.round,
    speakingAgentId: live.speakingAgentId,
  }), [
    live.messages,
    live.round,
    live.speakingAgentId,
    live.status,
    participantResolution.resolvedIds,
    maxRounds,
  ])

  /**
   * Turnos y última línea por asiento: es lo que muestra su tarjeta. La línea
   * sale del acta que ya está en memoria, no de un campo nuevo del protocolo.
   */
  const seatDetail = useMemo(() => {
    const detail = new Map<string, { turns: number; tail: string }>()
    live.messages.forEach(message => {
      if (isBrainstormHumanMessage(message)) return
      const id = resolveBrainstormParticipantDisplay(
        message.agentId,
        agents,
        message.agentName,
      ).agentId
      const previous = detail.get(id)
      detail.set(id, {
        turns: (previous?.turns ?? 0) + 1,
        tail: brainstormSeatTail(message.text),
      })
    })
    return detail
  }, [agents, live.messages])

  /**
   * Puesto en la cola de quien espera. Los turnos se toman de uno en uno —como
   * ya los toma el runner—, así que el asiento puede decir cuántos van antes.
   */
  const queuePositions = useMemo(() => {
    const positions = new Map<string, number>()
    let next = 1
    seats.forEach(seat => {
      if (seat.state !== 'waiting') return
      positions.set(seat.agentId, next)
      next += 1
    })
    return positions
  }, [seats])

  /**
   * Turnos del asiento abierto en su pane, numerados como van en la sala: el
   * pane filtra la lectura, así que hay que poder situar cada intervención.
   */
  const paneTurns = useMemo(() => {
    if (!paneAgentId) return []
    const own: { round: number; turn: number; text: string; live?: boolean }[] = []
    let turn = 0
    live.messages.forEach(message => {
      if (isBrainstormHumanMessage(message)) return
      turn += 1
      const id = resolveBrainstormParticipantDisplay(
        message.agentId,
        agents,
        message.agentName,
      ).agentId
      if (id !== paneAgentId) return
      own.push({
        round: message.round,
        turn,
        text: stripBrainstormProtocolFences(message.text),
      })
    })
    if (live.streaming?.agentId === paneAgentId) {
      own.push({
        round: live.round,
        turn: turn + 1,
        text: stripBrainstormProtocolFences(live.streaming.text),
        live: true,
      })
    }
    return own
  }, [agents, live.messages, live.round, live.streaming, paneAgentId])

  /**
   * Con qué rol se sienta cada uno, su monograma y lo que la tarjeta hereda de
   * la mini del plano (marca del CLI, coordinación, contextos). Los roles de
   * ceremonia mandan sobre el texto libre, igual que en la invitación: es el rol
   * que le dio el asiento.
   */
  const identityOf = useCallback((agentId: string): {
    role: string
    monogram: string
    provider?: AgentCliProvider
    coordination?: AgentCoordination
    contexts: PlaneAgentContextChip[]
  } => {
    const agent = agents.find(item => item.id === agentId)
    const ceremonyRoles = agent ? candidateCeremonyRoles(agent) : []
    const role = ceremonyRoles.length
      ? ceremonyRoles.map(id => t(CEREMONY_ROLE_KEY[id])).join(' · ')
      : agent?.role?.trim() ?? ''
    return {
      role,
      monogram: agent?.monogram?.trim() || agentMonogram(speakerLabel(agentId)),
      provider: agent?.provider,
      coordination: agent?.coordination,
      contexts: resolveAssignedContextChips(
        agent?.contextIds ?? [],
        contexts,
        NO_CONTEXT_USAGE,
        kind => t(`tabContexts.kind_${kind}`),
      ),
    }
  }, [agents, contexts, speakerLabel, t])

  /** Quién de esta sala también tiene asiento en otra: se avisa, no se bloquea. */
  const sharedSeatNames = useMemo(
    () => seats
      .filter(seat => (agentsInOtherRooms[seat.agentId]?.length ?? 0) > 0)
      .map(seat => speakerLabel(seat.agentId)),
    [agentsInOtherRooms, seats, speakerLabel],
  )

  const turnsDone = brainstormTurnsDone(live.messages)
  const totalTurns = brainstormTurnCount({
    participantAgentIds: participantResolution.resolvedIds,
    maxRounds,
  })

  // El cierre es la última entrada, no una pantalla nueva: solo si el turno
  // final trajo las etiquetas y la sala ya terminó.
  // Con ceremonia el cierre trae sus propias etiquetas; sin ella, las genéricas.
  const closingOfLastMessage = useMemo(() => {
    if (live.status !== 'done' || live.streaming) return null
    const last = live.messages[live.messages.length - 1]
    if (!last || isBrainstormHumanMessage(last)) return null
    const text = stripBrainstormProtocolFences(last.text)
    const ceremonyClosing = parseCeremonyClosing(text, room.ceremony)
    if (ceremonyClosing) return { ceremonyClosing }
    const closing = parseBrainstormClosing(text)
    return closing ? { closing } : null
  }, [live.messages, live.status, live.streaming, room.ceremony])

  const workingSetLabels = useMemo(() => {
    const contextIds = hotWorkingSet?.contextIds ?? room.contextIds ?? []
    const filePaths = hotWorkingSet?.filePaths ?? room.filePaths ?? []
    return [
      ...contextIds.map(id => {
        // El id canónico de una issue va en minúsculas a propósito, así que
        // derivar el texto del id pintaba «ct 122». El nombre resuelto —del
        // catálogo o sintetizado— ya trae la clave como se escribe.
        const resolved = resolveTabContextById(id, contexts)
        const fallback = brainstormContextLabel(id)
        if (!resolved) {
          return { key: id, icon: 'note' as IconName, label: fallback.label, hint: fallback.tag }
        }
        return {
          key: id,
          icon: contextIconName(resolved),
          label: resolved.name?.trim() || fallback.label,
          hint: t(`tabContexts.kind_${resolved.kind}`),
        }
      }),
      ...filePaths.map(path => ({
        key: path,
        icon: 'files' as IconName,
        label: path,
        hint: t('tabContexts.kind_files'),
      })),
    ]
  }, [hotWorkingSet, room.contextIds, room.filePaths, contexts, t])

  const showPause = canPauseBrainstorm(live.status)
  const showPlay = canResumeBrainstorm(live.status)
    && participantResolution.resolvedIds.length >= 2
  const showStop = isBrainstormStoppable(live.status) || live.status === 'paused'
  const showComposer = live.status === 'running' || live.status === 'paused'
  const canFinish = !isBrainstormLive(live.status)
  /**
   * Un solo primario en el pie. La sala terminada de forma natural tiene como
   * acción por defecto salir: equivocarse ahí no cuesta nada (el acta queda
   * guardada), mientras que pulsar «una ronda más» por inercia gasta una
   * tirada entera de CLI. Detenida a mano manda Reanudar, que para eso se
   * detuvo, y cerrar baja a secundario.
   */
  const finishIsPrimary = live.status === 'done'
  const showContinueRound = live.status === 'done' && maxRounds < BRAINSTORM_MAX_ROUNDS_CAP
    && participantResolution.resolvedIds.length >= 2
  // `round` es índice de ronda en curso: la ronda humana es +1, salvo al terminar.
  const displayRound = live.status === 'done'
    ? maxRounds
    : Math.min(Math.max(live.round, 0) + 1, maxRounds)
  const orphanWarning = participantResolution.orphanIds.length > 0
    ? t('tabs.brainstormOrphanParticipants', {
      ids: participantResolution.orphanIds.join(', '),
    })
    : null

  // Publica al plano solo cuando cambia algo observable: `onLive` puede ser una
  // lambda nueva en cada render y volverlo a llamar dispararía setState en bucle.
  const liveKey = [
    live.status,
    displayRound,
    maxRounds,
    turnsDone,
    live.speakingAgentId ?? '',
    participantResolution.resolvedIds.join(','),
  ].join('|')

  useEffect(() => {
    onLiveRef.current?.({
      roomId: room.id,
      topic: room.topic,
      status: live.status,
      round: Math.min(displayRound || 1, maxRounds),
      maxRounds,
      turnsDone: Math.min(turnsDone + (live.speakingAgentId ? 1 : 0), totalTurns),
      totalTurns,
      speakingAgentId: live.speakingAgentId,
      speakerName: live.speakingAgentId ? speakerLabel(live.speakingAgentId) : '',
      participantAgentIds: participantResolution.resolvedIds,
    })
  }, [liveKey, room.id])

  const handleStop = (): void => {
    if (stoppedRef.current) return
    const status = liveStatusRef.current
    if (status !== 'running' && status !== 'idle' && status !== 'paused') return
    window.api.stopBrainstorm(room.id)
    stoppedRef.current = true
  }

  const handlePause = (): void => {
    if (!canPauseBrainstorm(liveStatusRef.current)) return
    window.api.pauseBrainstorm(room.id)
  }

  const handlePlay = (): void => {
    if (!canResumeBrainstorm(liveStatusRef.current)) return
    if (participantResolution.resolvedIds.length < 2) return
    stoppedRef.current = false
    window.api.startBrainstorm({
      roomId: room.id,
      topic: room.topic,
      participantAgentIds: participantResolution.resolvedIds,
      maxRounds,
      contextIds: room.contextIds,
      filePaths: room.filePaths,
      outcome: room.outcome,
      cwd: cwd.trim(),
      resume: true,
    })
  }

  const handleContinueRound = (): void => {
    if (liveStatusRef.current !== 'done') return
    if (participantResolution.resolvedIds.length < 2) return
    const next = sanitizeBrainstormMaxRounds(maxRounds + 1)
    if (next <= maxRounds) return
    setMaxRounds(next)
    stoppedRef.current = false
    window.api.startBrainstorm({
      roomId: room.id,
      topic: room.topic,
      participantAgentIds: participantResolution.resolvedIds,
      maxRounds: next,
      contextIds: room.contextIds,
      filePaths: room.filePaths,
      outcome: room.outcome,
      cwd: cwd.trim(),
      resume: true,
    })
  }

  /**
   * Cerrar = minimizar mientras el runner vive en main y sigue emitiendo.
   * Ya terminada no hay nada que mantener vivo: la suelta del plano, que si no
   * la sala se queda pegada y el botón del plano nunca vuelve a «Nueva sala».
   */
  const handleClose = (): void => {
    if (canFinish && onFinish) onFinish()
    else onClose()
  }

  const handleHumanSend = useCallback((text: string, targetAgentId?: string): void => {
    setLive(previous => reduceBrainstormLiveEvent(previous, {
      type: 'human_message',
      text,
      round: previous.round,
      ...(targetAgentId ? { targetAgentId } : {}),
    }))
    window.api.injectBrainstormHumanMessage(room.id, text, targetAgentId)
  }, [room.id])

  const handleAddWorkingSet = useCallback((working: {
    contextIds: string[]
    filePaths: string[]
  }): void => {
    void window.api
      .addBrainstormWorkingSet(room.id, { ...working, cwd: cwd.trim() })
      .then(result => {
        if (result.ok) setHotWorkingSet(result)
        else setWorkingSetError(result.error)
      })
  }, [cwd, room.id])

  if (!open) return null

  return (
    <BrainstormOverlay
      active={active}
      /* Hay alguien con el turno: mismas partículas que el piso del plano. */
      busy={Boolean(live.speakingAgentId)}
      ariaLabel={t('tabs.brainstormViewTitle')}
      /* ✕ cierra la vista, no la sala: el runner sigue en main y al volver está
         el acta entera. Terminada sí se suelta —su cierre queda guardado. */
      closeLabel={canFinish
        ? t('tabs.brainstormFinishHint')
        : t('tabs.brainstormCloseView')}
      onClose={handleClose}
      seatCount={seats.length}
      chrome={(
        <>
          {/* Con más de una sala viva, en cuál estás y cómo saltar a la otra. */}
          {liveRooms.length > 1 && onSwitchRoom ? (
            <button
              type="button"
              className="brainstorm-overlay__chip brainstorm-overlay__chip--button"
              onClick={() => {
                const index = liveRooms.findIndex(item => item.roomId === room.id)
                const next = liveRooms[(index + 1) % liveRooms.length]
                if (next && next.roomId !== room.id) onSwitchRoom(next.roomId)
              }}
            >
              <span className="brainstorm-overlay__chip-index">
                {t('tabs.brainstormRoomSwitch', {
                  current: String(
                    Math.max(0, liveRooms.findIndex(item => item.roomId === room.id)) + 1,
                  ),
                  total: String(liveRooms.length),
                })}
              </span>
            </button>
          ) : null}
          <span
            className={[
              'brainstorm-overlay__chip',
              live.status === 'running' ? 'brainstorm-overlay__chip--live' : '',
            ].filter(Boolean).join(' ')}
          >
            {live.status === 'running' ? (
              <i className="brainstorm-overlay__chip-dot" aria-hidden />
            ) : null}
            {/* «X está hablando» mientras aún no ha escrito nada contradecía a
                su propia tarjeta, que decía «todavía no habló». */}
            {live.speakingAgentId
              ? t(
                live.streaming
                  ? 'tabs.brainstormSpeakingNow'
                  : 'tabs.brainstormPreparingNow',
                { name: speakerLabel(live.speakingAgentId) },
              )
              : t(statusLabelKey(live.status))}
          </span>
          <span className="brainstorm-overlay__chip brainstorm-overlay__chip--dim">
            {t('tabs.brainstormRoundValue', {
              current: Math.min(displayRound || 1, maxRounds),
              max: maxRounds,
            })}
            {' · '}
            {t('tabs.brainstormTurnProgress', {
              current: Math.min(turnsDone + (live.speakingAgentId ? 1 : 0), totalTurns),
              total: totalTurns,
            })}
          </span>
          {showPause ? (
            <Tooltip content={t('tabs.brainstormPause')}>
              <button
                type="button"
                className="brainstorm-overlay__icon"
                aria-label={t('tabs.brainstormPause')}
                onClick={handlePause}
              >
                <Icon name="pause" size={12} />
              </button>
            </Tooltip>
          ) : null}
          {showPlay ? (
            <Tooltip content={t('tabs.brainstormResume')}>
              <button
                type="button"
                className="brainstorm-overlay__icon"
                aria-label={t('tabs.brainstormResume')}
                onClick={handlePlay}
              >
                <Icon name="play" size={12} />
              </button>
            </Tooltip>
          ) : null}
          {/* Detener es explícito y aparte de cerrar: en pantalla completa la ✕
              se lee como «salir», y salir no puede matar la sala. */}
          {showStop ? (
            <Tooltip content={t('tabs.brainstormStopRun')}>
              <button
                type="button"
                className="brainstorm-overlay__icon brainstorm-overlay__icon--danger"
                aria-label={t('tabs.brainstormStopRun')}
                onClick={handleStop}
              >
                <Icon name="stop" size={12} />
              </button>
            </Tooltip>
          ) : null}
        </>
      )}
      left={(
        <>
          <section className="brainstorm-panel">
            <span className="brainstorm-panel__title">
              {t('tabs.brainstormRoundLabel')}
            </span>
            {/* La cronología dice «por dónde va», que es una pregunta de sala
                viva. Terminada, la respuesta cabe en una línea. */}
            {isBrainstormLive(live.status) ? (
              <ol className="brainstorm-rounds">
                {Array.from({ length: maxRounds }, (_, index) => (
                  <li
                    key={index}
                    className={[
                      'brainstorm-rounds__item',
                      index < live.round ? 'brainstorm-rounds__item--done' : '',
                      index === live.round && live.status === 'running'
                        ? 'brainstorm-rounds__item--now'
                        : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <i className="brainstorm-rounds__pip" aria-hidden />
                    {index + 1}
                  </li>
                ))}
              </ol>
            ) : (
              <span className="brainstorm-panel__hint">
                {t('tabs.brainstormRoundsClosed', {
                  rounds: String(maxRounds),
                  turns: String(turnsDone),
                })}
              </span>
            )}
          </section>

          {/* La cola, dicha en claro: los turnos van de uno en uno, así que una
              sala de nueve asientos es larga y tiene que leerse como larga, no
              como colgada. Terminada no hay cola que contar. */}
          {isBrainstormLive(live.status) ? (
          <section className="brainstorm-panel">
            <span className="brainstorm-panel__title">
              {t('tabs.brainstormQueueLabel')}
            </span>
            <span className="brainstorm-panel__hint">
              {t('tabs.brainstormQueueLine', {
                running: String(live.speakingAgentId ? 1 : 0),
                queued: String(Math.max(0, totalTurns - turnsDone - (live.speakingAgentId ? 1 : 0))),
                total: String(totalTurns),
              })}
            </span>
            <span className="brainstorm-panel__hint">
              {sharedSeatNames.length
                ? t('tabs.brainstormQueueShared', { names: sharedSeatNames.join(', ') })
                : t('tabs.brainstormQueueHint')}
            </span>
          </section>
          ) : null}

          {live.status !== 'done' ? (
            <section className="brainstorm-panel">
              <span className="brainstorm-panel__title">
                {t('tabs.brainstormOutcomePending')}
              </span>
              <span className="brainstorm-panel__hint">
                {t('tabs.brainstormOutcomePendingHint')}
              </span>
            </section>
          ) : null}

          {workingSetLabels.length ? (
            <section className="brainstorm-panel">
              <span className="brainstorm-panel__title">
                {t('tabs.brainstormWorkingSetLabel')}
              </span>
              {workingSetLabels.map(item => (
                <Tooltip key={item.key} content={item.label} hint={item.hint}>
                  <span className="brainstorm-room-view__ws-chip">
                    <span className="brainstorm-room-view__ws-icon">
                      <Icon name={item.icon} size={12} />
                    </span>
                    <span className="brainstorm-room-view__ws-name">{item.label}</span>
                  </span>
                </Tooltip>
              ))}
            </section>
          ) : null}
        </>
      )}
      right={(
        <>
          <div className="brainstorm-overlay__col-head">
            <span className="brainstorm-overlay__col-title">
              {t('tabs.brainstormSeatsTitle')}
            </span>
            <span className="brainstorm-overlay__col-count">
              {seats.length}
            </span>
          </div>
          {seats.map(seat => {
            const detail = seatDetail.get(seat.agentId)
            const streaming = live.streaming?.agentId === seat.agentId
            const identity = identityOf(seat.agentId)
            return (
              <BrainstormLiveSeatCard
                key={seat.agentId}
                agentId={seat.agentId}
                name={speakerLabel(seat.agentId)}
                role={identity.role}
                monogram={identity.monogram}
                provider={identity.provider}
                coordination={identity.coordination}
                contexts={identity.contexts}
                state={seat.state}
                queuePosition={queuePositions.get(seat.agentId)}
                turnsDone={detail?.turns ?? 0}
                rounds={maxRounds}
                tail={streaming
                  ? brainstormSeatTail(live.streaming?.text ?? '')
                  : detail?.tail}
                live={streaming}
                alsoInRooms={agentsInOtherRooms[seat.agentId] ?? []}
                contextDrop={handlersFor(seat.agentId)}
                contextDropActive={dropAgentId === seat.agentId}
                onOpen={() => setPaneAgentId(seat.agentId)}
              />
            )
          })}
        </>
      )}
      /* Un asiento a pantalla: solo sus turnos. Filtra lo que lees; escribir
         desde ahí publica en la sala, dirigido a él. Va en la capa de encima
         para que su velo tape también los asientos y el borde de su columna. */
      pane={paneAgentId ? (
        <BrainstormAgentPane
          agentId={paneAgentId}
          name={speakerLabel(paneAgentId)}
          role={identityOf(paneAgentId).role}
          turns={paneTurns}
          roomTurns={totalTurns}
          speaking={live.streaming?.agentId === paneAgentId
            || live.speakingAgentId === paneAgentId}
          onClose={() => setPaneAgentId(null)}
          composer={showComposer ? (
            <BrainstormHumanComposer
              placeholder={t('tabs.brainstormPaneAsk', { name: speakerLabel(paneAgentId) })}
              sendLabel={t('tabs.brainstormHumanSend')}
              roomLabel={t('tabs.brainstormTargetRoom')}
              timingHint={t('tabs.brainstormHumanTiming', {
                turn: Math.min(turnsDone + 1, totalTurns),
              })}
              cwd={cwd}
              addContextLabel={t('tabs.brainstormHumanAddContext')}
              onSend={text => handleHumanSend(text, paneAgentId)}
            />
          ) : undefined}
        />
      ) : null}
    >
      <div className="brainstorm-room-view">
        {/* Ronda, turno y quién habla viven en el chrome de arriba: aquí solo el
            objetivo, que es lo que hay que tener delante al leer el acta. */}
        <header className="brainstorm-room-view__head">
          <h2 className="brainstorm-room-view__topic">{room.topic}</h2>
        </header>

        <div
          ref={messagesRef}
          className="brainstorm-room-view__messages"
          role="log"
          aria-live="polite"
        >
          {live.messages.map((message, index) => {
            const human = isBrainstormHumanMessage(message)
            const laneAgentId = human
              ? message.agentId
              : resolveBrainstormParticipantDisplay(
                message.agentId,
                agents,
                message.agentName,
              ).agentId
            const color = human
              ? 'var(--accent)'
              : paletteColorForSeed(laneAgentId)
            const previous = live.messages[index - 1]
            const opensRound = !previous || previous.round !== message.round
            const closing = !human && index === live.messages.length - 1
              ? closingOfLastMessage
              : null
            if (closing) {
              return (
                <React.Fragment key={`${message.agentId}-${message.round}-${index}`}>
                  {opensRound ? (
                    <p className="brainstorm-room-view__round-sep">
                      {t('tabs.brainstormRoundSeparator', { round: message.round + 1 })}
                    </p>
                  ) : null}
                  <BrainstormClosingCard
                    roomId={room.id}
                    topic={room.topic}
                    cwd={cwd}
                    closing={closing.closing}
                    ceremonyClosing={closing.ceremonyClosing}
                    speakerLabel={speakerLabel(message.agentId, message.agentName)}
                    onContextSaved={onContextSaved}
                  />
                </React.Fragment>
              )
            }
            // Una sola pasada por mensaje: parte prosa y ops de wiki.
            const parts = human ? null : splitBrainstormMessage(message.text)
            return (
              <React.Fragment key={`${message.agentId}-${message.round}-${index}`}>
                {opensRound ? (
                  <p className="brainstorm-room-view__round-sep">
                    {t('tabs.brainstormRoundSeparator', { round: message.round + 1 })}
                  </p>
                ) : null}
                <article
                  className={[
                    'brainstorm-room-view__row',
                    human ? 'brainstorm-room-view__row--human' : '',
                  ].filter(Boolean).join(' ')}
                  style={{ '--brainstorm-speaker': color } as React.CSSProperties}
                >
                  <span className="brainstorm-room-view__lane" aria-hidden />
                  <div className="brainstorm-room-view__entry">
                    <span className="brainstorm-room-view__speaker">
                      {human
                        ? (message.targetAgentId
                            ? t('tabs.brainstormHumanToLabel', {
                                name: speakerLabel(message.targetAgentId),
                              })
                            : t('tabs.brainstormHumanLabel'))
                        : speakerLabel(message.agentId, message.agentName)}
                    </span>
                    <ChatBubble variant={human ? 'user' : 'assistant'}>
                      {human ? (
                        <div className="brainstorm-room-view__plain">{message.text}</div>
                      ) : (
                        <AiMarkdown content={parts?.prose ?? ''} />
                      )}
                    </ChatBubble>
                    {/* Lo que el turno escribió en el wiki: era el JSON de las
                        ops en mitad de la conversación, y taparlo sin más
                        dejaba el trabajo invisible. */}
                    {parts ? (
                      <BrainstormWikiCard
                        ops={parts.wikiOps}
                        log={parts.wikiLog}
                        onOpenPage={openWikiPage}
                      />
                    ) : null}
                  </div>
                </article>
              </React.Fragment>
            )
          })}
          {liveAgentId ? (
            <article
              className="brainstorm-room-view__row brainstorm-room-view__row--live"
              style={{
                '--brainstorm-speaker': paletteColorForSeed(
                  resolveBrainstormParticipantDisplay(liveAgentId, agents).agentId,
                ),
              } as React.CSSProperties}
            >
              <span className="brainstorm-room-view__lane" aria-hidden />
              <div className="brainstorm-room-view__entry">
                {live.streaming ? (
                  <>
                    <span className="brainstorm-room-view__speaker">
                      {t('tabs.brainstormSpeakerWriting', { name: liveName })}
                    </span>
                    <ChatBubble variant="assistant" live>
                      <AiMarkdown
                        content={stripBrainstormProtocolFences(live.streaming.text)}
                        showCursor
                      />
                    </ChatBubble>
                  </>
                ) : (
                  /* La espera puede ser medio minuto: ver `BrainstormSpeakerWaiting`. */
                  <BrainstormSpeakerWaiting
                    name={liveName}
                    role={agents.find(item => item.id === liveAgentId)?.role}
                    phase={live.speakerPhase}
                    material={workingSetLabels.map(item => item.label)}
                    turnKey={`${liveAgentId}:${live.round}`}
                  />
                )}
              </div>
            </article>
          ) : null}
          {/* Hueco entre arrancar y conceder el primer turno: main está leyendo
              el material de disco y armando el prompt. */}
          {!live.messages.length && !liveAgentId
            && (live.status === 'running' || live.status === 'idle') ? (
              <p className="brainstorm-room-view__warmup" role="status">
                {t('tabs.brainstormRoomWarmup')}
              </p>
            ) : null}
          <div ref={messagesEndRef} className="brainstorm-room-view__anchor" aria-hidden />
        </div>

        {orphanWarning ? (
          <p className="brainstorm-room-view__error" role="status">
            {orphanWarning}
          </p>
        ) : null}

        {live.lastError ? (
          <p className="brainstorm-room-view__error">{live.lastError}</p>
        ) : null}

        {workingSetError ? (
          <p className="brainstorm-room-view__error" role="status">{workingSetError}</p>
        ) : null}

        {showComposer ? (
          <BrainstormHumanComposer
            placeholder={t('tabs.brainstormHumanPlaceholder')}
            sendLabel={t('tabs.brainstormHumanSend')}
            roomLabel={t('tabs.brainstormTargetRoom')}
            targets={participantResolution.resolvedIds.map(agentId => ({
              agentId,
              label: speakerLabel(agentId),
            }))}
            timingHint={t('tabs.brainstormHumanTiming', {
              turn: Math.min(turnsDone + 1, totalTurns),
            })}
            cwd={cwd}
            addContextLabel={t('tabs.brainstormHumanAddContext')}
            onAddWorkingSet={live.status === 'running' || live.status === 'paused'
              ? handleAddWorkingSet
              : undefined}
            onSend={handleHumanSend}
          />
        ) : null}

        {/* Acciones de sala terminada: una ronda más o soltarla del plano. Van
            aquí y no en el chrome porque son raras y necesitan su etiqueta. */}
        {showContinueRound || (canFinish && onFinish) ? (
          <div className="brainstorm-room-view__footer">
            {showContinueRound ? (
              <Tooltip content={t('tabs.brainstormContinueRoundHint', { max: BRAINSTORM_MAX_ROUNDS_CAP })}>
                <Button variant="secondary" size="sm" onClick={handleContinueRound}>
                  {t('tabs.brainstormContinueRound')}
                </Button>
              </Tooltip>
            ) : null}
            {canFinish && onFinish ? (
              <Tooltip content={t('tabs.brainstormFinishHint')}>
                <Button
                  variant={finishIsPrimary ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={onFinish}
                >
                  {t('tabs.brainstormFinish')}
                </Button>
              </Tooltip>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* La página que escribió un turno, abierta desde su tarjeta. */}
      {wikiPage ? (
        <TerminalModal
          open
          active={active}
          movable
          title={wikiPage.title}
          size="sm"
          zIndex={APP_OVERLAY_MODAL_Z + 10}
          onClose={() => setWikiPage(null)}
        >
          <div className="brainstorm-room-view__wiki-page">
            <p className="brainstorm-room-view__wiki-type">
              {t(wikiTypeLabelKey(wikiPage.type))}
            </p>
            <AiMarkdown content={formatWikiPageBodyForHuman(wikiPage.body ?? '')} />
          </div>
        </TerminalModal>
      ) : null}

      {/* El slug no está en el grafo: el turno la escribió, pero no llegó a
          disco. Decirlo es más útil que no abrir nada. */}
      {wikiPageMissing ? (
        <TerminalModal
          open
          active={active}
          title={wikiPageMissing}
          size="sm"
          zIndex={APP_OVERLAY_MODAL_Z + 10}
          onClose={() => setWikiPageMissing(null)}
        >
          <p className="brainstorm-room-view__wiki-missing">
            {t('tabs.brainstormWikiPageMissing')}
          </p>
        </TerminalModal>
      ) : null}
    </BrainstormOverlay>
  )
}
