/**
 * Llavero de PATs de GitHub.
 *
 * Las cuentas (id + label) viven en config.json. El token va cifrado con
 * `safeStorage` en userData/github-tokens.json, indexado por id — mismo
 * patrón que `electron/jiraConfig.ts`.
 */

import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const STORE_FILE = 'github-tokens.json'

function storePath(): string {
  return join(app.getPath('userData'), STORE_FILE)
}

type StoredTokens = Record<string, string>

function readStore(): StoredTokens {
  const path = storePath()
  if (!existsSync(path)) return {}
  try {
    const payload = JSON.parse(readFileSync(path, 'utf8')) as {
      encrypted?: string
      plain?: StoredTokens
    }
    if (payload.encrypted && safeStorage.isEncryptionAvailable()) {
      return JSON.parse(safeStorage.decryptString(Buffer.from(payload.encrypted, 'base64')))
    }
    return payload.plain ?? {}
  } catch {
    return {}
  }
}

function writeStore(store: StoredTokens): void {
  const path = storePath()
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(JSON.stringify(store)).toString('base64')
    writeFileSync(path, JSON.stringify({ encrypted }), 'utf8')
    return
  }
  writeFileSync(path, JSON.stringify({ plain: store }), 'utf8')
}

export function readAccountToken(id: string): string | null {
  const token = readStore()[id]
  if (typeof token !== 'string' || !token.trim()) return null
  return token
}

export function writeAccountToken(id: string, token: string): void {
  const store = readStore()
  store[id] = token
  writeStore(store)
}

export function deleteAccountToken(id: string): void {
  const store = readStore()
  if (!(id in store)) return
  delete store[id]
  writeStore(store)
}
