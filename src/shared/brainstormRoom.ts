/** Sala de brainstorm multi-agente secuencial (round-robin). */

export type BrainstormStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'done'

export interface BrainstormMessage {
  agentId: string
  agentName: string
  round: number
  text: string
}

export interface BrainstormRoom {
  id: string
  topic: string
  /** Orden de habla (dedupe al crear). */
  participantAgentIds: string[]
  maxRounds: number
  status: BrainstormStatus
  round: number
  cursor: number
  messages: BrainstormMessage[]
}

/** Eventos main → renderer (canal brainstorm:event). */
export type BrainstormEvent =
  | { type: 'speaker_delta'; agentId: string; round: number; text: string }
  | { type: 'speaker_final'; agentId: string; agentName: string; round: number; text: string }
  | { type: 'round'; round: number }
  | { type: 'status'; status: BrainstormStatus }
  | { type: 'error'; agentId?: string; message: string }

export const BRAINSTORM_MAX_ROUNDS_CAP = 10
export const BRAINSTORM_DEFAULT_ROUNDS = 3

export function sanitizeBrainstormMaxRounds(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return BRAINSTORM_DEFAULT_ROUNDS
  const n = Math.floor(raw)
  if (n < 1) return 1
  if (n > BRAINSTORM_MAX_ROUNDS_CAP) return BRAINSTORM_MAX_ROUNDS_CAP
  return n
}

function newRoomId(): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return uuid
  return `brainstorm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Deduplica ids preservando el orden de primera aparición. */
export function dedupeAgentIdsPreservingOrder(ids: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of ids) {
    const id = typeof raw === 'string' ? raw.trim() : ''
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export function createBrainstormRoom(
  topic: string,
  participantAgentIds: string[],
  maxRounds?: number,
): BrainstormRoom | null {
  const trimmedTopic = typeof topic === 'string' ? topic.trim() : ''
  const participants = dedupeAgentIdsPreservingOrder(participantAgentIds)
  if (!trimmedTopic || participants.length < 2) return null
  return {
    id: newRoomId(),
    topic: trimmedTopic,
    participantAgentIds: participants,
    maxRounds: sanitizeBrainstormMaxRounds(maxRounds),
    status: 'idle',
    round: 0,
    cursor: 0,
    messages: [],
  }
}

export function nextSpeakerAgentId(room: Pick<BrainstormRoom, 'participantAgentIds' | 'cursor'>): string | null {
  const ids = room.participantAgentIds
  if (!ids.length) return null
  const index = ((room.cursor % ids.length) + ids.length) % ids.length
  return ids[index] ?? null
}

/** Completa cuando se han cerrado `maxRounds` rondas (`round >= maxRounds`). */
export function isBrainstormComplete(
  room: Pick<BrainstormRoom, 'round' | 'maxRounds'>,
): boolean {
  return room.round >= room.maxRounds
}

/**
 * Avanza el cursor tras un orador; si cierra la ronda, incrementa `round`.
 * No cambia `status` ni `messages`.
 */
export function advanceBrainstormCursor(room: BrainstormRoom): BrainstormRoom {
  const n = room.participantAgentIds.length
  if (n === 0) return room
  const nextCursor = (room.cursor + 1) % n
  const closedRound = nextCursor === 0
  return {
    ...room,
    cursor: nextCursor,
    round: closedRound ? room.round + 1 : room.round,
  }
}

export function buildBrainstormTurnPrompt(
  room: BrainstormRoom,
  speakerAgentId: string,
  speakerName: string,
  speakerRole?: string,
): string {
  const name = speakerName.trim() || speakerAgentId
  const roleLine = speakerRole?.trim()
    ? `Your role: ${speakerRole.trim()}.`
    : ''
  const transcript = room.messages.length
    ? room.messages
      .map(msg => `${msg.agentName} (round ${msg.round}): ${msg.text}`)
      .join('\n')
    : '(No prior messages yet.)'

  return [
    'Brainstorm room — reply fast and short.',
    `Topic: ${room.topic}`,
    `You speak now as ${name} (agentId: ${speakerAgentId}).`,
    ...(roleLine ? [roleLine] : []),
    `Round ${room.round + 1} of ${room.maxRounds}.`,
    '',
    'Transcript so far:',
    transcript,
    '',
    'Your turn (hard limits):',
    '- Reply in 2–4 short sentences (~80–120 words max). One idea only.',
    '- Plain language only: no headings, bullets, numbered lists, or code fences.',
    '- React to the latest points; stay on topic; no preamble or recap.',
    '- Do not delegate, call tools, ask for approval, or wait for the user.',
    '- Output only your spoken contribution — nothing else.',
  ].join('\n')
}
