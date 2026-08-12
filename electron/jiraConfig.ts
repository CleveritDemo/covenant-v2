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

function writeStore(store: StoredCredentials): void {
  const json = JSON.stringify(store)
  const payload = safeStorage.isEncryptionAvailable()
    ? { encrypted: safeStorage.encryptString(json).toString('base64') }
    : { plain: store }
  writeFileSync(storePath(), JSON.stringify(payload), 'utf8')
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
