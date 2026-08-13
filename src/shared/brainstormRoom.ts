/** Sala de brainstorm multi-agente secuencial (round-robin). */

import type { ProjectAgentDefinition } from './projectAgentCatalog'
import { normalizeAgentSlug } from './projectAgentCatalog'
import {
  CEREMONY_ROLE_PROMPT_LABEL,
  ceremonyById,
  isCeremonyRoleId,
  ceremonyUsesFreeOutcome,
  sanitizeCeremonyId,
  type CeremonyId,
  type CeremonyRoleId,
} from './agileCeremonies'

export type BrainstormStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'done'

export interface BrainstormMessage {
  agentId: string
  agentName: string
  round: number
  text: string
  /** Usuario interrumpe; omitido o `agent` = orador del círculo. */
  role?: 'agent' | 'human'
  /** Solo mensajes humanos: dirigido a un agente en vez de a la sala. */
  targetAgentId?: string
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
  /** Ceremonia ágil de la sala. Ausente = `free`, el brainstorming de siempre. */
  ceremony?: CeremonyId
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
  | { type: 'speaker_start'; agentId: string; round: number }
  | { type: 'speaker_delta'; agentId: string; round: number; text: string }
  | { type: 'speaker_final'; agentId: string; agentName: string; round: number; text: string }
  | { type: 'human_message'; text: string; round: number; targetAgentId?: string }
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

/**
 * Cercas de protocolo que el modelo escribe a veces aunque el turno las prohíba.
 * En la sala nadie las parsea (los turnos van sin results ni delegación), así que
 * solo son ruido en el acta. `(?:```|$)` recorta también la cerca a medio llegar
 * durante el streaming.
 */
const BRAINSTORM_PROTOCOL_FENCE =
  /```ia-terminal-(?:results|changelog|delegate|context)[\s\S]*?(?:```|$)/g

export function stripBrainstormProtocolFences(text: string): string {
  if (typeof text !== 'string' || !text.includes('```ia-terminal-')) return text
  return text
    .replace(BRAINSTORM_PROTOCOL_FENCE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
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
  ceremony?: unknown
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
    ceremony: sanitizeCeremonyId(brief.ceremony),
  }
}

/** Bloques del cierre; todos opcionales salvo `decision`, que es el ancla. */
export interface BrainstormClosing {
  decision: string
  why?: string
  agreed?: string
  open?: string
  next?: string
}

/** Etiquetas que se le piden al último turno (inglés: el prompt es en inglés). */
const CLOSING_FIELDS: ReadonlyArray<[keyof BrainstormClosing, RegExp]> = [
  ['decision', /^(?:decision|outcome|cierre)\s*:\s*(.+)$/i],
  ['why', /^(?:why|because|por qué|porque)\s*:\s*(.+)$/i],
  ['agreed', /^(?:agreed|acuerdo|acordado)\s*:\s*(.+)$/i],
  ['open', /^(?:open|disagreement|sin acuerdo|abierto)\s*:\s*(.+)$/i],
  ['next', /^(?:next|next step|siguiente paso)\s*:\s*(.+)$/i],
]

/**
 * Escáner de líneas `Etiqueta: valor`. Un solo recorrido para el cierre
 * genérico y para el de cada ceremonia: cambia la lista de etiquetas, no el
 * parseo. Tolera viñetas y negritas de Markdown, que el modelo añade a veces.
 */
function parseLabeledLines<K extends string>(
  text: string,
  specs: ReadonlyArray<[K, RegExp]>,
): Partial<Record<K, string>> {
  const found: Partial<Record<K, string>> = {}
  if (typeof text !== 'string' || !text.trim()) return found
  for (const rawLine of text.split('\n')) {
    const line = rawLine
      .trim()
      .replace(/^[-*+]\s+/, '')
      .replace(/\*\*/g, '')
    if (!line) continue
    for (const [field, pattern] of specs) {
      if (found[field]) continue
      const match = pattern.exec(line)
      if (match?.[1]) {
        found[field] = match[1].trim()
        break
      }
    }
  }
  return found
}

/**
 * Lee el cierre del último turno. Sin línea `Decision:` no hay tarjeta —
 * el turno se pinta como una entrada normal y nadie inventa un acuerdo.
 */
export function parseBrainstormClosing(text: string): BrainstormClosing | null {
  const found = parseLabeledLines(text, CLOSING_FIELDS)
  if (!found.decision) return null
  return found as BrainstormClosing
}

function escapeForRegExp(raw: string): string {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Campos del cierre de una ceremonia, en el orden en que se le pidieron. */
export interface CeremonyClosingResult {
  ceremony: CeremonyId
  /** Solo los campos que el turno final escribió, en orden de catálogo. */
  entries: Array<{ key: string; label: string; value: string }>
  /** Valores por clave, para evaluar el gate. */
  fields: Record<string, string>
}

/**
 * Lee el cierre estructurado de una ceremonia. Sin ningún campo reconocible
 * devuelve null y la sala cae a la tarjeta genérica: nadie inventa entregables.
 */
export function parseCeremonyClosing(
  text: string,
  ceremonyId: unknown,
): CeremonyClosingResult | null {
  const ceremony = ceremonyById(ceremonyId)
  if (!ceremony.closing.length) return null
  const specs = ceremony.closing.map(field => [
    field.key,
    new RegExp(`^${escapeForRegExp(field.label)}\\s*:\\s*(.+)$`, 'i'),
  ] as [string, RegExp])
  const found = parseLabeledLines(text, specs)
  const entries = ceremony.closing
    .filter(field => found[field.key])
    .map(field => ({ key: field.key, label: field.label, value: found[field.key] as string }))
  if (!entries.length) return null
  return {
    ceremony: ceremony.id,
    entries,
    fields: Object.fromEntries(entries.map(entry => [entry.key, entry.value])),
  }
}

/** El cierre de una ceremonia en Markdown, con el mismo formato que el genérico. */
export function formatCeremonyClosing(
  topic: string,
  closing: CeremonyClosingResult,
): string {
  const ceremony = ceremonyById(closing.ceremony)
  const lines = [`# ${topic}`, '', `_${ceremony.name}_`]
  for (const entry of closing.entries) {
    lines.push('', `**${entry.label}:** ${entry.value}`)
  }
  return `${lines.join('\n')}\n`
}

/** El cierre en Markdown, para copiar / exportar / guardar como contexto. */
export function formatBrainstormClosing(
  topic: string,
  closing: BrainstormClosing,
): string {
  const lines = [`# ${topic}`, '', `**Decision:** ${closing.decision}`]
  if (closing.why) lines.push('', `**Why:** ${closing.why}`)
  if (closing.agreed) lines.push('', `**Agreed:** ${closing.agreed}`)
  if (closing.open) lines.push('', `**Open:** ${closing.open}`)
  if (closing.next) lines.push('', `**Next:** ${closing.next}`)
  return `${lines.join('\n')}\n`
}

export type BrainstormSeatState = 'speaking' | 'spoke' | 'waiting'

export interface BrainstormSeat {
  agentId: string
  state: BrainstormSeatState
}

/** Asientos en orden de habla con su estado en la ronda en curso. */
export function brainstormSeats(input: {
  participantAgentIds: readonly string[]
  messages: readonly BrainstormMessage[]
  round: number
  speakingAgentId?: string | null
}): BrainstormSeat[] {
  const spoke = new Set(
    input.messages
      .filter(message => !isBrainstormHumanMessage(message) && message.round === input.round)
      .map(message => message.agentId),
  )
  return dedupeAgentIdsPreservingOrder(input.participantAgentIds).map(agentId => ({
    agentId,
    state: agentId === input.speakingAgentId
      ? 'speaking'
      : spoke.has(agentId)
        ? 'spoke'
        : 'waiting',
  }))
}

/** Turnos de agente ya cerrados (las intervenciones humanas no cuentan). */
export function brainstormTurnsDone(messages: readonly BrainstormMessage[]): number {
  return messages.filter(message => !isBrainstormHumanMessage(message)).length
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
  targetAgentId?: string,
): BrainstormRoom | null {
  const trimmed = typeof text === 'string' ? text.trim() : ''
  if (!trimmed) return null
  const target = typeof targetAgentId === 'string' ? targetAgentId.trim() : ''
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
        ...(target && room.participantAgentIds.includes(target)
          ? { targetAgentId: target }
          : {}),
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
  /** Asientos que este agente ocupa en la ceremonia (`ceremonyRolesForAgent`). */
  speakerCeremonyRoles?: readonly CeremonyRoleId[],
): string {
  const name = speakerName.trim() || speakerAgentId
  const roleLine = speakerRole?.trim()
    ? `Your role: ${speakerRole.trim()}.`
    : ''
  /**
   * Dos o más asientos: hay que decírselo. La sala afirma que esos roles están
   * cubiertos, y si el agente no sabe que lleva los dos sombreros nadie habla
   * por el segundo y la cobertura sería mentira.
   */
  // Sin reordenar: llegan en orden de asiento de la ceremonia, que es el que
  // tiene sentido nombrar. `sanitizeCeremonyRoleIds` los pondría en orden de
  // catálogo global y se perdería esa lectura.
  const hats = (speakerCeremonyRoles ?? []).filter(isCeremonyRoleId)
  const hatsLines = hats.length > 1
    ? [
        `In this session you cover ${hats.length} roles: ${
          hats.map(role => CEREMONY_ROLE_PROMPT_LABEL[role]).join(' and ')
        }.`,
        'Speak for all of them and say which role each point comes from.',
      ]
    : []
  const ceremony = ceremonyById(room.ceremony)
  // La salida a mano solo manda en `free`; con ceremonia el entregable ya está fijado.
  const outcomeLine = ceremonyUsesFreeOutcome(room.ceremony) && room.outcome
    ? OUTCOME_LINES[room.outcome]
    : ''
  const ceremonyLines = ceremonyUsesFreeOutcome(room.ceremony)
    ? []
    : [
        `Ceremony: ${ceremony.name}. ${ceremony.objective}`,
        `Deliverables of this ceremony: ${ceremony.deliverables.join(' · ')}.`,
      ]
  const hasWorkingSet = Boolean(workingSet?.labels?.some(label => label.trim()))
  const addressedToSpeaker = room.messages.some(msg =>
    isBrainstormHumanMessage(msg) && msg.targetAgentId === speakerAgentId)
  const addressedToOthers = room.messages.some(msg =>
    isBrainstormHumanMessage(msg)
    && Boolean(msg.targetAgentId)
    && msg.targetAgentId !== speakerAgentId)
  const hasRoomHumanGuide = room.messages.some(msg =>
    isBrainstormHumanMessage(msg) && !msg.targetAgentId)
  const transcript = room.messages.length
    ? room.messages
      .map(msg => {
        if (isBrainstormHumanMessage(msg)) {
          const who = msg.agentName || 'You'
          if (!msg.targetAgentId) return `${who} (human, to the room): ${msg.text}`
          // Al no destinatario se le dice explícito: es contexto, no su instrucción.
          return msg.targetAgentId === speakerAgentId
            ? `${who} (human, to you): ${msg.text}`
            : `${who} (human, to ${msg.targetAgentId} — not to you): ${msg.text}`
        }
        return `${msg.agentName} (round ${msg.round}): ${msg.text}`
      })
      .join('\n')
    : '(No prior messages yet.)'

  return [
    ceremonyUsesFreeOutcome(room.ceremony)
      ? 'Brainstorm room — one speaking turn.'
      : `${ceremony.name} session — one speaking turn.`,
    `Objective: ${room.topic}`,
    ...ceremonyLines,
    ...(outcomeLine ? [outcomeLine] : []),
    `You speak now as ${name} (agentId: ${speakerAgentId}).`,
    ...(roleLine ? [roleLine] : []),
    ...hatsLines,
    `Round ${room.round + 1} of ${room.maxRounds}.`,
    ...workingSetLines(workingSet),
    '',
    'Transcript so far:',
    transcript,
    '',
    'Your turn:',
    '- As long as it needs to be, no longer. Plain language.',
    ...(hasWorkingSet
      ? ['- Ground claims in the working set; say "not in the working set" instead of guessing.']
      : []),
    ...(hasRoomHumanGuide
      ? [
          '- Human notes to the room are standing guidance for this and following turns; prioritize the latest relevant human guidance before reacting to other agents.',
        ]
      : []),
    ...(addressedToSpeaker
      ? ['- The user addressed you directly in the transcript: answer that first.']
      : []),
    ...(addressedToOthers
      ? ['- A note marked "not to you" is context about another agent, never an instruction you follow.']
      : []),
    ...(isFinalBrainstormTurn(room)
      ? ceremony.closing.length
        ? [
            `- Final turn: close the ${ceremony.name}. Instead of prose, write these labeled`,
            '  lines, one per label, in this order (write every label, even to say "none"):',
            ...ceremony.closing.map(field => `  ${field.label}: <${field.hint}>`),
          ]
        : [
            '- Final turn: close the room. Instead of prose, write these labeled lines',
            '  (one line each, ≤20 words each, skip a label if there is nothing real):',
            '  Decision: <the call, or the leading option if there was no agreement>',
            '  Why: <the reason that settled it>',
            '  Agreed: <what everyone accepted>',
            '  Open: <what stayed unresolved, and who objects>',
            '  Next: <the next concrete step, with an owner if there is one>',
          ]
      : []),
    '- React to the latest points; stay on topic; no preamble or recap.',
    '- Use your tools (MCP included) when the turn needs real data instead of a guess.',
    '- Do not delegate, ask for approval, or wait for the user.',
    '- Output only your spoken contribution — nothing else.',
  ].join('\n')
}
