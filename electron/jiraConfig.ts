/**
 * Disco y credenciales de Jira.
 *
 * `.gravity/jira.json` es del proyecto y se commitea. El par email + API token
 * es del usuario y va cifrado con `safeStorage` en userData, indexado por sitio
 * — mismo patrón que `electron/covenantSession.ts`.
 */

import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { parseJiraConfig, type JiraProjectConfig } from '../src/shared/jiraConfig'
import { projectDirPath } from './projectDir'

export interface JiraCredentials {
  site: string
  email: string
  apiToken: string
}

const CONFIG_FILE = 'jira.json'
const STORE_FILE = 'jira-credentials.json'

function configPath(cwd: string): string {
  return projectDirPath(cwd, CONFIG_FILE)
}

export function readJiraConfig(cwd: string): JiraProjectConfig | null {
  const path = configPath(cwd)
  if (!existsSync(path)) return null
  try {
    return parseJiraConfig(JSON.parse(readFileSync(path, 'utf8')))
  } catch {
    // Un JSON roto no puede tumbar el turno: se comporta como «sin Jira».
    return null
  }
}

export function writeJiraConfig(cwd: string, config: JiraProjectConfig): void {
  const path = configPath(cwd)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
}

function storePath(): string {
  return join(app.getPath('userData'), STORE_FILE)
}

type StoredCredentials = Record<string, { email: string; apiToken: string }>

function readStore(): StoredCredentials {
  const path = storePath()
  if (!existsSync(path)) return {}
  try {
    const raw = readFileSync(path, 'utf8')
    const payload = JSON.parse(raw) as { encrypted?: string; plain?: StoredCredentials }
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
function writeStore(store: StoredCredentials, options: { allowPlain?: boolean } = {}): void {
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(JSON.stringify(store)).toString('base64')
    writeFileSync(storePath(), JSON.stringify({ encrypted }), 'utf8')
    return
  }
  if (!options.allowPlain) {
    throw new Error(
      'El almacén seguro del sistema no está disponible: no se puede guardar el token de Jira sin cifrarlo.',
    )
  }
  writeFileSync(storePath(), JSON.stringify({ plain: store }), 'utf8')
}

export function readJiraCredentials(site: string): JiraCredentials | null {
  const entry = readStore()[site]
  if (!entry?.email || !entry.apiToken) return null
  return { site, email: entry.email, apiToken: entry.apiToken }
}

export function writeJiraCredentials(credentials: JiraCredentials): void {
  const store = readStore()
  store[credentials.site] = { email: credentials.email, apiToken: credentials.apiToken }
  writeStore(store)
}

/** Olvida la credencial de un sitio. Las de los demás sitios se conservan. */
export function deleteJiraCredentials(site: string): void {
  const store = readStore()
  if (!(site in store)) return
  delete store[site]
  writeStore(store, { allowPlain: true })
}
