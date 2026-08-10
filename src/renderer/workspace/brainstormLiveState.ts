import type {
  BrainstormEvent,
  BrainstormMessage,
  BrainstormRoom,
  BrainstormStatus,
} from '@shared/brainstormRoom'
import {
  BRAINSTORM_HUMAN_AGENT_ID,
  BRAINSTORM_HUMAN_AGENT_NAME,
  isBrainstormHumanMessage,
} from '@shared/brainstormRoom'

/** Estado vivo de la sala en el renderer (acumula deltas → final). */
export interface BrainstormLiveState {
  messages: BrainstormMessage[]
  streaming: { agentId: string; round: number; text: string } | null
  /** Turno concedido (llega antes del primer delta); null cuando nadie habla. */
  speakingAgentId: string | null
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
    round: room?.round ?? 0,
    status: room?.status ?? 'running',
    lastError: null,
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
      return { ...state, speakingAgentId: event.agentId, round: event.round }
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
