/**
 * Llavero de API tokens de Jira por accountId.
 *
 * Las cuentas (id + site + email) viven en config. El token va cifrado con
 * `safeStorage` en userData/jira-tokens.json, indexado por id — misma forma
 * en disco que `electron/githubAccountStore.ts`, política de cifrado de
 * `electron/jiraConfig.ts`.
 */

import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const STORE_FILE = 'jira-tokens.json'
const LEGACY_STORE_FILE = 'jira-credentials.json'

function storePath(): string {
  return join(app.getPath('userData'), STORE_FILE)
}

function legacyStorePath(): string {
  return join(app.getPath('userData'), LEGACY_STORE_FILE)
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

/**
 * Guardar un API token en claro es peor que no guardarlo: el usuario cree que
 * la app lo protegió (se lo pidió en un campo de contraseña, le dijo que lo
 * cifraba) y en disco queda un secreto de Jira legible por cualquier proceso.
 * Sin `safeStorage` se rechaza y el error sube hasta Ajustes.
 *
 * `allowPlain` existe solo para el borrado: si el almacén seguro no está
 * disponible, lo que hay en disco solo puede ser un `plain` escrito por una
 * versión anterior, y reescribirlo con una entrada MENOS no degrada nada —
 * negarse ahí dejaría la credencial que el usuario pidió olvidar.
 */
function writeStore(store: StoredTokens, options: { allowPlain?: boolean } = {}): void {
  const path = storePath()
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(JSON.stringify(store)).toString('base64')
    writeFileSync(path, JSON.stringify({ encrypted }), 'utf8')
    return
  }
  if (!options.allowPlain) {
    throw new Error(
      'El almacén seguro del sistema no está disponible: no se puede guardar el token de Jira sin cifrarlo.',
    )
  }
  writeFileSync(path, JSON.stringify({ plain: store }), 'utf8')
}

export function listJiraTokenIds(): string[] {
  const store = readStore()
  return Object.keys(store).filter((id) => {
    const token = store[id]
    return typeof token === 'string' && Boolean(token.trim())
  })
}

export function readJiraToken(id: string): string | null {
  const token = readStore()[id]
  if (typeof token !== 'string' || !token.trim()) return null
  return token
}

export function writeJiraToken(id: string, token: string): void {
  const store = readStore()
  store[id] = token
  writeStore(store)
}

export function deleteJiraToken(id: string): void {
  const store = readStore()
  if (!(id in store)) return
  delete store[id]
  writeStore(store, { allowPlain: true })
}

type LegacyStoredCredentials = Record<string, { email: string; apiToken: string }>

function readLegacyStore(): LegacyStoredCredentials {
  const path = legacyStorePath()
  if (!existsSync(path)) return {}
  try {
    const raw = readFileSync(path, 'utf8')
    const payload = JSON.parse(raw) as { encrypted?: string; plain?: LegacyStoredCredentials }
    if (payload.encrypted && safeStorage.isEncryptionAvailable()) {
      return JSON.parse(safeStorage.decryptString(Buffer.from(payload.encrypted, 'base64')))
    }
    return payload.plain ?? {}
  } catch {
    return {}
  }
}

/** Solo lectura del store viejo `jira-credentials.json`; la migración la cablea otra lane. */
export function readLegacyJiraCredentials(): Array<{ site: string; email: string; apiToken: string }> {
  const store = readLegacyStore()
  const result: Array<{ site: string; email: string; apiToken: string }> = []
  for (const [site, entry] of Object.entries(store)) {
    if (!entry?.email || !entry.apiToken) continue
    result.push({ site, email: entry.email, apiToken: entry.apiToken })
  }
  return result
}
