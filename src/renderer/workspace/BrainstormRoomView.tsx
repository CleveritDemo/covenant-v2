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
  resolveBrainstormParticipantDisplay,
  resolveBrainstormParticipantIds,
  sanitizeBrainstormMaxRounds,
  stripBrainstormProtocolFences,
  type BrainstormCatalogAgent,
  type BrainstormSeatState,
} from '@shared/brainstormRoom'
import { paletteColorForSeed } from '@shared/tabContextAppearance'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import { Button, Tooltip } from '../components/ui'
import { AiMarkdown } from '../components/AiMarkdown'
import { ChatBubble } from '../components/ai/ChatBubble'
import {
  createInitialBrainstormLiveState,
  reduceBrainstormLiveEvent,
  type BrainstormLiveSummary,
} from './brainstormLiveState'
import {
  canPauseBrainstorm,
  canResumeBrainstorm,
  isBrainstormStoppable,
} from './brainstormViewClose'
import { BrainstormClosingCard } from './BrainstormClosingCard'
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
  /** Estado vivo hacia el plano (indicador en agentes + flyout). */
  onLive?: (summary: BrainstormLiveSummary) => void
  /** El cierre se guardó como contexto en `.gravity`: refrescar la lista de la pestaña. */
  onContextSaved?: () => void
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

function seatStateKey(
  state: BrainstormSeatState,
): 'tabs.brainstormSeatSpeaking' | 'tabs.brainstormSeatSpoke' | 'tabs.brainstormSeatWaiting' {
  if (state === 'speaking') return 'tabs.brainstormSeatSpeaking'
  if (state === 'spoke') return 'tabs.brainstormSeatSpoke'
  return 'tabs.brainstormSeatWaiting'
}

/**
 * Etiqueta del working set desde el id, sin ir a disco:
 * `iaterminal:<kind>:<stem>` → kind + stem.
 * ponytail: el nombre real exigiría discoverTabContexts; el stem alcanza para reconocerlo.
 */
function workingSetLabel(contextId: string): { tag: string; label: string } {
  const parts = contextId.split(':')
  const kind = parts[1] ?? 'ctx'
  const stem = parts.slice(2).join(':').replace(/-/g, ' ')
  return { tag: kind, label: stem || kind }
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
  onLive,
  onContextSaved,
}) => {
  const { t } = useT()
  const [live, setLive] = useState(() => createInitialBrainstormLiveState(room))
  const [maxRounds, setMaxRounds] = useState(() => sanitizeBrainstormMaxRounds(room.maxRounds))
  const liveStatusRef = useRef(live.status)
  const stoppedRef = useRef(false)
  const onLiveRef = useRef(onLive)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  onLiveRef.current = onLive
  /** Working set tras añadir en caliente (la sala en disco la actualiza main). */
  const [hotWorkingSet, setHotWorkingSet] = useState<{
    contextIds: string[]
    filePaths: string[]
  } | null>(null)
  const [workingSetError, setWorkingSetError] = useState<string | null>(null)
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

  // Auto-scroll al último mensaje / burbuja en vivo.
  useEffect(() => {
    if (!open) return
    messagesEndRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [open, live.messages.length, live.streaming?.text, live.streaming?.agentId])

  const streamingName = useMemo(() => {
    if (!live.streaming) return ''
    return speakerLabel(live.streaming.agentId)
  }, [live.streaming, speakerLabel])

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

  const turnsDone = brainstormTurnsDone(live.messages)
  const totalTurns = brainstormTurnCount({
    participantAgentIds: participantResolution.resolvedIds,
    maxRounds,
  })

  // El cierre es la última entrada, no una pantalla nueva: solo si el turno
  // final trajo las etiquetas y la sala ya terminó.
  const closingOfLastMessage = useMemo(() => {
    if (live.status !== 'done' || live.streaming) return null
    const last = live.messages[live.messages.length - 1]
    if (!last || isBrainstormHumanMessage(last)) return null
    return parseBrainstormClosing(stripBrainstormProtocolFences(last.text))
  }, [live.messages, live.status, live.streaming])

  const workingSetLabels = useMemo(() => {
    const contextIds = hotWorkingSet?.contextIds ?? room.contextIds ?? []
    const filePaths = hotWorkingSet?.filePaths ?? room.filePaths ?? []
    return [
      ...contextIds.map(id => ({ key: id, ...workingSetLabel(id) })),
      ...filePaths.map(path => ({ key: path, tag: 'file', label: path })),
    ]
  }, [hotWorkingSet, room.contextIds, room.filePaths])

  const showPause = canPauseBrainstorm(live.status)
  const showPlay = canResumeBrainstorm(live.status)
    && participantResolution.resolvedIds.length >= 2
  const showStop = isBrainstormStoppable(live.status) || live.status === 'paused'
  const showComposer = live.status === 'running' || live.status === 'paused'
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

  // Cerrar = minimizar: el runner vive en main y sigue emitiendo. Detener es Stop.
  const handleClose = (): void => {
    onClose()
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

  return (
    <TerminalModal
      open={open}
      active={active}
      onClose={handleClose}
      title={t('tabs.brainstormViewTitle')}
      size="lg"
      zIndex={855}
      bodyLayout="flush"
      closeOnBackdrop
      footer={(
        <div className="brainstorm-room-view__footer">
          {showPause ? (
            <Button variant="secondary" size="sm" onClick={handlePause}>
              {t('tabs.brainstormPause')}
            </Button>
          ) : null}
          {showPlay ? (
            <Button variant="primary" size="sm" onClick={handlePlay}>
              {t('tabs.brainstormResume')}
            </Button>
          ) : null}
          {showContinueRound ? (
            <Tooltip content={t('tabs.brainstormContinueRoundHint', { max: BRAINSTORM_MAX_ROUNDS_CAP })}>
              <Button variant="primary" size="sm" onClick={handleContinueRound}>
                {t('tabs.brainstormContinueRound')}
              </Button>
            </Tooltip>
          ) : null}
          {showStop ? (
            <Button variant="danger" size="sm" onClick={handleStop}>
              {t('tabs.brainstormStop')}
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={handleClose}>
            {t('tabs.brainstormClose')}
          </Button>
        </div>
      )}
    >
      <div className="brainstorm-room-view">
        <header className="brainstorm-room-view__head">
          <p className="brainstorm-room-view__topic">{room.topic}</p>
          <div className="brainstorm-room-view__meta">
            <span className="brainstorm-room-view__pips" aria-hidden>
              {Array.from({ length: maxRounds }, (_, index) => (
                <i
                  key={index}
                  className={[
                    'brainstorm-room-view__pip',
                    index < live.round ? 'brainstorm-room-view__pip--done' : '',
                    index === live.round && live.status === 'running'
                      ? 'brainstorm-room-view__pip--now'
                      : '',
                  ].filter(Boolean).join(' ')}
                />
              ))}
            </span>
            <span>
              {t('tabs.brainstormRoundLabel')}
              {' '}
              <strong>
                {t('tabs.brainstormRoundValue', {
                  current: Math.min(displayRound || 1, maxRounds),
                  max: maxRounds,
                })}
              </strong>
            </span>
            <span>
              {t('tabs.brainstormTurnProgress', {
                current: Math.min(turnsDone + (live.speakingAgentId ? 1 : 0), totalTurns),
                total: totalTurns,
              })}
            </span>
            <span>
              {live.speakingAgentId
                ? t('tabs.brainstormSpeakingNow', {
                    name: speakerLabel(live.speakingAgentId),
                  })
                : t(statusLabelKey(live.status))}
            </span>
          </div>
        </header>

        <div className="brainstorm-room-view__body">
        <div
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
                    closing={closing}
                    speakerLabel={speakerLabel(message.agentId, message.agentName)}
                    onContextSaved={onContextSaved}
                  />
                </React.Fragment>
              )
            }
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
                        <AiMarkdown content={stripBrainstormProtocolFences(message.text)} />
                      )}
                    </ChatBubble>
                  </div>
                </article>
              </React.Fragment>
            )
          })}
          {live.streaming ? (
            <article
              className="brainstorm-room-view__row brainstorm-room-view__row--live"
              style={{
                '--brainstorm-speaker': paletteColorForSeed(
                  resolveBrainstormParticipantDisplay(
                    live.streaming.agentId,
                    agents,
                  ).agentId,
                ),
              } as React.CSSProperties}
            >
              <span className="brainstorm-room-view__lane" aria-hidden />
              <div className="brainstorm-room-view__entry">
                <span className="brainstorm-room-view__speaker">
                  {t('tabs.brainstormSpeakerWriting', { name: streamingName })}
                </span>
                <ChatBubble variant="assistant" live>
                  <AiMarkdown
                    content={stripBrainstormProtocolFences(live.streaming.text)}
                    showCursor
                  />
                </ChatBubble>
              </div>
            </article>
          ) : null}
          <div ref={messagesEndRef} className="brainstorm-room-view__anchor" aria-hidden />
        </div>

        <aside className="brainstorm-room-view__side">
          <section className="brainstorm-room-view__side-group">
            <h3 className="brainstorm-room-view__side-title">
              {t('tabs.brainstormSeatsTitle')}
            </h3>
            {seats.map(seat => (
              <p
                key={seat.agentId}
                className={[
                  'brainstorm-room-view__seat',
                  seat.state === 'speaking' ? 'brainstorm-room-view__seat--speaking' : '',
                ].filter(Boolean).join(' ')}
                style={{
                  '--brainstorm-speaker': paletteColorForSeed(seat.agentId),
                } as React.CSSProperties}
              >
                <span className="brainstorm-room-view__seat-dot" aria-hidden />
                <Tooltip content={speakerLabel(seat.agentId)} hint={t(seatStateKey(seat.state))}>
                  <span className="brainstorm-room-view__seat-name">
                    {speakerLabel(seat.agentId)}
                  </span>
                </Tooltip>
                <span className="brainstorm-room-view__seat-state">
                  {t(seatStateKey(seat.state))}
                </span>
              </p>
            ))}
          </section>

          {workingSetLabels.length ? (
            <section className="brainstorm-room-view__side-group">
              <h3 className="brainstorm-room-view__side-title">
                {t('tabs.brainstormWorkingSetLabel')}
              </h3>
              {workingSetLabels.map(item => (
                <Tooltip key={item.key} content={item.label} hint={item.tag}>
                  <span className="brainstorm-room-view__ws-chip">
                    <span className="brainstorm-room-view__ws-tag">{item.tag}</span>
                    <span className="brainstorm-room-view__ws-name">{item.label}</span>
                  </span>
                </Tooltip>
              ))}
            </section>
          ) : null}
        </aside>
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
      </div>
    </TerminalModal>
  )
}
