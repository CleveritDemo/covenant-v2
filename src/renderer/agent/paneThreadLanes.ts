import type { AgentChatEntry } from '@shared/agentCliTypes'

export interface LaneState {
  threadId: string
  delegationId: string
  assistantId: string
  messages: AgentChatEntry[]
  busy: boolean
  activity: string
}

export interface StartLaneInput {
  threadId: string
  delegationId: string
  assistantId: string
  messages: AgentChatEntry[]
}

/**
 * Clave estable del conjunto de carriles vivos.
 *
 * Existe para que la suscripción a eventos CLI dependa de *qué* carriles corren
 * y no de `lanesVersion`, que sube con cada delta: con esa versión en las deps,
 * el effect se rehacía —desuscribir y volver a suscribir todos los carriles—
 * una vez por token de la respuesta.
 */
export function busyLaneKey(lanes: Map<string, LaneState>): string {
  const ids: string[] = []
  for (const [threadId, lane] of lanes) {
    if (lane.busy) ids.push(threadId)
  }
  return ids.sort().join(',')
}

export function getLane(
  lanes: Map<string, LaneState>,
  threadId: string,
): LaneState | undefined {
  return lanes.get(threadId)
}

export function startLane(
  lanes: Map<string, LaneState>,
  input: StartLaneInput,
): Map<string, LaneState> {
  if (lanes.has(input.threadId)) return lanes
  const next = new Map(lanes)
  next.set(input.threadId, {
    threadId: input.threadId,
    delegationId: input.delegationId,
    assistantId: input.assistantId,
    messages: input.messages,
    busy: true,
    activity: '',
  })
  return next
}

export function appendLaneText(
  lanes: Map<string, LaneState>,
  threadId: string,
  text: string,
): Map<string, LaneState> {
  if (!text) return lanes
  const lane = lanes.get(threadId)
  if (!lane) return lanes
  let changed = false
  const messages = lane.messages.map(message => {
    if (message.id !== lane.assistantId) return message
    changed = true
    return { ...message, content: message.content + text }
  })
  if (!changed) return lanes
  const next = new Map(lanes)
  next.set(threadId, { ...lane, messages })
  return next
}

export function setLaneActivity(
  lanes: Map<string, LaneState>,
  threadId: string,
  activity: string,
): Map<string, LaneState> {
  const lane = lanes.get(threadId)
  if (!lane || lane.activity === activity) return lanes
  const next = new Map(lanes)
  next.set(threadId, { ...lane, activity })
  return next
}

export function endLane(
  lanes: Map<string, LaneState>,
  threadId: string,
): Map<string, LaneState> {
  if (!lanes.has(threadId)) return lanes
  const next = new Map(lanes)
  next.delete(threadId)
  return next
}
