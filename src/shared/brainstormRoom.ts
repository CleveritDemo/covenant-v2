/** Sala de brainstorm multi-agente secuencial (round-robin). */

export type BrainstormStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'done'

export interface BrainstormMessage {
  agentId: string
  agentName: string
  round: number
  text: string
}

/** Salida acordada de la sala; añade una línea al prompt y cierra el último turno. */
export const BRAINSTORM_OUTCOMES = ['ideas', 'decision', 'plan', 'critique'] as const
export type BrainstormOutcome = typeof BRAINSTORM_OUTCOMES[number]

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
  /** Working set: ids de contextos del proyecto (`.gravity/*.md`). Opcional = salas antiguas. */
  contextIds?: string[]
  /** Working set: rutas relativas de archivos del repo. */
  filePaths?: string[]
  outcome?: BrainstormOutcome
}

/** Working set ya materializado por main (el renderer solo manda ids/rutas). */
export interface BrainstormWorkingSet {
  /** Etiquetas legibles: `notes CT-89`, `file electron/tenancy.ts`. */
  labels: string[]
  /** Cuerpos leídos de disco; solo se mandan cuando `shouldSendWorkingSetBodies`. */
  fileBlocks?: string[]
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
export const BRAINSTORM_WORKING_SET_CAP = 20

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

/** Working set: strings limpios, sin duplicados y con tope. */
export function sanitizeBrainstormWorkingSet(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const strings = raw.filter((item): item is string => typeof item === 'string')
  return dedupeAgentIdsPreservingOrder(strings).slice(0, BRAINSTORM_WORKING_SET_CAP)
}

export function sanitizeBrainstormOutcome(raw: unknown): BrainstormOutcome | undefined {
  return (BRAINSTORM_OUTCOMES as readonly string[]).includes(raw as string)
    ? raw as BrainstormOutcome
    : undefined
}

export interface BrainstormRoomBrief {
  contextIds?: unknown
  filePaths?: unknown
  outcome?: unknown
}

export function createBrainstormRoom(
  topic: string,
  participantAgentIds: string[],
  maxRounds?: number,
  brief: BrainstormRoomBrief = {},
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
    contextIds: sanitizeBrainstormWorkingSet(brief.contextIds),
    filePaths: sanitizeBrainstormWorkingSet(brief.filePaths),
    outcome: sanitizeBrainstormOutcome(brief.outcome),
  }
}

/** Turnos totales de la tirada: participantes × rondas. */
export function brainstormTurnCount(
  room: Pick<BrainstormRoom, 'participantAgentIds' | 'maxRounds'>,
): number {
  return room.participantAgentIds.length * sanitizeBrainstormMaxRounds(room.maxRounds)
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

const OUTCOME_LINES: Record<BrainstormOutcome, string> = {
  ideas: 'Desired outcome: a spread of distinct options, not consensus.',
  decision: 'Desired outcome: one decision with its trade-off stated.',
  plan: 'Desired outcome: an ordered plan of concrete steps.',
  critique: 'Desired outcome: the risks and holes in the current approach.',
}

/**
 * Cuerpos del working set solo en la primera ronda: el transcript ya crece cada
 * turno y repetir los archivos rompe el límite de 2–4 frases.
 */
export function shouldSendWorkingSetBodies(
  room: Pick<BrainstormRoom, 'round'>,
): boolean {
  return room.round === 0
}

/** Último turno de la última ronda: toca cerrar con la salida acordada. */
export function isFinalBrainstormTurn(
  room: Pick<BrainstormRoom, 'round' | 'maxRounds' | 'cursor' | 'participantAgentIds'>,
): boolean {
  const participants = room.participantAgentIds.length
  if (!participants) return false
  return room.round === sanitizeBrainstormMaxRounds(room.maxRounds) - 1
    && room.cursor === participants - 1
}

function workingSetLines(workingSet?: BrainstormWorkingSet): string[] {
  const labels = workingSet?.labels?.filter(label => label.trim()) ?? []
  if (!labels.length) return []
  const blocks = workingSet?.fileBlocks?.filter(block => block.trim()) ?? []
  return [
    '',
    'Working set (re-read from disk this round):',
    ...labels.map(label => `- ${label}`),
    'Ask for a section by name if you need a body you do not have.',
    ...(blocks.length ? ['', 'Working set files:', ...blocks] : []),
  ]
}

export function buildBrainstormTurnPrompt(
  room: BrainstormRoom,
  speakerAgentId: string,
  speakerName: string,
  speakerRole?: string,
  workingSet?: BrainstormWorkingSet,
): string {
  const name = speakerName.trim() || speakerAgentId
  const roleLine = speakerRole?.trim()
    ? `Your role: ${speakerRole.trim()}.`
    : ''
  const outcomeLine = room.outcome ? OUTCOME_LINES[room.outcome] : ''
  const hasWorkingSet = Boolean(workingSet?.labels?.some(label => label.trim()))
  const transcript = room.messages.length
    ? room.messages
      .map(msg => `${msg.agentName} (round ${msg.round}): ${msg.text}`)
      .join('\n')
    : '(No prior messages yet.)'

  return [
    'Brainstorm room — reply fast and short.',
    `Objective: ${room.topic}`,
    ...(outcomeLine ? [outcomeLine] : []),
    `You speak now as ${name} (agentId: ${speakerAgentId}).`,
    ...(roleLine ? [roleLine] : []),
    `Round ${room.round + 1} of ${room.maxRounds}.`,
    ...workingSetLines(workingSet),
    '',
    'Transcript so far:',
    transcript,
    '',
    'Your turn (hard limits):',
    '- Reply in 2–4 short sentences (~80–120 words max). One idea only.',
    ...(hasWorkingSet
      ? ['- Ground claims in the working set; say "not in the working set" instead of guessing.']
      : []),
    ...(isFinalBrainstormTurn(room)
      ? ['- Final turn: close the room with the desired outcome, still in 2–4 sentences.']
      : []),
    '- Plain language only: no headings, bullets, numbered lists, or code fences.',
    '- React to the latest points; stay on topic; no preamble or recap.',
    '- Do not delegate, call tools, ask for approval, or wait for the user.',
    '- Output only your spoken contribution — nothing else.',
  ].join('\n')
}
