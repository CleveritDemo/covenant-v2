import {
  dedupeAgentIdsPreservingOrder,
  sanitizeBrainstormMaxRounds,
  sanitizeBrainstormOutcome,
  sanitizeBrainstormWorkingSet,
  type BrainstormMessage,
  type BrainstormRoom,
  type BrainstormStatus,
} from './brainstormRoom'

export const BRAINSTORM_DIR = 'brainstorms'

/** Slug de archivo/id a partir de valor o fallback. */
export function normalizeBrainstormSlug(
  value: string | null | undefined,
  fallback = 'brainstorm',
): string {
  const stem = (value ?? '')
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .toLowerCase()
    .slice(0, 64)
  return stem || fallback
}

export function brainstormFileName(id: string): string {
  return `${normalizeBrainstormSlug(id)}.json`
}

export function serializeBrainstormRoom(room: BrainstormRoom): string {
  return `${JSON.stringify(room, null, 2)}\n`
}

function sanitizeNonNegativeInt(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0
  return Math.max(0, Math.floor(raw))
}

function sanitizeMessages(raw: unknown): BrainstormMessage[] {
  if (!Array.isArray(raw)) return []
  const out: BrainstormMessage[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const data = item as Record<string, unknown>
    const agentId = typeof data.agentId === 'string' ? data.agentId.trim() : ''
    if (!agentId) continue
    const agentNameRaw = typeof data.agentName === 'string' ? data.agentName.trim() : ''
    const text = typeof data.text === 'string' ? data.text : ''
    const role: BrainstormMessage['role'] | undefined =
      data.role === 'human' || data.role === 'agent'
        ? data.role
        : agentId === 'human'
          ? 'human'
          : undefined
    out.push({
      agentId,
      agentName: agentNameRaw || agentId,
      round: sanitizeNonNegativeInt(data.round),
      text,
      ...(role ? { role } : {}),
    })
  }
  return out
}

/** En carga, `running` nunca se restaura: pasa a `paused`. */
function sanitizeStatusOnLoad(raw: unknown): BrainstormStatus {
  if (raw === 'running') return 'paused'
  if (
    raw === 'idle'
    || raw === 'paused'
    || raw === 'stopped'
    || raw === 'done'
  ) {
    return raw
  }
  return 'idle'
}

/** Parsea y normaliza un JSON de sala; null si inválido. */
export function parseBrainstormRoomDefinition(
  raw: unknown,
  hint?: string,
): BrainstormRoom | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  const idRaw = typeof data.id === 'string' && data.id.trim()
    ? data.id
    : hint
  if (!idRaw) return null
  const id = normalizeBrainstormSlug(idRaw)
  if (!id) return null

  const topic = typeof data.topic === 'string' ? data.topic.trim() : ''
  const participants = dedupeAgentIdsPreservingOrder(
    Array.isArray(data.participantAgentIds)
      ? data.participantAgentIds.filter((item): item is string => typeof item === 'string')
      : [],
  )
  if (!topic || participants.length < 2) return null

  return {
    id,
    topic,
    participantAgentIds: participants,
    maxRounds: sanitizeBrainstormMaxRounds(data.maxRounds),
    status: sanitizeStatusOnLoad(data.status),
    round: sanitizeNonNegativeInt(data.round),
    cursor: sanitizeNonNegativeInt(data.cursor),
    messages: sanitizeMessages(data.messages),
    contextIds: sanitizeBrainstormWorkingSet(data.contextIds),
    filePaths: sanitizeBrainstormWorkingSet(data.filePaths),
    outcome: sanitizeBrainstormOutcome(data.outcome),
  }
}
