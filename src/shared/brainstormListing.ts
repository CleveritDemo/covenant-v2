/**
 * Decisiones del listado de salas de brainstorm: acción primaria por estado,
 * agrupado por antigüedad, filtro y el contexto `notes` que produce "al contexto".
 * Puro: la UI solo pinta lo que estas funciones deciden.
 */

import type { BrainstormRoom, BrainstormStatus } from './brainstormRoom'
import { normalizeBrainstormSlug } from './brainstormCatalog'
import type { TabContext } from './tabContext'
import { CONTEXT_SUBDIR, normalizeContextFileName } from './tabContext'

/** Sala + mtime de su `.json`. `updatedAt` solo lo rellena el listado. */
export type BrainstormRoomListing = BrainstormRoom & { updatedAt?: number }

/** Qué ofrece el botón primario de la fila. */
export type BrainstormPrimaryAction = 'live' | 'resume' | 'open'

export function brainstormPrimaryAction(status: BrainstormStatus): BrainstormPrimaryAction {
  if (status === 'running') return 'live'
  // `idle` es una sala creada que nunca arrancó: también se reanuda.
  if (status === 'paused' || status === 'idle') return 'resume'
  return 'open'
}

/** Familia visual del estado: define franja y chip. */
export type BrainstormTone = 'run' | 'done' | 'idle'

export function brainstormTone(status: BrainstormStatus): BrainstormTone {
  if (status === 'running') return 'run'
  if (status === 'done') return 'done'
  return 'idle'
}

/**
 * Rondas consumidas para el medidor. Mientras corre, la ronda en curso cuenta
 * como empezada; el tope nunca pasa de `maxRounds`.
 */
export function brainstormRoundsDone(room: BrainstormRoom): number {
  const started = room.round + (room.status === 'running' ? 1 : 0)
  return Math.max(0, Math.min(started, room.maxRounds))
}

export type BrainstormGroupKey = 'live' | 'recent' | 'older'

export interface BrainstormGroup {
  key: BrainstormGroupKey
  rooms: BrainstormRoomListing[]
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Agrupa en curso / última semana / antes, cada grupo de más nuevo a más viejo.
 * Sin `updatedAt` la sala cae en "recent": es lo que hace un proyecto que aún no
 * tiene mtime en el listado, y enterrarla en "antes" sería mentir.
 */
export function groupBrainstormRooms(
  rooms: readonly BrainstormRoomListing[],
  now: number,
): BrainstormGroup[] {
  const live: BrainstormRoomListing[] = []
  const recent: BrainstormRoomListing[] = []
  const older: BrainstormRoomListing[] = []

  for (const room of rooms) {
    if (room.status === 'running') {
      live.push(room)
      continue
    }
    const at = room.updatedAt
    if (typeof at === 'number' && Number.isFinite(at) && now - at > WEEK_MS) older.push(room)
    else recent.push(room)
  }

  const byNewest = (a: BrainstormRoomListing, b: BrainstormRoomListing): number =>
    (b.updatedAt ?? 0) - (a.updatedAt ?? 0)

  return ([
    { key: 'live' as const, rooms: live.sort(byNewest) },
    { key: 'recent' as const, rooms: recent.sort(byNewest) },
    { key: 'older' as const, rooms: older.sort(byNewest) },
  ]).filter(group => group.rooms.length > 0)
}

/** Antigüedad relativa; `null` = ya no es relativa, pinta la fecha. */
export type BrainstormAge =
  | { unit: 'now' }
  | { unit: 'minutes' | 'hours' | 'days'; count: number }
  | null

export function brainstormAge(updatedAt: number | undefined, now: number): BrainstormAge {
  if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt)) return null
  const elapsed = now - updatedAt
  if (elapsed < 60_000) return { unit: 'now' }
  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 60) return { unit: 'minutes', count: minutes }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return { unit: 'hours', count: hours }
  const days = Math.floor(hours / 24)
  if (days <= 7) return { unit: 'days', count: days }
  return null
}

/** Filtra por asunto o por id de participante; vacío = todo. */
export function filterBrainstormRooms(
  rooms: readonly BrainstormRoomListing[],
  query: string,
): BrainstormRoomListing[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return [...rooms]
  return rooms.filter(room =>
    room.topic.toLowerCase().includes(needle)
    || room.participantAgentIds.some(id => id.toLowerCase().includes(needle)))
}

/** Nombre de archivo del contexto que produce una sala. */
export function brainstormContextFileName(room: BrainstormRoom): string {
  return `brainstorm-${normalizeBrainstormSlug(room.id)}.md`
}

/**
 * Nombre corto sugerido al guardar una sala como contexto: primer trozo antes
 * de `.`/`?`/`!`/salto si ya es largo, recorte a 48 en límite de palabra.
 */
export function brainstormContextNameSuggestion(topic: string): string {
  let text = topic.trim()
  const delim = /[.?!]|[\r\n]/g
  let match: RegExpExecArray | null
  while ((match = delim.exec(text)) !== null) {
    if (match.index >= 12) {
      text = text.slice(0, match.index)
      break
    }
  }
  if (text.length > 48) {
    const head = text.slice(0, 48)
    const space = head.lastIndexOf(' ')
    text = (space > 0 ? head.slice(0, space) : head).trimEnd()
  }
  text = text.replace(/[\s\-.?!,:;]+$/u, '').trim()
  return text || 'Brainstorm'
}

export type BrainstormRoomContextOverrides = {
  name?: string
  icon?: string
  color?: string
}

/**
 * Contexto `notes` equivalente a la sala. El id lleva el prefijo que ya usa el
 * host para notes, así el discover de `.gravity` lo reconoce sin caso especial.
 * Sin `overrides.name` el id/fileName siguen el id de la sala (compat).
 */
export function brainstormRoomContext(
  room: Pick<BrainstormRoom, 'id' | 'topic'>,
  overrides?: BrainstormRoomContextOverrides,
): TabContext {
  const nameOverride = overrides?.name?.trim()
  if (nameOverride) {
    const stem = normalizeContextFileName(nameOverride, 'context').replace(/\.md$/i, '')
    return {
      id: `iaterminal:notes:${stem}`,
      name: nameOverride,
      fileName: `${CONTEXT_SUBDIR}/${stem}.md`,
      kind: 'notes',
      icon: overrides?.icon ?? 'messages',
      color: overrides?.color ?? '#c084fc',
    }
  }
  const stem = `brainstorm-${normalizeBrainstormSlug(room.id)}`
  return {
    id: `iaterminal:notes:${stem}`,
    name: room.topic,
    fileName: `${CONTEXT_SUBDIR}/${stem}.md`,
    kind: 'notes',
    icon: overrides?.icon ?? 'messages',
    // De la paleta de contextos; fuera de ella el host lo descarta al normalizar.
    color: overrides?.color ?? '#c084fc',
  }
}

/**
 * Primera frase útil de un turno, para el riel de la sala. Quita fences,
 * cabeceras, viñetas y backticks; nunca lanza.
 */
export function brainstormTurnSnippet(text: string, max = 90): string {
  if (!text) return ''
  let snippet = text.replace(/```[\s\S]*?```/g, ' ')
  snippet = snippet.replace(/^#{1,6}\s+/gm, '')
  snippet = snippet.replace(/^\s*[-*+]\s+/gm, '')
  snippet = snippet.replace(/`/g, '')
  snippet = snippet.replace(/\s+/g, ' ').trim()
  if (!snippet) return ''
  const stop = snippet.search(/[.?!]/)
  if (stop >= 0) snippet = snippet.slice(0, stop + 1)
  if (snippet.length > max) return `${snippet.slice(0, max)}…`
  return snippet
}
