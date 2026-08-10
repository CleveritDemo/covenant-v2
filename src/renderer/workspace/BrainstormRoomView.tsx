import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BrainstormRoom } from '@shared/brainstormRoom'
import {
  dedupeAgentIdsPreservingOrder,
  isBrainstormHumanMessage,
  resolveBrainstormParticipantDisplay,
  resolveBrainstormParticipantIds,
  type BrainstormCatalogAgent,
} from '@shared/brainstormRoom'
import { paletteColorForSeed } from '@shared/tabContextAppearance'
import { useT } from '@i18n/useT'
import { TerminalModal } from '../components/TerminalModal'
import { Button } from '../components/ui'
import { AiMarkdown } from '../components/AiMarkdown'
import {
  createInitialBrainstormLiveState,
  reduceBrainstormLiveEvent,
} from './brainstormLiveState'
import {
  canPauseBrainstorm,
  canResumeBrainstorm,
  isBrainstormStoppable,
  stopBrainstormIfActive,
} from './brainstormViewClose'
import { BrainstormHumanComposer } from './BrainstormHumanComposer'
import './BrainstormRoomView.css'

export interface BrainstormRoomViewProps {
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
  onClose: () => void
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

/** Índice estable del hablante para alinear burbujas (impar → derecha). */
function speakerLane(agentId: string, order: readonly string[]): number {
  const at = order.indexOf(agentId)
  if (at >= 0) return at
  return order.length
}

/** Vista en vivo: chat multi-agente + play/pausa/stop; cierre detiene si running/idle. */
export const BrainstormRoomView: React.FC<BrainstormRoomViewProps> = ({
  open,
  active = true,
  room,
  cwd,
  agents = [],
  agentNamesById = {},
  onClose,
}) => {
  const { t } = useT()
  const [live, setLive] = useState(() => createInitialBrainstormLiveState(room))
  const liveStatusRef = useRef(live.status)
  const stoppedRef = useRef(false)
  const pendingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
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

  const speakerOrder = useMemo(() => {
    const seen: string[] = []
    const push = (id: string): void => {
      const display = agents.length > 0
        ? resolveBrainstormParticipantDisplay(id, agents)
        : { agentId: id, known: true, label: id }
      const key = display.known ? display.agentId : id
      if (!seen.includes(key)) seen.push(key)
    }
    for (const id of participantResolution.resolvedIds) push(id)
    for (const message of live.messages) {
      if (isBrainstormHumanMessage(message)) continue
      push(message.agentId)
    }
    if (live.streaming) push(live.streaming.agentId)
    return seen
  }, [agents, live.messages, live.streaming, participantResolution.resolvedIds])

  useEffect(() => {
    if (!open) return
    setLive(createInitialBrainstormLiveState(room))
    stoppedRef.current = false
  }, [open, room.id])

  useEffect(() => {
    if (pendingStopTimerRef.current != null) {
      clearTimeout(pendingStopTimerRef.current)
      pendingStopTimerRef.current = null
    }
    if (!open) return

    const unsubscribe = window.api.onBrainstormEvent(room.id, event => {
      setLive(previous => reduceBrainstormLiveEvent(previous, event))
    })

    return () => {
      unsubscribe()
      // Deferred: StrictMode remount cancela el timer; unmount real sí detiene.
      // Pausa NO se dispara aquí — solo stop si running/idle.
      pendingStopTimerRef.current = setTimeout(() => {
        pendingStopTimerRef.current = null
        const didStop = stopBrainstormIfActive({
          status: liveStatusRef.current,
          roomId: room.id,
          alreadyStopped: stoppedRef.current,
          stop: id => window.api.stopBrainstorm(id),
        })
        if (didStop) stoppedRef.current = true
      }, 0)
    }
  }, [open, room.id])

  // Auto-scroll al último mensaje / burbuja en vivo.
  useEffect(() => {
    if (!open) return
    messagesEndRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [open, live.messages.length, live.streaming?.text, live.streaming?.agentId])

  const streamingName = useMemo(() => {
    if (!live.streaming) return ''
    return speakerLabel(live.streaming.agentId)
  }, [live.streaming, speakerLabel])

  const showPause = canPauseBrainstorm(live.status)
  const showPlay = canResumeBrainstorm(live.status)
    && participantResolution.resolvedIds.length >= 2
  const showStop = isBrainstormStoppable(live.status) || live.status === 'paused'
  const showComposer = live.status === 'running' || live.status === 'paused'
  const displayRound = Math.max(live.round, 0) + (live.status === 'running' ? 1 : 0)
  const orphanWarning = participantResolution.orphanIds.length > 0
    ? t('tabs.brainstormOrphanParticipants', {
      ids: participantResolution.orphanIds.join(', '),
    })
    : null

  const handleStop = (): void => {
    if (pendingStopTimerRef.current != null) {
      clearTimeout(pendingStopTimerRef.current)
      pendingStopTimerRef.current = null
    }
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
      maxRounds: room.maxRounds,
      contextIds: room.contextIds,
      filePaths: room.filePaths,
      outcome: room.outcome,
      cwd: cwd.trim(),
      resume: true,
    })
  }

  const handleClose = (): void => {
    // Solo stop si running/idle — paused se conserva en disco.
    if (pendingStopTimerRef.current != null) {
      clearTimeout(pendingStopTimerRef.current)
      pendingStopTimerRef.current = null
    }
    const didStop = stopBrainstormIfActive({
      status: liveStatusRef.current,
      roomId: room.id,
      alreadyStopped: stoppedRef.current,
      stop: id => window.api.stopBrainstorm(id),
    })
    if (didStop) stoppedRef.current = true
    onClose()
  }

  const handleHumanSend = useCallback((text: string): void => {
    setLive(previous => reduceBrainstormLiveEvent(previous, {
      type: 'human_message',
      text,
      round: previous.round,
    }))
    window.api.injectBrainstormHumanMessage(room.id, text)
  }, [room.id])

  return (
    <TerminalModal
      open={open}
      active={active}
      onClose={handleClose}
      title={t('tabs.brainstormViewTitle')}
      size="lg"
      zIndex={855}
      bodyLayout="flush"
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
            <span>
              {t('tabs.brainstormRoundLabel')}
              {' '}
              <strong>
                {t('tabs.brainstormRoundValue', {
                  current: Math.min(displayRound || 1, room.maxRounds),
                  max: room.maxRounds,
                })}
              </strong>
            </span>
            <span>
              {t('tabs.brainstormStatusLabel')}
              {' '}
              <strong>{t(statusLabelKey(live.status))}</strong>
            </span>
          </div>
        </header>

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
            const lane = human
              ? 'human'
              : speakerLane(laneAgentId, speakerOrder) % 2 === 1
                ? 'end'
                : 'start'
            return (
              <article
                key={`${message.agentId}-${message.round}-${index}`}
                className={[
                  'brainstorm-room-view__row',
                  `brainstorm-room-view__row--${lane}`,
                ].join(' ')}
                style={{ '--brainstorm-speaker': color } as React.CSSProperties}
              >
                <span className="brainstorm-room-view__speaker">
                  {human
                    ? t('tabs.brainstormHumanLabel')
                    : t('tabs.brainstormSpeakerLabel', {
                        name: speakerLabel(message.agentId, message.agentName),
                        round: message.round + 1,
                      })}
                </span>
                <div
                  className={[
                    'brainstorm-room-view__bubble',
                    human ? 'brainstorm-room-view__bubble--human' : '',
                  ].filter(Boolean).join(' ')}
                >
                  {human ? (
                    <div className="brainstorm-room-view__plain">{message.text}</div>
                  ) : (
                    <AiMarkdown content={message.text} />
                  )}
                </div>
              </article>
            )
          })}
          {live.streaming ? (
            <article
              className={[
                'brainstorm-room-view__row',
                'brainstorm-room-view__row--live',
                `brainstorm-room-view__row--${
                  speakerLane(
                    resolveBrainstormParticipantDisplay(
                      live.streaming.agentId,
                      agents,
                    ).agentId,
                    speakerOrder,
                  ) % 2 === 1 ? 'end' : 'start'
                }`,
              ].join(' ')}
              style={{
                '--brainstorm-speaker': paletteColorForSeed(
                  resolveBrainstormParticipantDisplay(
                    live.streaming.agentId,
                    agents,
                  ).agentId,
                ),
              } as React.CSSProperties}
            >
              <span className="brainstorm-room-view__speaker">
                {t('tabs.brainstormSpeakerLabel', {
                  name: streamingName,
                  round: live.streaming.round + 1,
                })}
              </span>
              <div className="brainstorm-room-view__bubble brainstorm-room-view__bubble--live">
                <AiMarkdown content={live.streaming.text} showCursor />
              </div>
            </article>
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

        {showComposer ? (
          <BrainstormHumanComposer
            placeholder={t('tabs.brainstormHumanPlaceholder')}
            sendLabel={t('tabs.brainstormHumanSend')}
            onSend={handleHumanSend}
          />
        ) : null}
      </div>
    </TerminalModal>
  )
}
