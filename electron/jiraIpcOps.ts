/**
 * Lógica de los tres canales IPC de Jira (`jira:status`, `jira:connect`,
 * `jira:search`), separada de `main.ts` para poder testearla sin
 * `ipcMain`/`BrowserWindow` — este repo no tiene ese harness. `main.ts` valida
 * el `unknown` que llega del renderer y delega aquí con tipos ya sanos.
 */

import { parseJiraConfig } from '../src/shared/jiraConfig'
import { buildJiraQuickJql } from '../src/shared/jiraQuickJql'
import type { JiraIssueRef } from '../src/shared/jiraIssue'
import { jiraMyself, jiraSearch } from './jiraClient'
import {
  readJiraConfig,
  readJiraCredentials,
  writeJiraConfig,
  writeJiraCredentials,
} from './jiraConfig'

export interface JiraStatus {
  configured: boolean
  site: string
  projectKeys: string[]
  connected: boolean
}

/** Estado «sin Jira»: sin `jira.json`, sin credenciales. Exportado para que
 * `main.ts` lo reutilice en la validación de borde en vez de duplicar el literal. */
export const DISCONNECTED: JiraStatus = { configured: false, site: '', projectKeys: [], connected: false }

export function jiraStatusFor(cwd: string): JiraStatus {
  const config = readJiraConfig(cwd)
  if (!config) return DISCONNECTED
  return {
    configured: true,
    site: config.site,
    projectKeys: config.projectKeys,
    connected: Boolean(readJiraCredentials(config.site)),
  }
}

export interface JiraConnectInput {
  site: string
  email: string
  apiToken: string
  projectKeys: string[]
}

export interface JiraConnectResult {
  ok: boolean
  displayName?: string
  error?: string
}

export async function connectJira(cwd: string, input: JiraConnectInput): Promise<JiraConnectResult> {
  const config = parseJiraConfig({ site: input.site, projectKeys: input.projectKeys })
  if (!config) return { ok: false, error: 'El sitio debe ser una URL https de Atlassian.' }

  const credentials = { site: config.site, email: input.email, apiToken: input.apiToken }
  const probe = await jiraMyself(credentials)
  if (!probe.ok) return probe

  // Solo se persiste lo que ya se probó: nada de credenciales muertas en disco.
  // Un fallo de escritura (EACCES, ENOSPC, checkout read-only) no puede tumbar
  // el handler: se reporta como `ok:false`, nunca como invoke rechazado.
  // Nota: si `writeJiraConfig` falla después de que `writeJiraCredentials` ya
  // escribió, la credencial queda huérfana en disco (no es atómico, y cambiar
  // el orden tampoco lo haría). Es inofensivo: `jiraStatusFor` solo reporta
  // `connected` cuando también existe `jira.json`, y un connect posterior que
  // sí complete sobrescribe la credencial igual.
  try {
    writeJiraCredentials(credentials)
    writeJiraConfig(cwd, config)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
  return probe
}

export async function searchJiraQuick(cwd: string, query: string): Promise<JiraIssueRef[]> {
  const config = readJiraConfig(cwd)
  if (!config) return []
  const credentials = readJiraCredentials(config.site)
  if (!credentials) return []
  const jql = buildJiraQuickJql(query, config)
  try {
    return await jiraSearch(credentials, jql, 8)
  } catch {
    return []
  }
}
