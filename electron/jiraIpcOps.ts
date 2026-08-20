/**
 * Lógica de los tres canales IPC de Jira (`jira:status`, `jira:connect`,
 * `jira:search`), separada de `main.ts` para poder testearla sin
 * `ipcMain`/`BrowserWindow` — este repo no tiene ese harness. `main.ts` valida
 * el `unknown` que llega del renderer y delega aquí con tipos ya sanos.
 */

import type { AppConfig } from '../src/shared/configSchema'
import { type JiraAccount, sanitizeJiraAccountLabel } from '../src/shared/jiraAccounts'
import { isJiraProjectKey, parseJiraConfig } from '../src/shared/jiraConfig'
import { buildJiraQuickJql } from '../src/shared/jiraQuickJql'
import { normalizeIssueKey, parsePartialIssueKey, type JiraIssueRef } from '../src/shared/jiraIssue'
import { issueAutoMarkdown } from '../src/shared/jiraIssueDoc'
import { jiraCreateIssue, jiraGetIssue, jiraIssueTypes, jiraMyself, jiraSearch } from './jiraClient'
import { ensureJiraGitignore, type JiraGitignoreOutcome } from './jiraGitignore'
import { clearJiraRefreshFailures } from './jiraContextRefresh'
import {
  deleteJiraToken,
  readLegacyJiraCredentials,
  readJiraToken,
  writeJiraToken,
} from './jiraAccountStore'
import {
  deleteJiraCredentials,
  readJiraConfig,
  readJiraCredentials,
  writeJiraConfig,
} from './jiraConfig'
import { resolveJiraWorkspaceAccountId, writeJiraWorkspaceAccountId } from './jiraWorkspaceAccount'

type ConfigAccess = {
  read: () => AppConfig
  write: (cfg: AppConfig) => void
}

let configAccess: ConfigAccess | null = null

/** Cableado desde `main.ts` al arrancar IPC; los tests inyectan su propio acceso. */
export function bindJiraConfigAccess(access: ConfigAccess): void {
  configAccess = access
}

function requireConfigAccess(): ConfigAccess {
  if (!configAccess) throw new Error('Jira config access not bound')
  return configAccess
}

function labelFromSite(site: string): string {
  try {
    return new URL(site).host
  } catch {
    return site.replace(/^https:\/\//i, '').replace(/\/$/, '')
  }
}

function pickJiraAccountId(cwd: string, config: AppConfig): string | null {
  const accounts = config.jiraAccounts
  if (!accounts.length) return null
  const knownIds = accounts.map(account => account.id)
  const fromBinding = resolveJiraWorkspaceAccountId(cwd, knownIds)
  if (fromBinding) return fromBinding
  const defaultId = config.jiraDefaultAccountId.trim()
  if (defaultId && accounts.some(account => account.id === defaultId)) return defaultId
  if (accounts.length === 1) return accounts[0]!.id
  return null
}

export function resolveJiraAccount(
  cwd: string,
): { accountId: string; label: string; site: string; email: string; apiToken: string } | null {
  if (!hasProject(cwd)) return null
  const config = requireConfigAccess().read()
  if (!config.jiraAccounts.length) {
    const jiraConfig = readJiraConfig(cwd)
    if (!jiraConfig) return null
    const credentials = readJiraCredentials(jiraConfig.site)
    if (!credentials) return null
    return {
      accountId: '',
      label: '',
      site: credentials.site,
      email: credentials.email,
      apiToken: credentials.apiToken,
    }
  }
  const accountId = pickJiraAccountId(cwd, config)
  if (!accountId) return null
  const account = config.jiraAccounts.find(entry => entry.id === accountId)
  if (!account) return null
  const apiToken = readJiraToken(accountId)
  if (!apiToken) return null
  return {
    accountId: account.id,
    label: account.label,
    site: account.site,
    email: account.email,
    apiToken,
  }
}

/** Migra `jira-credentials.json` al llavero una sola vez; no borra el archivo viejo. */
export function seedJiraAccountsFromLegacyCredentials(
  config: AppConfig,
  persist?: (cfg: AppConfig) => void,
): AppConfig {
  if (config.jiraAccounts.length > 0) return config
  const legacy = readLegacyJiraCredentials()
  if (!legacy.length) return config
  const accounts: JiraAccount[] = []
  let defaultAccountId = ''
  for (const entry of legacy) {
    const id = crypto.randomUUID()
    accounts.push({
      id,
      label: labelFromSite(entry.site),
      site: entry.site,
      email: entry.email,
    })
    try {
      writeJiraToken(id, entry.apiToken)
    } catch {
      return config
    }
    if (!defaultAccountId) defaultAccountId = id
  }
  const next: AppConfig = { ...config, jiraAccounts: accounts, jiraDefaultAccountId: defaultAccountId }
  if (persist) {
    try {
      persist(next)
    } catch {
      /* la sesión sigue con las cuentas aunque no se persistan */
    }
  }
  return next
}

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
  accountId: string
  accountLabel: string
  projectKeys: string[]
  connected: boolean
}

/** Estado «sin Jira»: sin `jira.json`, sin credenciales. Exportado para que
 * `main.ts` lo reutilice en la validación de borde en vez de duplicar el literal. */
export const DISCONNECTED: JiraStatus = {
  configured: false,
  site: '',
  email: '',
  accountId: '',
  accountLabel: '',
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
  const account = resolveJiraAccount(cwd)
  return {
    configured: true,
    site: account?.site ?? config.site,
    email: account?.email ?? '',
    accountId: account?.accountId ?? '',
    accountLabel: account?.label ?? '',
    projectKeys: config.projectKeys,
    connected: Boolean(account),
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

  const appConfig = requireConfigAccess().read()
  const matched = appConfig.jiraAccounts.find(
    account => account.site === config.site && account.email === input.email.trim(),
  )
  const accountId = matched?.id ?? crypto.randomUUID()
  const account: JiraAccount = {
    id: accountId,
    label: matched?.label ?? labelFromSite(config.site),
    site: config.site,
    email: input.email.trim(),
  }
  const accounts = [...appConfig.jiraAccounts]
  const idx = accounts.findIndex(entry => entry.id === accountId)
  if (idx >= 0) accounts[idx] = account
  else accounts.push(account)
  const jiraDefaultAccountId = appConfig.jiraDefaultAccountId || accountId

  try {
    writeJiraToken(accountId, input.apiToken)
    writeJiraWorkspaceAccountId(cwd, accountId)
    writeJiraConfig(cwd, merged)
    requireConfigAccess().write({ ...appConfig, jiraAccounts: accounts, jiraDefaultAccountId })
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
  const account = resolveJiraAccount(cwd)
  try {
    if (account?.accountId) {
      deleteJiraToken(account.accountId)
    } else {
      deleteJiraCredentials(config.site)
    }
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
  const account = resolveJiraAccount(cwd)
  if (!account) return { ok: false, error: 'Sin credenciales de Jira para este sitio.' }
  try {
    const issue = await jiraGetIssue(account, key, config.maxComments)
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

export interface JiraIssueTypesResult {
  ok: boolean
  issueTypes: Array<{ id: string; name: string; subtask: boolean }>
  error?: string
}

export async function listJiraIssueTypes(cwd: string, projectKey: string): Promise<JiraIssueTypesResult> {
  const key = projectKey.trim()
  if (!key) return { ok: false, error: 'Clave de proyecto vacía.', issueTypes: [] }
  if (!hasProject(cwd)) return { ok: false, error: 'No hay proyecto abierto.', issueTypes: [] }
  const config = readJiraConfig(cwd)
  if (!config) return { ok: false, error: 'Este proyecto todavía no tiene Jira configurado.', issueTypes: [] }
  const account = resolveJiraAccount(cwd)
  if (!account) return { ok: false, error: 'Sin credenciales de Jira para este sitio.', issueTypes: [] }
  try {
    const issueTypes = await jiraIssueTypes(account, key)
    return { ok: true, issueTypes }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error), issueTypes: [] }
  }
}

export type JiraCreateNodeInput = {
  tempId: string
  parentTempId?: string
  issueTypeName: string
  summary: string
  description?: string
}

export interface JiraCreateIssuesResult {
  ok: boolean
  error?: string
  results: Array<{ tempId: string; ok: boolean; key?: string; error?: string }>
}

const MAX_CREATE_NODES = 50

function resolveCredentials(
  cwd: string,
): { account: ReturnType<typeof resolveJiraAccount>; error?: string } {
  if (!hasProject(cwd)) return { account: null, error: 'No hay proyecto abierto.' }
  const config = readJiraConfig(cwd)
  if (!config) return { account: null, error: 'Este proyecto todavía no tiene Jira configurado.' }
  const account = resolveJiraAccount(cwd)
  if (!account) return { account: null, error: 'Sin credenciales de Jira para este sitio.' }
  return { account }
}

function collectDescendants(parentId: string, childrenByParent: Map<string, string[]>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const stack = [...(childrenByParent.get(parentId) ?? [])]
  while (stack.length) {
    const id = stack.pop()!
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
    stack.push(...(childrenByParent.get(id) ?? []))
  }
  return out
}

function findCycleNodes(nodes: JiraCreateNodeInput[]): Set<string> {
  const byId = new Map(nodes.map(node => [node.tempId, node]))
  const inCycle = new Set<string>()

  for (const start of nodes) {
    const chain: string[] = []
    const indexInChain = new Map<string, number>()
    let current: string | undefined = start.tempId

    while (current) {
      if (indexInChain.has(current)) {
        const from = indexInChain.get(current)!
        for (let i = from; i < chain.length; i++) inCycle.add(chain[i]!)
        break
      }
      if (!byId.has(current)) break
      indexInChain.set(current, chain.length)
      chain.push(current)
      current = byId.get(current)!.parentTempId
    }
  }

  return inCycle
}

function topologicalOrder(
  nodes: JiraCreateNodeInput[],
): { order: JiraCreateNodeInput[]; upfrontErrors: Map<string, string> } {
  const byId = new Map(nodes.map(node => [node.tempId, node]))
  const upfrontErrors = new Map<string, string>()

  for (const node of nodes) {
    if (node.parentTempId && !byId.has(node.parentTempId)) {
      upfrontErrors.set(node.tempId, 'parentTempId inexistente')
    }
  }

  for (const tempId of findCycleNodes(nodes)) {
    upfrontErrors.set(tempId, 'ciclo en parentTempId')
  }

  const order: JiraCreateNodeInput[] = []
  const placed = new Set<string>()

  function place(id: string): void {
    if (placed.has(id) || upfrontErrors.has(id)) return
    const node = byId.get(id)
    if (!node) return
    if (node.parentTempId && !upfrontErrors.has(node.parentTempId)) place(node.parentTempId)
    if (upfrontErrors.has(id) || placed.has(id)) return
    order.push(node)
    placed.add(id)
  }

  for (const node of nodes) place(node.tempId)
  return { order, upfrontErrors }
}

export async function createJiraIssues(
  cwd: string,
  input: { projectKey: string; nodes: JiraCreateNodeInput[] },
): Promise<JiraCreateIssuesResult> {
  const projectKey = input.projectKey.trim()
  if (!projectKey) return { ok: false, error: 'Clave de proyecto vacía.', results: [] }
  if (!input.nodes.length) return { ok: false, error: 'Sin nodos que crear.', results: [] }
  if (input.nodes.length > MAX_CREATE_NODES) {
    return { ok: false, error: `Máximo ${MAX_CREATE_NODES} issues por lote.`, results: [] }
  }

  const { account, error: credError } = resolveCredentials(cwd)
  if (!account) return { ok: false, error: credError, results: [] }

  let issueTypes: Array<{ id: string; name: string; subtask: boolean }>
  try {
    issueTypes = await jiraIssueTypes(account, projectKey)
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      results: [],
    }
  }

  const { order, upfrontErrors } = topologicalOrder(input.nodes)
  const results: JiraCreateIssuesResult['results'] = []
  const resultById = new Map<string, JiraCreateIssuesResult['results'][number]>()
  const failedIds = new Set<string>()
  const keysByTempId = new Map<string, string>()
  const childrenByParent = new Map<string, string[]>()

  for (const node of input.nodes) {
    if (node.parentTempId) {
      const siblings = childrenByParent.get(node.parentTempId) ?? []
      siblings.push(node.tempId)
      childrenByParent.set(node.parentTempId, siblings)
    }
  }

  for (const [tempId, message] of upfrontErrors) {
    failedIds.add(tempId)
    const row = { tempId, ok: false, error: message }
    results.push(row)
    resultById.set(tempId, row)
    for (const desc of collectDescendants(tempId, childrenByParent)) {
      if (upfrontErrors.has(desc)) continue
      failedIds.add(desc)
      const skip = { tempId: desc, ok: false, error: 'padre no creado' }
      results.push(skip)
      resultById.set(desc, skip)
    }
  }

  const resolveType = (name: string): { id: string } | { error: string } => {
    const match = issueTypes.find(type => type.name.toLowerCase() === name.toLowerCase())
    if (!match) {
      const available = issueTypes.map(type => type.name).join(', ')
      return { error: `Tipo "${name}" no existe. Disponibles: ${available}` }
    }
    return { id: match.id }
  }

  const markFailed = (tempId: string, error: string): void => {
    if (resultById.has(tempId)) return
    failedIds.add(tempId)
    const row = { tempId, ok: false, error }
    results.push(row)
    resultById.set(tempId, row)
    for (const desc of collectDescendants(tempId, childrenByParent)) {
      if (resultById.has(desc)) continue
      failedIds.add(desc)
      const skip = { tempId: desc, ok: false, error: 'padre no creado' }
      results.push(skip)
      resultById.set(desc, skip)
    }
  }

  let createdCount = 0

  for (const node of order) {
    if (resultById.has(node.tempId)) continue

    if (node.parentTempId) {
      const parentResult = resultById.get(node.parentTempId)
      if (!parentResult?.ok) {
        markFailed(node.tempId, 'padre no creado')
        continue
      }
    }

    const type = resolveType(node.issueTypeName)
    if ('error' in type) {
      markFailed(node.tempId, type.error)
      continue
    }

    const parentKey = node.parentTempId ? keysByTempId.get(node.parentTempId) : undefined
    if (node.parentTempId && !parentKey) {
      markFailed(node.tempId, 'padre no creado')
      continue
    }

    try {
      const created = await jiraCreateIssue(account, {
        projectKey,
        issueTypeId: type.id,
        summary: node.summary,
        description: node.description,
        parentKey,
      })
      keysByTempId.set(node.tempId, created.key)
      createdCount += 1
      const row = { tempId: node.tempId, ok: true, key: created.key }
      results.push(row)
      resultById.set(node.tempId, row)
    } catch (error) {
      markFailed(node.tempId, error instanceof Error ? error.message : String(error))
    }
  }

  return { ok: createdCount > 0, results }
}

export async function checkJiraAccount(
  accountId: string,
): Promise<{ ok: true; displayName: string; email: string } | { ok: false; error: string }> {
  const config = requireConfigAccess().read()
  const account = config.jiraAccounts.find(entry => entry.id === accountId)
  if (!account) {
    return { ok: false, error: 'Cuenta Jira desconocida.' }
  }
  const apiToken = readJiraToken(accountId)
  if (!apiToken) {
    return { ok: false, error: 'Falta la credencial de esta cuenta.' }
  }
  const probe = await jiraMyself({ site: account.site, email: account.email, apiToken })
  if (!probe.ok) {
    return { ok: false, error: probe.error ?? 'No se pudo verificar la cuenta.' }
  }
  return {
    ok: true,
    displayName: probe.displayName ?? '',
    email: (probe as { emailAddress?: string }).emailAddress ?? '',
  }
}

export async function searchJiraQuick(cwd: string, query: string): Promise<JiraSearchResult> {
  if (!hasProject(cwd)) return { issues: [] }
  const config = readJiraConfig(cwd)
  if (!config) return { issues: [], error: 'Este proyecto todavía no tiene Jira configurado.' }
  const account = resolveJiraAccount(cwd)
  if (!account) return { issues: [], error: 'Sin credenciales de Jira para este sitio.' }
  const jql = buildJiraQuickJql(query, config)
  const partial = parsePartialIssueKey(query)
  try {
    // Con un prefijo de clave se piden más y se filtra por clave aquí: JQL no
    // sabe casar `CT-12*`, así que el recorte lo hace el cliente sobre las
    // issues recientes del proyecto.
    const issues = await jiraSearch(account, jql, partial ? 50 : 8)
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
