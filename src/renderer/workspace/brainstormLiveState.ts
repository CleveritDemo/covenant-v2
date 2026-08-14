import type {
  BrainstormEvent,
  BrainstormMessage,
  BrainstormRoom,
  BrainstormSpeakerPhase,
  BrainstormStatus,
} from '@shared/brainstormRoom'
import {
  BRAINSTORM_HUMAN_AGENT_ID,
  BRAINSTORM_HUMAN_AGENT_NAME,
  brainstormTurnCount,
  brainstormTurnsDone,
  isBrainstormHumanMessage,
} from '@shared/brainstormRoom'

/** Resumen que la sala publica al plano: indicador de agentes + flyout minimizado. */
export interface BrainstormLiveSummary {
  roomId: string
  topic: string
  status: BrainstormStatus
  /** Ronda 1-based ya lista para mostrar. */
  round: number
  maxRounds: number
  turnsDone: number
  totalTurns: number
  speakingAgentId: string | null
  speakerName: string
  participantAgentIds: string[]
}

/** Estado vivo de la sala en el renderer (acumula deltas → final). */
export interface BrainstormLiveState {
  messages: BrainstormMessage[]
  streaming: { agentId: string; round: number; text: string } | null
  /** Turno concedido (llega antes del primer delta); null cuando nadie habla. */
  speakingAgentId: string | null
  /** En qué va el turno mientras no hay texto; ver `BrainstormSpeakerPhase`. */
  speakerPhase: BrainstormSpeakerPhase
  round: number
  status: BrainstormStatus
  lastError: string | null
}

export function createInitialBrainstormLiveState(
  room?: Pick<BrainstormRoom, 'messages' | 'round' | 'status'>,
): BrainstormLiveState {
  return {
    messages: room?.messages ? [...room.messages] : [],
    streaming: null,
    speakingAgentId: null,
    speakerPhase: 'starting',
    round: room?.round ?? 0,
    status: room?.status ?? 'running',
    lastError: null,
  }
}

/**
 * Summary desde la sala cuando aún no hay live publicado (p. ej. minimizada
 * antes del primer onLive): el botón/dock no quedan mudos.
 */
export function createBrainstormLiveSummary(room: BrainstormRoom): BrainstormLiveSummary {
  const maxRounds = room.maxRounds
  const round = room.status === 'done'
    ? maxRounds
    : Math.min(Math.max(room.round, 0) + 1, maxRounds)
  return {
    roomId: room.id,
    topic: room.topic,
    status: room.status,
    round: Math.max(1, round),
    maxRounds,
    turnsDone: brainstormTurnsDone(room.messages),
    totalTurns: brainstormTurnCount(room),
    speakingAgentId: null,
    speakerName: '',
    participantAgentIds: [...room.participantAgentIds],
  }
}

function hasHumanMessage(
  messages: readonly BrainstormMessage[],
  text: string,
  round: number,
): boolean {
  return messages.some(message => (
    isBrainstormHumanMessage(message)
    && message.text === text
    && message.round === round
  ))
}

/** Aplica un evento de brainstorm al estado de la vista. */
export function reduceBrainstormLiveEvent(
  state: BrainstormLiveState,
  event: BrainstormEvent,
): BrainstormLiveState {
  switch (event.type) {
    case 'speaker_start':
      return {
        ...state,
        speakingAgentId: event.agentId,
        speakerPhase: 'starting',
        round: event.round,
      }
    // Solo del turno en curso: un evento tardío de otro agente no puede
    // adelantar la fase del que está hablando ahora.
    case 'speaker_phase':
      return state.speakingAgentId === event.agentId
        ? { ...state, speakerPhase: event.phase }
        : state
    case 'speaker_delta': {
      const prev = state.streaming
      const same =
        prev
        && prev.agentId === event.agentId
        && prev.round === event.round
      return {
        ...state,
        speakingAgentId: event.agentId,
        streaming: {
          agentId: event.agentId,
          round: event.round,
          text: same ? `${prev.text}${event.text}` : event.text,
        },
        speakerPhase: 'writing',
      }
    }
    case 'speaker_final': {
      const message: BrainstormMessage = {
        agentId: event.agentId,
        agentName: event.agentName,
        round: event.round,
        text: event.text,
      }
      return {
        ...state,
        messages: [...state.messages, message],
        streaming: null,
        speakingAgentId: null,
        speakerPhase: 'starting',
      }
    }
    case 'human_message': {
      if (hasHumanMessage(state.messages, event.text, event.round)) {
        return state
      }
      const message: BrainstormMessage = {
        agentId: BRAINSTORM_HUMAN_AGENT_ID,
        agentName: BRAINSTORM_HUMAN_AGENT_NAME,
        round: event.round,
        text: event.text,
        role: 'human',
        ...(event.targetAgentId ? { targetAgentId: event.targetAgentId } : {}),
      }
      return {
        ...state,
        messages: [...state.messages, message],
      }
    }
    case 'round':
      return { ...state, round: event.round }
    case 'status': {
      const running = event.status === 'running'
      return {
        ...state,
        status: event.status,
        streaming: event.status === 'paused' ? null : state.streaming,
        speakingAgentId: running ? state.speakingAgentId : null,
      }
    }
    case 'error':
      return {
        ...state,
        lastError: event.message,
      }
    default:
      return state
  }
}
