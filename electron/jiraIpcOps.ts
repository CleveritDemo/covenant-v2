/**
 * Lógica de los tres canales IPC de Jira (`jira:status`, `jira:connect`,
 * `jira:search`), separada de `main.ts` para poder testearla sin
 * `ipcMain`/`BrowserWindow` — este repo no tiene ese harness. `main.ts` valida
 * el `unknown` que llega del renderer y delega aquí con tipos ya sanos.
 */

import { isJiraProjectKey, parseJiraConfig } from '../src/shared/jiraConfig'
import { buildJiraQuickJql } from '../src/shared/jiraQuickJql'
import { normalizeIssueKey, parsePartialIssueKey, type JiraIssueRef } from '../src/shared/jiraIssue'
import { issueAutoMarkdown } from '../src/shared/jiraIssueDoc'
import { jiraGetIssue, jiraMyself, jiraSearch } from './jiraClient'
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

export interface JiraIssuePreview {
  ok: boolean
  /** Markdown idéntico al que acabará en el `.md`; vacío si `ok` es false. */
  content?: string
  error?: string
}

/**
 * Vista previa de una issue ANTES de crear el contexto.
 *
 * Se compone con `issueAutoMarkdown`, el mismo escritor que usa el refrescador,
 * para que lo que se ve en el formulario sea exactamente lo que recibirá el
 * agente — no una aproximación. No escribe nada en disco: el `.md` lo crea el
 * guardado, y el snapshot real lo rellena el refrescador antes del turno.
 */
export async function previewJiraIssue(cwd: string, issueKey: string): Promise<JiraIssuePreview> {
  const key = normalizeIssueKey(issueKey)
  if (!key) return { ok: false, error: 'Clave de issue no válida.' }
  if (!hasProject(cwd)) return { ok: false, error: 'No hay proyecto abierto.' }
  const config = readJiraConfig(cwd)
  if (!config) return { ok: false, error: 'Este proyecto todavía no tiene Jira configurado.' }
  const credentials = readJiraCredentials(config.site)
  if (!credentials) return { ok: false, error: 'Sin credenciales de Jira para este sitio.' }
  try {
    const issue = await jiraGetIssue(credentials, key, config.maxComments)
    return { ok: true, content: issueAutoMarkdown(issue, config.maxComments) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export interface JiraSearchResult {
  issues: JiraIssueRef[]
  /**
   * Por qué no hay resultados, cuando el motivo no es «no hay coincidencias».
   * Antes esto se tragaba y se devolvía `[]`: un JQL inválido (una clave de
   * proyecto mal puesta, por ejemplo) era indistinguible de una búsqueda sin
   * resultados, y el usuario se quedaba mirando una lista vacía sin saber que
   * su configuración estaba rota.
   */
  error?: string
}

export async function searchJiraQuick(cwd: string, query: string): Promise<JiraSearchResult> {
  if (!hasProject(cwd)) return { issues: [] }
  const config = readJiraConfig(cwd)
  if (!config) return { issues: [], error: 'Este proyecto todavía no tiene Jira configurado.' }
  const credentials = readJiraCredentials(config.site)
  if (!credentials) return { issues: [], error: 'Sin credenciales de Jira para este sitio.' }
  const jql = buildJiraQuickJql(query, config)
  const partial = parsePartialIssueKey(query)
  try {
    // Con un prefijo de clave se piden más y se filtra por clave aquí: JQL no
    // sabe casar `CT-12*`, así que el recorte lo hace el cliente sobre las
    // issues recientes del proyecto.
    const issues = await jiraSearch(credentials, jql, partial ? 50 : 8)
    if (!partial) return { issues }
    const prefix = `${partial.project}-${partial.digits}`
    return { issues: issues.filter(issue => issue.key.startsWith(prefix)).slice(0, 8) }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    const badKeys = config.projectKeys.filter(key => !isJiraProjectKey(key))
    // Un 400 con claves de proyecto mal formadas casi siempre es eso, y el
    // mensaje crudo de Jira no lo dice de forma accionable.
    return {
      issues: [],
      error: badKeys.length
        ? `${detail}. Revisa las claves de proyecto en Ajustes: ${badKeys.join(', ')} no tiene forma de clave de Jira.`
        : detail,
    }
  }
}
