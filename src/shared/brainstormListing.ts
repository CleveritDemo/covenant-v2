/**
 * Decisiones del listado de salas de brainstorm: acción primaria por estado,
 * agrupado por antigüedad, filtro y el contexto `notes` que produce "al contexto".
 * Puro: la UI solo pinta lo que estas funciones deciden.
 */

import type { BrainstormRoom, BrainstormStatus } from './brainstormRoom'
import { normalizeBrainstormSlug } from './brainstormCatalog'
import type { TabContext } from './tabContext'

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
 * Contexto `notes` equivalente a la sala. El id lleva el prefijo que ya usa el
 * host para notes, así el discover de `.gravity` lo reconoce sin caso especial.
 */
export function brainstormRoomContext(room: Pick<BrainstormRoom, 'id' | 'topic'>): TabContext {
  const stem = `brainstorm-${normalizeBrainstormSlug(room.id)}`
  return {
    id: `iaterminal:notes:${stem}`,
    name: room.topic,
    fileName: `${stem}.md`,
    kind: 'notes',
    icon: 'brain',
    // De la paleta de contextos; fuera de ella el host lo descarta al normalizar.
    color: '#c084fc',
  }
}
