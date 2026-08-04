import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'fs'
import { basename, join } from 'path'
import {
  BRAINSTORM_DIR,
  brainstormFileName,
  normalizeBrainstormSlug,
  parseBrainstormRoomDefinition,
  serializeBrainstormRoom,
} from '../src/shared/brainstormCatalog'
import type { BrainstormRoom } from '../src/shared/brainstormRoom'

function brainstormsDir(cwd: string): string {
  return join(cwd, '.iaterminal', BRAINSTORM_DIR)
}

function ensureBrainstormsDir(cwd: string): string {
  const dir = brainstormsDir(cwd)
  mkdirSync(dir, { recursive: true })
  return dir
}

function roomPath(cwd: string, id: string): string {
  return join(brainstormsDir(cwd), brainstormFileName(id))
}

export function listBrainstormRooms(cwd: string): BrainstormRoom[] {
  const root = typeof cwd === 'string' ? cwd.trim() : ''
  if (!root) return []
  const dir = brainstormsDir(root)
  if (!existsSync(dir)) return []
  let names: string[] = []
  try {
    names = readdirSync(dir).filter(name => name.endsWith('.json'))
  } catch {
    return []
  }
  const out: BrainstormRoom[] = []
  for (const name of names.sort()) {
    try {
      const raw = JSON.parse(readFileSync(join(dir, name), 'utf-8')) as unknown
      const hint = basename(name, '.json')
      const parsed = parseBrainstormRoomDefinition(raw, hint)
      if (parsed) out.push(parsed)
    } catch { /* skip corrupt */ }
  }
  return out
}

export function upsertBrainstormRoom(
  cwd: string,
  room: BrainstormRoom,
): { ok: true; room: BrainstormRoom } | { ok: false; error: string } {
  const root = typeof cwd === 'string' ? cwd.trim() : ''
  if (!root) return { ok: false, error: 'missing_cwd' }
  const parsed = parseBrainstormRoomDefinition(room, room.id)
  if (!parsed) return { ok: false, error: 'invalid_room' }
  // parse normaliza running→paused; al upsert mid-flight debemos conservar el status pedido.
  const toWrite: BrainstormRoom = {
    ...parsed,
    status: room.status,
  }
  try {
    ensureBrainstormsDir(root)
    const path = roomPath(root, toWrite.id)
    const tmp = `${path}.tmp`
    writeFileSync(tmp, serializeBrainstormRoom(toWrite), 'utf-8')
    renameSync(tmp, path)
    return { ok: true, room: toWrite }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'write_failed',
    }
  }
}

export function deleteBrainstormRoom(
  cwd: string,
  roomId: string,
): { ok: true } | { ok: false; error: string } {
  const root = typeof cwd === 'string' ? cwd.trim() : ''
  const id = normalizeBrainstormSlug(roomId)
  if (!root || !id) return { ok: false, error: 'missing_args' }
  try {
    const path = roomPath(root, id)
    if (existsSync(path)) unlinkSync(path)
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'delete_failed',
    }
  }
}

/**
 * Borra salas `done`/`stopped` cuyo archivo es más viejo que `maxAgeDays`.
 * Nunca toca `running` / `paused` / `idle` (ni corruptos).
 */
export function pruneBrainstormRooms(
  cwd: string,
  maxAgeDays = 30,
): { ok: true; removed: number } | { ok: false; error: string } {
  const root = typeof cwd === 'string' ? cwd.trim() : ''
  if (!root) return { ok: false, error: 'missing_cwd' }
  const days = typeof maxAgeDays === 'number' && Number.isFinite(maxAgeDays) && maxAgeDays > 0
    ? maxAgeDays
    : 30
  const dir = brainstormsDir(root)
  if (!existsSync(dir)) return { ok: true, removed: 0 }

  let names: string[] = []
  try {
    names = readdirSync(dir).filter(name => name.endsWith('.json'))
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'read_failed',
    }
  }

  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000
  let removed = 0
  for (const name of names) {
    const path = join(dir, name)
    try {
      const raw = JSON.parse(readFileSync(path, 'utf-8')) as unknown
      const parsed = parseBrainstormRoomDefinition(raw, basename(name, '.json'))
      if (!parsed) continue
      if (parsed.status !== 'done' && parsed.status !== 'stopped') continue
      const mtimeMs = statSync(path).mtimeMs
      if (mtimeMs >= cutoffMs) continue
      unlinkSync(path)
      removed += 1
    } catch { /* skip corrupt / race */ }
  }
  return { ok: true, removed }
}

function buildBrainstormMarkdown(room: BrainstormRoom): string {
  const lines: string[] = [`# ${room.topic}`, '']
  for (const message of room.messages) {
    lines.push(`### ${message.agentName} (ronda ${message.round + 1})`)
    lines.push(message.text)
    lines.push('')
  }
  return `${lines.join('\n').trimEnd()}\n`
}

/** Escribe `<slug>.md` junto al JSON de la sala (escritura atómica). */
export function exportBrainstormRoomMarkdown(
  cwd: string,
  roomId: string,
): { ok: true; path: string } | { ok: false; error: string } {
  const root = typeof cwd === 'string' ? cwd.trim() : ''
  const id = normalizeBrainstormSlug(roomId)
  if (!root || !id) return { ok: false, error: 'missing_args' }
  const room = listBrainstormRooms(root).find(item => item.id === id)
  if (!room) return { ok: false, error: 'not_found' }
  try {
    ensureBrainstormsDir(root)
    const path = join(brainstormsDir(root), `${id}.md`)
    const tmp = `${path}.tmp`
    writeFileSync(tmp, buildBrainstormMarkdown(room), 'utf-8')
    renameSync(tmp, path)
    return { ok: true, path }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'write_failed',
    }
  }
}
