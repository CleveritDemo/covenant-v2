/**
 * Sesiones Covenant keyed por accountId, cifradas con safeStorage en
 * userData/covenant-sessions.enc. El archivo viejo covenant-session.enc
 * se migra una vez y no se borra (rollback).
 */

import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'

export interface CovenantSessionData {
  jwt: string
  login: string
  avatarUrl: string
  githubId: string | number
  githubToken: string
}

function sessionsFilePath(): string {
  return join(app.getPath('userData'), 'covenant-sessions.enc')
}

function legacySessionFilePath(): string {
  return join(app.getPath('userData'), 'covenant-session.enc')
}

function encodePayload(json: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(json).toString('base64')
  }
  return Buffer.from(json, 'utf-8').toString('base64')
}

function decodePayload(payload: string): string {
  const buf = Buffer.from(payload, 'base64')
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.decryptString(buf)
  }
  return buf.toString('utf-8')
}

function parseSessionData(raw: unknown): CovenantSessionData | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const data = raw as Partial<CovenantSessionData>
  if (!data.jwt || !data.githubToken) return null
  return {
    jwt: data.jwt,
    login: data.login ?? '',
    avatarUrl: data.avatarUrl ?? '',
    githubId: data.githubId ?? '',
    githubToken: data.githubToken,
  }
}

function parseSessionRecord(raw: unknown): Record<string, CovenantSessionData> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, CovenantSessionData> = {}
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const parsed = parseSessionData(value)
    if (parsed) out[id] = parsed
  }
  return out
}

function readSessionsFile(): Record<string, CovenantSessionData> | null {
  try {
    const p = sessionsFilePath()
    if (!existsSync(p)) return null
    const payload = readFileSync(p, 'utf-8').trim()
    return parseSessionRecord(JSON.parse(decodePayload(payload)))
  } catch {
    return {}
  }
}

function writeSessionsFile(store: Record<string, CovenantSessionData>): void {
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(sessionsFilePath(), encodePayload(JSON.stringify(store)), 'utf-8')
}

function loadLegacySession(): CovenantSessionData | null {
  try {
    const p = legacySessionFilePath()
    if (!existsSync(p)) return null
    const payload = readFileSync(p, 'utf-8').trim()
    return parseSessionData(JSON.parse(decodePayload(payload)))
  } catch {
    return null
  }
}

/** Guarda la sesión de una cuenta. No toca el archivo legacy. */
export function persistCovenantSession(accountId: string, data: CovenantSessionData): void {
  try {
    const store = readSessionsFile() ?? {}
    store[accountId] = data
    writeSessionsFile(store)
  } catch {
    /* fallo silencioso: sin persistencia, se requiere re-login */
  }
}

/** Borra solo esa cuenta del store keyed. */
export function clearCovenantSession(accountId: string): void {
  try {
    const store = readSessionsFile()
    if (!store || !(accountId in store)) return
    delete store[accountId]
    if (Object.keys(store).length === 0) {
      const p = sessionsFilePath()
      if (existsSync(p)) rmSync(p)
      return
    }
    writeSessionsFile(store)
  } catch {
    /* ignorar */
  }
}

/** Borra el store keyed. No toca covenant-session.enc. */
export function clearAllCovenantSessions(): void {
  try {
    const p = sessionsFilePath()
    if (existsSync(p)) rmSync(p)
  } catch {
    /* ignorar */
  }
}

/**
 * Lee el store keyed. Si no existe y hay legacy, lo copia bajo `legacyAccountId`
 * al archivo nuevo y deja el original.
 */
export function loadCovenantSessions(legacyAccountId?: string): Record<string, CovenantSessionData> {
  const existing = readSessionsFile()
  if (existing) return existing
  if (!legacyAccountId) return {}
  const legacy = loadLegacySession()
  if (!legacy) return {}
  persistCovenantSession(legacyAccountId, legacy)
  return { [legacyAccountId]: legacy }
}
