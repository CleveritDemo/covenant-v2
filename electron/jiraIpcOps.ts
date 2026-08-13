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
import { ensureJiraGitignore, type JiraGitignoreOutcome } from './jiraGitignore'
import { clearJiraRefreshFailures } from './jiraContextRefresh'
import {
  deleteJiraCredentials,
  readJiraConfig,
  readJiraCredentials,
  writeJiraConfig,
  writeJiraCredentials,
} from './jiraConfig'

export interface JiraStatus {
  configured: boolean
  site: string
  /**
   * La cuenta con la que se conectó. No es secreto (el secreto es el token) y
   * sin devolverlo Ajustes no puede repintar el formulario: el usuario ve el
   * campo vacío, vuelve a pulsar Conectar, manda email vacío y se come un 401
   * encima de una conexión que funcionaba.
   */
  email: string
  projectKeys: string[]
  connected: boolean
}

/** Estado «sin Jira»: sin `jira.json`, sin credenciales. Exportado para que
 * `main.ts` lo reutilice en la validación de borde en vez de duplicar el literal. */
export const DISCONNECTED: JiraStatus = {
  configured: false,
  site: '',
  email: '',
  projectKeys: [],
  connected: false,
}

/**
 * Sin proyecto abierto no hay `jira.json` que leer ni que escribir.
 *
 * `projectDirPath` resuelve un cwd vacío con `resolve('')` → `process.cwd()`,
 * que en dev es el repo de Gravity y empaquetado desde Finder es `/`. Una
 * pestaña de terminal sin `projectFolder` da exactamente esa cadena vacía, así
 * que el corte va aquí, en el único punto por el que pasan los tres canales.
 */
function hasProject(cwd: string): boolean {
  return Boolean((cwd ?? '').trim())
}

export function jiraStatusFor(cwd: string): JiraStatus {
  if (!hasProject(cwd)) return DISCONNECTED
  const config = readJiraConfig(cwd)
  if (!config) return DISCONNECTED
  const credentials = readJiraCredentials(config.site)
  return {
    configured: true,
    site: config.site,
    email: credentials?.email ?? '',
    projectKeys: config.projectKeys,
    connected: Boolean(credentials),
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
  /** Qué pasó con el `.gitignore` del proyecto; Ajustes lo cuenta al usuario. */
  gitignore?: JiraGitignoreOutcome
}

export async function connectJira(cwd: string, input: JiraConnectInput): Promise<JiraConnectResult> {
  // Ajustes ya deshabilita el botón sin proyecto, pero el canal no puede
  // confiar en eso: `resolve('')` escribiría `jira.json` en el cwd del proceso
  // (el repo de Gravity en dev, `/` empaquetado desde Finder).
  if (!hasProject(cwd)) {
    return { ok: false, error: 'Abre un proyecto antes de conectar Jira: `jira.json` vive en el proyecto.' }
  }

  const config = parseJiraConfig({ site: input.site, projectKeys: input.projectKeys })
  if (!config) return { ok: false, error: 'El sitio debe ser una URL https de Atlassian.' }

  const credentials = { site: config.site, email: input.email, apiToken: input.apiToken }
  const probe = await jiraMyself(credentials)
  if (!probe.ok) return probe

  // `defaultJql`, `refreshSeconds` y `maxComments` no tienen UI: la única forma
  // de fijarlos es editar `jira.json` a mano, y ese archivo se commitea. Sin
  // este merge, una rotación de token meses después sobrescribiría con los
  // valores por defecto el JQL y el intervalo que el equipo dejó afinados —
  // en un archivo versionado, y sin decir nada. Solo cambia lo que el
  // formulario realmente pidió cambiar.
  const existing = readJiraConfig(cwd)
  const merged = existing
    ? { ...existing, site: config.site, projectKeys: config.projectKeys }
    : config

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
    writeJiraConfig(cwd, merged)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
  // Reconectar es la señal de que lo que hacía fallar los refrescos (token
  // expirado, credenciales equivocadas) puede haber desaparecido. Sin esto, un
  // connect exitoso no arregla nada visible durante hasta cinco minutos: cada
  // issue adjunta sigue con su castigo anotado y los chips siguen vencidos.
  clearJiraRefreshFailures()
  // Después de persistir, nunca antes: el `.gitignore` protege snapshots que
  // solo existirán si la conexión llegó hasta aquí.
  return { ...probe, gitignore: ensureJiraGitignore(cwd) }
}

/**
 * Olvidar las credenciales del sitio configurado en este proyecto.
 *
 * Borra solo la credencial (userData, del usuario); `jira.json` se queda,
 * porque es del proyecto y está commiteado: desconectarse en la máquina de uno
 * no puede cambiarle la configuración al equipo. El resultado es
 * `configured:true, connected:false`, que es exactamente el estado de quien
 * clona el repo y todavía no puso su token.
 */
export function disconnectJira(cwd: string): { ok: boolean; error?: string } {
  if (!hasProject(cwd)) return { ok: false, error: 'No hay proyecto abierto.' }
  const config = readJiraConfig(cwd)
  if (!config) return { ok: true }
  try {
    deleteJiraCredentials(config.site)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function searchJiraQuick(cwd: string, query: string): Promise<JiraIssueRef[]> {
  if (!hasProject(cwd)) return []
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
