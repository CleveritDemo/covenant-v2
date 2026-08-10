/** Sala de brainstorm multi-agente secuencial (round-robin). */

import type { ProjectAgentDefinition } from './projectAgentCatalog'
import { normalizeAgentSlug } from './projectAgentCatalog'

export type BrainstormStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'done'

export interface BrainstormMessage {
  agentId: string
  agentName: string
  round: number
  text: string
  /** Usuario interrumpe; omitido o `agent` = orador del círculo. */
  role?: 'agent' | 'human'
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
  | { type: 'human_message'; text: string; round: number }
  | { type: 'round'; round: number }
  | { type: 'status'; status: BrainstormStatus }
  | { type: 'error'; agentId?: string; message: string }

export const BRAINSTORM_MAX_ROUNDS_CAP = 10
export const BRAINSTORM_DEFAULT_ROUNDS = 3
export const BRAINSTORM_WORKING_SET_CAP = 20

/** Id fijo en transcript para voz humana (no es participante round-robin). */
export const BRAINSTORM_HUMAN_AGENT_ID = 'human'
export const BRAINSTORM_HUMAN_AGENT_NAME = 'Human'

export function isBrainstormHumanMessage(
  message: Pick<BrainstormMessage, 'role' | 'agentId'>,
): boolean {
  return message.role === 'human' || message.agentId === BRAINSTORM_HUMAN_AGENT_ID
}

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

/**
 * Réplica temporal de experto: `localOnly` en ProjectAgentDefinition
 * (equivalente a expertReplica en sync org).
 */
export function isExpertReplicaAgent(
  agent: Pick<ProjectAgentDefinition, 'localOnly'>,
): boolean {
  return agent.localOnly === true
}

/** Agente permanente del catálogo; invitables a Brainstorm. */
export function isBrainstormInvitableAgent(
  agent: Pick<ProjectAgentDefinition, 'localOnly'>,
): boolean {
  return !isExpertReplicaAgent(agent)
}

/** Catálogo visible/seleccionable en el modal de invite. */
export function filterBrainstormInvitableAgents<
  T extends Pick<ProjectAgentDefinition, 'localOnly'>,
>(agents: readonly T[]): T[] {
  return agents.filter(isBrainstormInvitableAgent)
}

export type BrainstormCatalogAgent = Pick<
  ProjectAgentDefinition,
  'id' | 'name' | 'role' | 'localOnly'
>

/** Agente permanente del catálogo por id exacto (nunca réplica). */
export function findBrainstormCatalogAgent(
  agentId: string,
  agents: readonly BrainstormCatalogAgent[],
): BrainstormCatalogAgent | null {
  const id = agentId.trim()
  if (!id) return null
  const found = agents.find(agent => agent.id === id && isBrainstormInvitableAgent(agent))
  return found ?? null
}

/**
 * Label de catálogo: name trim → id. Solo para agentes invitables conocidos.
 */
export function brainstormCatalogAgentLabel(
  agent: Pick<BrainstormCatalogAgent, 'id' | 'name'>,
): string {
  const name = agent.name?.trim()
  return name || agent.id
}

/**
 * Remapeo inequívoco de un id huérfano → agente real del catálogo.
 * Exacto primero; si no, un único match por slug de id / name / role.
 * Nunca mapea a réplicas (`localOnly`).
 */
export function remapBrainstormParticipantId(
  agentId: string,
  agents: readonly BrainstormCatalogAgent[],
): string | null {
  const raw = agentId.trim()
  if (!raw) return null
  const exact = findBrainstormCatalogAgent(raw, agents)
  if (exact) return exact.id

  const invitable = filterBrainstormInvitableAgents(agents)
  if (!invitable.length) return null

  const needle = normalizeAgentSlug(raw, '')
  if (!needle) return null

  const matches = invitable.filter(agent => {
    const idSlug = normalizeAgentSlug(agent.id, '')
    if (idSlug && idSlug === needle) return true
    const nameSlug = normalizeAgentSlug(agent.name ?? '', '')
    if (nameSlug && nameSlug === needle) return true
    const roleSlug = normalizeAgentSlug(agent.role ?? '', '')
    if (roleSlug && roleSlug === needle) return true
    return false
  })
  if (matches.length !== 1) return null
  return matches[0]?.id ?? null
}

export type BrainstormParticipantDisplay = {
  /** Id efectivo (remapeado si hubo match inequívoco). */
  agentId: string
  /** Texto listo para UI (nombre de catálogo o id huérfano). */
  label: string
  /** Está en el catálogo invitable (tras remap). */
  known: boolean
}

/**
 * Resuelve cómo mostrar un participante: catálogo → remap inequívoco → huérfano.
 * `storedName` (p. ej. message.agentName) solo se usa si el agente es conocido
 * y el catálogo no trae name, o como pista de remap por slug de nombre.
 */
export function resolveBrainstormParticipantDisplay(
  agentId: string,
  agents: readonly BrainstormCatalogAgent[],
  storedName?: string,
): BrainstormParticipantDisplay {
  const raw = agentId.trim()
  const catalog = findBrainstormCatalogAgent(raw, agents)
  if (catalog) {
    return {
      agentId: catalog.id,
      label: brainstormCatalogAgentLabel(catalog),
      known: true,
    }
  }

  const remappedId = remapBrainstormParticipantId(raw, agents)
    ?? (storedName?.trim()
      ? remapBrainstormParticipantId(storedName.trim(), agents)
      : null)
  if (remappedId) {
    const agent = findBrainstormCatalogAgent(remappedId, agents)
    if (agent) {
      return {
        agentId: agent.id,
        label: brainstormCatalogAgentLabel(agent),
        known: true,
      }
    }
  }

  return {
    agentId: raw,
    label: raw,
    known: false,
  }
}

/**
 * Reescribe participantAgentIds con remap inequívoco; reporta huérfanos.
 */
export function resolveBrainstormParticipantIds(
  participantAgentIds: readonly string[],
  agents: readonly BrainstormCatalogAgent[],
): { resolvedIds: string[]; orphanIds: string[] } {
  const resolvedIds: string[] = []
  const orphanIds: string[] = []
  const seen = new Set<string>()
  for (const raw of dedupeAgentIdsPreservingOrder(participantAgentIds)) {
    const display = resolveBrainstormParticipantDisplay(raw, agents)
    if (!display.known) {
      if (!orphanIds.includes(raw)) orphanIds.push(raw)
      continue
    }
    if (seen.has(display.agentId)) continue
    seen.add(display.agentId)
    resolvedIds.push(display.agentId)
  }
  return { resolvedIds, orphanIds }
}

/**
 * Solo ids de agentes invitables del catálogo (sin réplicas ni huérfanos).
 * Aplica remap inequívoco antes de filtrar.
 */
export function sanitizeBrainstormInviteIds(
  participantAgentIds: readonly string[],
  agents: readonly BrainstormCatalogAgent[],
): string[] {
  return resolveBrainstormParticipantIds(participantAgentIds, agents).resolvedIds
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

/**
 * Añade una intervención humana al transcript (no avanza cursor).
 * Usa `room.round` actual como etiqueta de ronda.
 */
export function appendBrainstormHumanMessage(
  room: BrainstormRoom,
  text: string,
): BrainstormRoom | null {
  const trimmed = typeof text === 'string' ? text.trim() : ''
  if (!trimmed) return null
  return {
    ...room,
    messages: [
      ...room.messages,
      {
        agentId: BRAINSTORM_HUMAN_AGENT_ID,
        agentName: BRAINSTORM_HUMAN_AGENT_NAME,
        round: room.round,
        text: trimmed,
        role: 'human',
      },
    ],
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
      .map(msg => {
        const who = msg.role === 'human' || msg.agentId === 'human'
          ? `${msg.agentName || 'You'} (human)`
          : `${msg.agentName} (round ${msg.round})`
        return `${who}: ${msg.text}`
      })
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
    'Your turn (soft target — never truncate or retry if over):',
    '- Aim for ≤50 words. One idea only. Plain language.',
    '- No headings, bullets, numbered lists, or code fences.',
    ...(hasWorkingSet
      ? ['- Ground claims in the working set; say "not in the working set" instead of guessing.']
      : []),
    ...(isFinalBrainstormTurn(room)
      ? ['- Final turn: close the room with the desired outcome, same length limit.']
      : []),
    '- React to the latest points; stay on topic; no preamble or recap.',
    '- Do not delegate, call tools, ask for approval, or wait for the user.',
    '- Output only your spoken contribution — nothing else.',
  ].join('\n')
}
