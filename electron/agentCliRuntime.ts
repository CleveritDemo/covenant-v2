import crossSpawn from 'cross-spawn'
import type { ChildProcessWithoutNullStreams } from 'child_process'
import { mkdirSync, mkdtempSync, statSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { basename, extname, join, resolve } from 'path'
import type { BrowserWindow } from 'electron'
import type { AppConfig } from '../src/shared/configSchema'
import type {
  AgentCliImageAttachment,
  AgentCliStartRequest,
  AgentCliUiEvent,
  ContextDeliveryMetrics,
} from '../src/shared/agentCliTypes'
import { IPC } from '../src/shared/ipcChannels'
import {
  filterTabContextUpdatesByChangedPaths,
  extractTabContextUpdates,
  type TabContext,
} from '../src/shared/tabContext'
import { issueKeyFor } from '../src/shared/jiraIssue'
import { jiraSnapshotHasContent } from '../src/shared/jiraIssueDoc'
import { buildAgentIdentityPrompt } from '../src/shared/agentIdentity'
import { buildJiraAttachedPrompt, buildMcpCapabilityPrompt } from '../src/shared/mcpCapabilityPrompt'
import { initSessionCwd } from './cdRecentCapture'
import { projectDirPath } from './projectDir'
import { recordPulseEvent } from './pulseStore'
import type { PulseEvent } from '../src/shared/pulseEvents'
import { repoAndBranch } from './gitSessionOps'
import {
  buildContextCatalogPrompt,
  buildContextPromptDelivery,
  buildRequestedContextSections,
  extractContextSectionRequest,
  materializeTabContext,
  type ContextDeliverySnapshot,
  type ContextPromptDelivery,
} from './tabContextBuild'
import {
  appendAiChangelog,
  buildAiChangelogInstruction,
  extractAiChangelog,
} from './aiChangelog'
import {
  buildAiAgentResultsInstruction,
  buildRecentAgentResultsPrompt,
  extractAiAgentResults,
  resolveResultsAgentId,
  upsertAiAgentResults,
} from './aiAgentResults'
import {
  buildAiAgentDelegateInstruction,
  buildAiAgentProductOwnerInstruction,
  extractAiAgentDelegates,
} from './aiAgentDelegate'
import {
  buildOrchestratorAgentsBlock,
  buildOrchestratorTurboWorkStyleBlock,
  coordinationCanDelegate,
  formatDelegationResultFollowUp,
  isProductOwner,
} from '../src/shared/agentOrchestration'
import {
  agentCliCommand,
  agentCliSpec,
  isAgentCliProvider,
  providerCapabilities,
  type AgentCliArgsInput,
  type AgentCliProvider,
} from '../src/shared/agentCliProviders'
import { resolvePluginDirs } from '../src/shared/installedPlugins'
import { captureWorkspaceSnapshot, changedWorkspacePaths } from './turnFileChanges'
import { applyWikiIngestFromFinalText } from './wikiIngest'
import { formatCliSpawnFailure, resolveCliExecutable } from './shellPathEnv'
import { readInstalledPlugins } from './pluginDirs'
import {
  mcpServerNames,
  mcpServersToDisable,
  readMcpConfigFor,
  readProjectMcpConfig,
  writeScopedMcpConfig,
} from './mcpConfigFile'

interface AgentRun {
  proc: ChildProcessWithoutNullStreams | null
  windowId: number
  /** Identifica la reserva del turno; evita que un spawn tardío revive un stop. */
  generation: number
}

const agentRuns = new Map<string, AgentRun>()
let nextAgentRunGeneration = 1

export interface StopAgentRunOptions {
  /** Ventana a notificar; solo con `notify: true`. */
  win?: BrowserWindow
  /**
   * Si true, emite done/EXIT al renderer (parada pedida por el usuario).
   * En arranque de un turno nuevo debe ser false para no cerrar el turno entrante.
   */
  notify?: boolean
}

interface SessionContextDeliveryState {
  snapshot: ContextDeliverySnapshot
  turnsSinceFullRefresh: number
}

interface PlannedContextDelivery extends ContextPromptDelivery {
  previousTurnsSinceFullRefresh: number
}

export const CONTEXT_FULL_REFRESH_INTERVAL_TURNS = 10
const MAX_CONTEXT_DELIVERY_SESSIONS = 100
const sessionContextDeliveries = new Map<string, SessionContextDeliveryState>()

const contextDeliveryMetrics: ContextDeliveryMetrics = {
  catalogChars: 0,
  sectionsRequested: 0,
  sectionsDelivered: 0,
  sectionsPreattached: 0,
  inputTokens: 0,
  outputTokens: 0,
}

/** Suma el uso reportado por el CLI en el evento final de un turno. */
export function recordTurnUsage(usage: { inputTokens?: number; outputTokens?: number }): void {
  if (Number.isFinite(usage.inputTokens)) {
    contextDeliveryMetrics.inputTokens += usage.inputTokens as number
  }
  if (Number.isFinite(usage.outputTokens)) {
    contextDeliveryMetrics.outputTokens += usage.outputTokens as number
  }
}

export function getContextDeliveryMetrics(): ContextDeliveryMetrics {
  return { ...contextDeliveryMetrics }
}

export function clearContextDeliveryMetrics(): void {
  contextDeliveryMetrics.catalogChars = 0
  contextDeliveryMetrics.sectionsRequested = 0
  contextDeliveryMetrics.sectionsDelivered = 0
  contextDeliveryMetrics.sectionsPreattached = 0
  contextDeliveryMetrics.inputTokens = 0
  contextDeliveryMetrics.outputTokens = 0
}

export function shouldForceFullContextRefresh(turnsSinceFullRefresh: number | null): boolean {
  return turnsSinceFullRefresh == null ||
    turnsSinceFullRefresh >= CONTEXT_FULL_REFRESH_INTERVAL_TURNS - 1
}

function contextSessionKey(provider: AgentCliStartRequest['provider'], cliSessionId: string): string {
  return `${provider}\0${cliSessionId}`
}

/** Carpeta del proyecto (`.gravity/`); el spawn CLI sigue usando el cwd del turno. */
export function resolveProjectCwd(
  request: Pick<AgentCliStartRequest, 'cwd' | 'projectCwd'>,
  home: string,
): string {
  const project = (request.projectCwd ?? '').trim()
  return resolveWorkingDirectory(project || request.cwd, home)
}

function planContextDelivery(
  request: AgentCliStartRequest,
  projectCwd: string,
): PlannedContextDelivery {
  const sessionKey = request.cliSessionId
    ? contextSessionKey(request.provider, request.cliSessionId)
    : null
  const previous = sessionKey ? sessionContextDeliveries.get(sessionKey) : undefined
  const forceFullRefresh = request.forceContextFullRefresh === true
    || shouldForceFullContextRefresh(
      previous?.turnsSinceFullRefresh ?? null,
    )
  const delivery = buildContextPromptDelivery(request.contexts ?? [], projectCwd, {
    previousSnapshot: request.forceContextFullRefresh === true ? undefined : previous?.snapshot,
    forceFullRefresh,
    userPrompt: request.prompt,
    discoveredContexts: request.discoveredContexts,
    contextContents: request.contextContents,
  })
  contextDeliveryMetrics.catalogChars += delivery.catalogChars
  contextDeliveryMetrics.sectionsPreattached += delivery.preattachedSectionCount
  return {
    ...delivery,
    previousTurnsSinceFullRefresh: previous?.turnsSinceFullRefresh ?? 0,
  }
}

function commitContextDelivery(
  request: AgentCliStartRequest,
  cliSessionId: string,
  delivery: PlannedContextDelivery,
): void {
  const key = contextSessionKey(request.provider, cliSessionId)
  const turnsSinceFullRefresh = delivery.fullRefresh
    ? 0
    : delivery.previousTurnsSinceFullRefresh + 1
  sessionContextDeliveries.delete(key)
  sessionContextDeliveries.set(key, {
    snapshot: delivery.snapshot,
    turnsSinceFullRefresh,
  })
  while (sessionContextDeliveries.size > MAX_CONTEXT_DELIVERY_SESSIONS) {
    const oldest = sessionContextDeliveries.keys().next().value as string | undefined
    if (!oldest) break
    sessionContextDeliveries.delete(oldest)
  }
}

export function clearAgentContextDeliveryState(): void {
  sessionContextDeliveries.clear()
}

/** Borra el contador/snapshot de contextos de una sesión CLI concreta. */
export function clearAgentContextDeliveryForSession(
  provider: AgentCliStartRequest['provider'],
  cliSessionId: string,
): void {
  const id = cliSessionId.trim()
  if (!id) return
  sessionContextDeliveries.delete(contextSessionKey(provider, id))
}

const ALLOWED_IMAGE_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
])

const MAX_IMAGE_BYTES = 12 * 1024 * 1024

function extensionForMime(mimeType: string): string {
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return '.jpg'
  if (mimeType === 'image/webp') return '.webp'
  if (mimeType === 'image/gif') return '.gif'
  return '.png'
}

function sanitizeAttachmentName(name: string, mimeType: string, index: number): string {
  const base = basename(name || `paste-${index + 1}`).replace(/[^\w.-]+/g, '_')
  const ext = extensionForMime(mimeType)
  const stem = (extname(base) ? base.slice(0, -extname(base).length) : base) || `paste-${index + 1}`
  return `${stem}${ext}`
}

/**
 * Escribe las imágenes pegadas bajo `<projectDir>/clipboard-images` y
 * devuelve rutas absolutas que el CLI puede abrir con su herramienta Read.
 */
export function materializeClipboardImages(
  cwd: string,
  images: AgentCliImageAttachment[] | undefined,
): string[] {
  if (!Array.isArray(images) || images.length === 0) return []
  const dir = projectDirPath(cwd, 'clipboard-images')
  mkdirSync(dir, { recursive: true })
  try {
    writeFileSync(join(dir, '.gitignore'), '*\n!.gitignore\n', { flag: 'wx' })
  } catch {
    // Ya existe o no se pudo crear; no bloquea el pegado.
  }
  const stamp = Date.now()
  const paths: string[] = []
  images.forEach((image, index) => {
    const mime = (image.mimeType || '').toLowerCase().trim()
    if (!ALLOWED_IMAGE_MIME.has(mime)) return
    const raw = typeof image.base64 === 'string' ? image.base64.trim() : ''
    if (!raw) return
    let buffer: Buffer
    try {
      buffer = Buffer.from(raw, 'base64')
    } catch {
      return
    }
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) return
    const fileName = `${stamp}-${index + 1}-${sanitizeAttachmentName(image.name, mime, index)}`
    const abs = join(dir, fileName)
    writeFileSync(abs, buffer)
    paths.push(abs)
  })
  return paths
}

function buildImageAttachmentSection(paths: string[]): string {
  if (!paths.length) return ''
  return [
    '## Attached images from clipboard',
    'The user pasted the following image file(s). Open and inspect them with your file/read tools before answering:',
    ...paths.map((path, index) => `${index + 1}. ${path}`),
    '',
  ].join('\n')
}

function send(
  win: BrowserWindow,
  paneId: string,
  event: AgentCliUiEvent,
): void {
  if (!win.isDestroyed()) win.webContents.send(IPC.AGENT_CLI_EVENT, paneId, event)
}

/** Emite done en el canal de eventos y EXIT; el renderer prioriza done para ordenar el cierre. */
function finishAgentTurn(win: BrowserWindow, paneId: string, code: number): void {
  if (win.isDestroyed()) return
  send(win, paneId, { type: 'done', code })
  win.webContents.send(IPC.AGENT_CLI_EXIT, paneId, code)
}

/**
 * Solo el proceso aún registrado como activo debe cerrar el turno.
 * Un close tardío (SIGTERM de un turno anterior) con el mapa ya vacío
 * no debe emitir otro done/EXIT: eso reabría el renderer y drenaba la cola
 * con asistentes vacíos en cascada.
 */
export function shouldFinishOnProcessClose(phaseStillActive: boolean): boolean {
  return phaseStillActive
}

/** Cierra stdin tras spawn: CLIs en -p esperan EOF; nadie escribe aquí. */
export function closeAgentCliStdin(stdin: { end: () => void } | null | undefined): void {
  try { stdin?.end() } catch { /* ignore */ }
}

function stringAt(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  const found = (value as Record<string, unknown>)[key]
  return typeof found === 'string' && found.trim() ? found : undefined
}

function contentText(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const message = (value as Record<string, unknown>).message
  if (!message || typeof message !== 'object') return ''
  const content = (message as Record<string, unknown>).content
  if (!Array.isArray(content)) return ''
  return content
    .map(part => stringAt(part, 'text') ?? '')
    .join('')
}

/**
 * Uso de tokens de un evento `result` de Claude.
 *
 * Los tokens del preámbulo (identidad, catálogo de contexto, skills de plugin)
 * caen en los campos de **caché**, no en `input_tokens`: en un turno medido de
 * verdad fueron 2 contra 22.476 de `cache_creation_input_tokens`. Sumar los
 * tres es lo que hace comparable un agente con plugins contra uno sin ellos,
 * que es para lo que existe esta métrica.
 */
export function claudeTurnUsage(
  event: Record<string, unknown>,
): { inputTokens: number; outputTokens: number } {
  const usage = event.usage as Record<string, unknown> | undefined
  const num = (key: string): number => {
    const value = usage?.[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : 0
  }
  return {
    inputTokens: num('input_tokens')
      + num('cache_creation_input_tokens')
      + num('cache_read_input_tokens'),
    outputTokens: num('output_tokens'),
  }
}

export function normalizeClaudeEvent(value: unknown): AgentCliUiEvent[] {
  if (!value || typeof value !== 'object') return []
  const obj = value as Record<string, unknown>
  const out: AgentCliUiEvent[] = []
  const sessionId = stringAt(obj, 'session_id')
  if (sessionId) out.push({ type: 'session', cliSessionId: sessionId })

  if (obj.type === 'stream_event') {
    const event = obj.event as Record<string, unknown> | undefined
    const delta = event?.delta as Record<string, unknown> | undefined
    if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
      out.push({ type: 'assistant_delta', text: delta.text })
    }
  } else if (obj.type === 'result') {
    recordTurnUsage(claudeTurnUsage(obj))
    const result = stringAt(obj, 'result')
    if (result) out.push({ type: 'assistant_final', text: result })
  } else if (obj.type === 'assistant') {
    const text = contentText(obj)
    if (text && !('parent_tool_use_id' in obj)) {
      // Fallback para versiones sin include-partial-messages.
      out.push({ type: 'assistant_final', text })
    }
  }
  return out
}

function truncateToolDetail(value: string, max = 72): string {
  const compact = value.replace(/\s+/g, ' ').trim()
  if (compact.length <= max) return compact
  return `${compact.slice(0, Math.max(1, max - 1))}…`
}

function basenamePath(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const parts = normalized.split('/').filter(Boolean)
  if (parts.length <= 2) return normalized
  return parts.slice(-2).join('/')
}

function pickToolDetail(args: Record<string, unknown>): string | undefined {
  for (const key of [
    'path',
    'filePath',
    'file_path',
    'target_file',
    'targetFile',
    'relative_workspace_path',
    'relativeWorkspacePath',
  ]) {
    const value = args[key]
    if (typeof value === 'string' && value.trim()) {
      return truncateToolDetail(basenamePath(value.trim()), 64)
    }
  }
  for (const key of ['pattern', 'glob', 'glob_pattern', 'globPattern', 'query', 'search_term', 'searchTerm']) {
    const value = args[key]
    if (typeof value === 'string' && value.trim()) {
      return truncateToolDetail(value, 56)
    }
  }
  for (const key of ['command', 'cmd']) {
    const value = args[key]
    if (typeof value === 'string' && value.trim()) {
      return truncateToolDetail(value, 64)
    }
  }
  return undefined
}

function friendlyCursorToolName(rawKey: string): string {
  const stripped = rawKey
    .replace(/ToolCall$/i, '')
    .replace(/Tool$/i, '')
    .trim()
  if (!stripped) return 'tool'
  const spaced = stripped.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function toolCallArgs(toolCall: unknown): { toolName: string; args: Record<string, unknown> } | null {
  if (!toolCall || typeof toolCall !== 'object') return null
  const record = toolCall as Record<string, unknown>
  const key = Object.keys(record)[0]
  if (!key) return null
  const payload = record[key]
  if (!payload || typeof payload !== 'object') {
    return { toolName: key, args: {} }
  }
  const body = payload as Record<string, unknown>

  if (key === 'function' || typeof body.name === 'string') {
    const fnName = typeof body.name === 'string' ? body.name : key
    if (typeof body.arguments === 'string' && body.arguments.trim()) {
      try {
        const parsed = JSON.parse(body.arguments) as unknown
        if (parsed && typeof parsed === 'object') {
          return { toolName: fnName, args: parsed as Record<string, unknown> }
        }
      } catch {
        return { toolName: fnName, args: {} }
      }
    }
    if (body.arguments && typeof body.arguments === 'object') {
      return { toolName: fnName, args: body.arguments as Record<string, unknown> }
    }
    return { toolName: fnName, args: {} }
  }

  const args = body.args && typeof body.args === 'object'
    ? body.args as Record<string, unknown>
    : body
  return { toolName: key, args }
}

function isCreatePlanToolName(raw: string): boolean {
  const compact = raw.replace(/[^a-zA-Z]/g, '').toLowerCase()
  return compact === 'createplan' || compact === 'createplantoolcall'
}

/** Formatea el cuerpo de CreatePlan para mostrarlo en el chat del agente. */
export function formatCreatePlanForChat(args: Record<string, unknown>): string | null {
  const name = typeof args.name === 'string' ? args.name.trim() : ''
  const overview = typeof args.overview === 'string' ? args.overview.trim() : ''
  const plan = typeof args.plan === 'string' ? args.plan.trim() : ''
  if (!plan && !overview && !name) return null

  const parts: string[] = []
  if (name) parts.push(`# ${name}`)
  if (overview) parts.push(overview)
  if (plan) parts.push(plan)
  return parts.join('\n\n').trim() || null
}

/**
 * CreatePlan vive en tool_call (tarjeta del IDE), no en texto del asistente.
 * Sin esto el usuario solo ve “plan listo” / activity de tool.
 */
export function extractCursorCreatePlanText(toolCall: unknown): string | null {
  const parsed = toolCallArgs(toolCall)
  if (!parsed || !isCreatePlanToolName(parsed.toolName)) return null
  return formatCreatePlanForChat(parsed.args)
}

/** Extrae nombre legible + detalle (ruta/patrón/comando) de un tool_call de Cursor. */
export function describeCursorToolCall(toolCall: unknown): { name: string; detail?: string } {
  const parsed = toolCallArgs(toolCall)
  if (!parsed) return { name: 'tool' }
  const detail = pickToolDetail(parsed.args)
  if (!detail && isCreatePlanToolName(parsed.toolName)) {
    const name = typeof parsed.args.name === 'string' ? parsed.args.name.trim() : ''
    if (name) {
      return { name: friendlyCursorToolName(parsed.toolName), detail: truncateToolDetail(name, 56) }
    }
  }
  return {
    name: friendlyCursorToolName(parsed.toolName),
    ...(detail ? { detail } : {}),
  }
}

export function normalizeCursorEvent(value: unknown): AgentCliUiEvent[] {
  if (!value || typeof value !== 'object') return []
  const obj = value as Record<string, unknown>
  const out: AgentCliUiEvent[] = []
  const sessionId =
    stringAt(obj, 'session_id') ??
    stringAt(obj, 'sessionId') ??
    stringAt(obj, 'chat_id') ??
    stringAt(obj, 'chatId')
  if (sessionId) out.push({ type: 'session', cliSessionId: sessionId })

  if (obj.type === 'assistant') {
    const text = contentText(obj)
    if (text && typeof obj.timestamp_ms === 'number' && !obj.model_call_id) {
      out.push({ type: 'assistant_delta', text })
    }
  } else if (obj.type === 'result') {
    const result = stringAt(obj, 'result')
    if (result) out.push({ type: 'assistant_final', text: result })
  } else if (obj.type === 'tool_call') {
    const status = obj.subtype === 'completed' ? 'completed' : 'started'
    const described = describeCursorToolCall(obj.tool_call)
    out.push({
      type: 'tool',
      name: described.name,
      status,
      ...(described.detail ? { detail: described.detail } : {}),
    })
    // CreatePlan guarda el markdown en args, no en assistant text.
    // Emitir en started y completed; el runtime deduplica por `source: create_plan`.
    const planText = extractCursorCreatePlanText(obj.tool_call)
    if (planText) {
      out.push({ type: 'assistant_delta', text: `\n\n${planText}`, source: 'create_plan' })
    }
  }
  return out
}

/** Mapea el stream JSONL de Copilot (`--output-format json`) a eventos de UI. */
export function normalizeCopilotEvent(value: unknown): AgentCliUiEvent[] {
  if (!value || typeof value !== 'object') return []
  const obj = value as Record<string, unknown>
  const out: AgentCliUiEvent[] = []
  const data = obj.data && typeof obj.data === 'object'
    ? obj.data as Record<string, unknown>
    : null

  if (obj.type === 'assistant.message_delta' && data) {
    const delta = typeof data.deltaContent === 'string' ? data.deltaContent : ''
    if (delta) out.push({ type: 'assistant_delta', text: delta })
    return out
  }

  if (obj.type === 'assistant.message' && data) {
    const text = typeof data.content === 'string' ? data.content : ''
    if (text) out.push({ type: 'assistant_final', text })
    return out
  }

  if (obj.type === 'tool.execution_start' && data) {
    const name = typeof data.toolName === 'string' && data.toolName.trim()
      ? data.toolName.trim()
      : 'tool'
    const detail = data.arguments && typeof data.arguments === 'object'
      ? pickToolDetail(data.arguments as Record<string, unknown>)
      : undefined
    out.push({
      type: 'tool',
      name,
      status: 'started',
      ...(detail ? { detail } : {}),
    })
    return out
  }

  if (obj.type === 'tool.execution_complete' && data) {
    const name = typeof data.toolName === 'string' && data.toolName.trim()
      ? data.toolName.trim()
      : 'tool'
    out.push({ type: 'tool', name, status: 'completed' })
    return out
  }

  if (obj.type === 'result') {
    const sessionId = stringAt(obj, 'sessionId')
    if (sessionId) out.push({ type: 'session', cliSessionId: sessionId })
    return out
  }

  return out
}

/** Nombre legible de un item de Codex (`command_execution` → `Command execution`). */
function friendlyCodexItemType(raw: string): string {
  const spaced = raw.replace(/[_-]+/g, ' ').trim()
  if (!spaced) return 'tool'
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * Mapea el NDJSON de `codex exec --json` a eventos de UI.
 * Sobre observado: `thread.started` (thread_id = sesión), `turn.started`,
 * `item.started|updated|completed` con `item.type`, `error` y `turn.failed`.
 */
export function normalizeCodexEvent(value: unknown): AgentCliUiEvent[] {
  if (!value || typeof value !== 'object') return []
  const obj = value as Record<string, unknown>
  const out: AgentCliUiEvent[] = []

  if (obj.type === 'thread.started') {
    const threadId = stringAt(obj, 'thread_id')
    if (threadId) out.push({ type: 'session', cliSessionId: threadId })
    return out
  }

  if (obj.type === 'error' || obj.type === 'turn.failed') {
    const message = stringAt(obj, 'message')
      ?? stringAt(obj.error, 'message')
      ?? 'Codex falló'
    out.push({ type: 'error', message })
    return out
  }

  if (typeof obj.type !== 'string' || !obj.type.startsWith('item.')) return out
  const item = obj.item && typeof obj.item === 'object'
    ? obj.item as Record<string, unknown>
    : null
  if (!item) return out
  const itemType = typeof item.type === 'string' ? item.type : ''

  if (itemType === 'agent_message') {
    const text = stringAt(item, 'text')
    if (text && obj.type === 'item.completed') out.push({ type: 'assistant_final', text })
    return out
  }
  if (itemType === 'error') {
    const message = stringAt(item, 'message')
    if (message) out.push({ type: 'error', message })
    return out
  }
  if (itemType === 'reasoning' || !itemType) return out

  const detail = pickToolDetail(item)
  out.push({
    type: 'tool',
    name: friendlyCodexItemType(itemType),
    status: obj.type === 'item.completed' ? 'completed' : 'started',
    ...(detail ? { detail } : {}),
  })
  return out
}

function resolveWorkingDirectory(requested: string, fallback: string): string {
  try {
    const dir = resolve(requested || fallback)
    return statSync(dir).isDirectory() ? dir : fallback
  } catch {
    return fallback
  }
}

/**
 * Las claves de issue que el preámbulo puede anunciar como «adjuntas con
 * snapshot fresco» (y, por tanto, prohibir buscar por MCP).
 *
 * El filtro es por CONTENIDO, no por existencia. Desde que `materializeTabContext`
 * escribe un placeholder al alta (`write:true` sin snapshot), el `.md` existe
 * desde el instante en que se crea el contexto, así que un gate por `.ok` deja
 * pasar el caso exacto que ese gate existía para cerrar: Jira sin configurar,
 * clave equivocada o red caída → el refresher no rellena nada, el documento se
 * queda en puros marcadores, y el agente recibe «ya la tienes, no la busques»
 * junto a cero datos. `jiraSnapshotHasContent` es la misma regla que aplica el
 * refresher (`electron/jiraContextRefresh.ts`) para decidir si hay que ir a
 * buscar: una sola implementación, porque ya divergieron dos veces.
 */
function collectAttachedJiraKeys(contexts: readonly TabContext[], resultsCwd: string): string[] {
  const keys: string[] = []
  for (const context of contexts) {
    if (context.kind !== 'jira') continue
    const key = issueKeyFor(context)
    if (!key) continue
    const materialized = materializeTabContext(context, resultsCwd, { write: false })
    if (!materialized.ok || !jiraSnapshotHasContent(materialized.content)) continue
    if (!keys.includes(key)) keys.push(key)
  }
  return keys
}

export function composePrompt(
  request: AgentCliStartRequest,
  cwd: string,
  imagePaths: string[] = [],
  contextPrompt = buildContextCatalogPrompt(
    Array.isArray(request.contexts) ? request.contexts : [],
    cwd,
  ),
): string {
  const identityPrompt = buildAgentIdentityPrompt({
    name: request.name,
    role: request.role,
    objective: request.objective,
    rules: request.rules,
  })
  const mcpCapabilityPrompt = buildMcpCapabilityPrompt(request.mcpsAllowed ?? [])
  // `.gravity` vive en el proyecto, nunca en el worktree del turno (cwd) — el
  // chequeo de snapshot usa el mismo cwd que el resto de operaciones de contexto.
  const resultsCwd = (request.projectCwd ?? '').trim() || cwd
  const jiraAttachedPrompt = buildJiraAttachedPrompt(
    collectAttachedJiraKeys(
      Array.isArray(request.contexts) ? request.contexts : [],
      resultsCwd,
    ),
  )
  const imageSection = buildImageAttachmentSection(imagePaths)
  const userPrompt = request.prompt.trim()
    || (imagePaths.length
      ? 'Please inspect the attached image(s) and respond helpfully.'
      : '')
  const resultsInstruction = buildAiAgentResultsInstruction(request.name)
  const recentResultsPrompt = Array.isArray(request.tabAgentIds) && request.tabAgentIds.length
    ? buildRecentAgentResultsPrompt(resultsCwd, request.tabAgentIds)
    : ''
  const canDelegate = coordinationCanDelegate(request.coordination)
  const allowDelegations = request.allowDelegations !== false
  const allowedAgentIds = (request.orchestrationAgents ?? []).map(agent => agent.agentId)
  const workStyle = request.orchestrationWorkStyle === 'turbo' ? 'turbo' as const : 'linear' as const
  const allowExpertReplicas = request.allowExpertReplicas === true || workStyle === 'turbo'
  const orchestrationBlock = canDelegate
    ? [
        buildOrchestratorAgentsBlock(request.orchestrationAgents ?? [], { allowExpertReplicas }),
        '',
        ...(workStyle === 'turbo' && !isProductOwner(request.coordination)
          ? [
              buildOrchestratorTurboWorkStyleBlock({
                jobId: request.orchestrationJobId,
                maxRounds: request.orchestrationMaxRounds,
              }),
              '',
            ]
          : []),
        isProductOwner(request.coordination)
          ? buildAiAgentProductOwnerInstruction({
            allowDelegations,
            round: request.orchestrationRound,
            maxRounds: request.orchestrationMaxRounds,
            allowedAgentIds,
            allowExpertReplicas,
          })
          : buildAiAgentDelegateInstruction({
            allowDelegations,
            round: request.orchestrationRound,
            maxRounds: request.orchestrationMaxRounds,
            allowedAgentIds,
            allowExpertReplicas,
            workStyle,
            orchestrationJobId: request.orchestrationJobId,
          }),
      ].join('\n')
    : ''
  const delegationFollowUps = (request.pendingDelegationResults ?? [])
    .map(result => formatDelegationResultFollowUp(result))
    .filter(Boolean)
  const planDeliveryInstruction = request.permissionMode === 'plan'
    ? [
        '## Plan delivery',
        'When you finish a plan, the user must see the full plan content in this chat.',
        'If you use CreatePlan, still ensure the plan body is visible to the user (do not only say the plan is ready).',
      ].join('\n')
    : ''
  return [
    ...(identityPrompt ? [identityPrompt, ''] : []),
    ...(mcpCapabilityPrompt ? [mcpCapabilityPrompt, ''] : []),
    ...(jiraAttachedPrompt ? [jiraAttachedPrompt, ''] : []),
    ...(contextPrompt ? [contextPrompt, ''] : []),
    ...(orchestrationBlock ? [orchestrationBlock, ''] : []),
    ...(delegationFollowUps.length ? [...delegationFollowUps, ''] : []),
    ...(recentResultsPrompt ? [recentResultsPrompt, ''] : []),
    ...(imageSection ? [imageSection] : []),
    '## User request',
    userPrompt,
    '',
    buildAiChangelogInstruction(),
    ...(resultsInstruction ? ['', resultsInstruction] : []),
    ...(planDeliveryInstruction ? ['', planDeliveryInstruction] : []),
  ].join('\n')
}

export function buildContextContinuationPrompt(
  initialPrompt: string,
  contextResponse: string,
  hasResumableSession: boolean,
): string {
  if (!hasResumableSession) {
    return [
      '## Restored initial turn',
      'The CLI did not provide a resumable session, so the complete initial prompt follows.',
      '',
      initialPrompt,
      '',
      '## Host context response',
      contextResponse,
    ].join('\n')
  }
  return [
    contextResponse,
    '',
    buildAiChangelogInstruction(),
  ].join('\n')
}

export function commandAndArgs(
  request: AgentCliStartRequest,
  config: AppConfig,
  cwd: string,
  prompt = composePrompt(request, cwd),
  cliSessionId = request.cliSessionId,
  /**
   * Home del usuario, para resolver plugins instalados. Requerido a propósito
   * (sin default): esta función decide qué ve el proceso lanzado, y un
   * llamador que se olvide de pasarlo no debe degradar en silencio a "sin
   * plugins" — debe fallar en compilación.
   */
  home: string,
): { command: string; args: string[] } {
  const provider = isAgentCliProvider(request.provider) ? request.provider : 'claude'
  const spec = agentCliSpec(provider)
  const nativeSkills = request.nativeSkills
  const pluginDirs = nativeSkills?.enabled
    ? resolvePluginDirs(nativeSkills.namespaces ?? [], readInstalledPlugins(home))
    : []
  const mcpsAllowed = request.mcpsAllowed ?? []
  const sessionId = typeof cliSessionId === 'string' ? cliSessionId.trim() : ''
  return {
    command: agentCliCommand(config.agentCliCommands, provider),
    args: spec.args({
      prompt,
      cwd,
      mode: request.permissionMode,
      ...(request.model?.trim() ? { model: request.model.trim() } : {}),
      ...(sessionId ? { sessionId } : {}),
      // `!== true` y no `=== false`: un agente sin nativeSkills también queda
      // apagado. Ese es el default seguro de la Task 1, y aquí se hace efectivo.
      disableSkills: nativeSkills?.enabled !== true,
      pluginDirs,
      emptySkillsDir: emptySkillsDir(),
      ...mcpScope(provider, mcpsAllowed, cwd, home),
    }),
  }
}

/**
 * Directorio vacío compartido, para los CLIs que acotan skills sustituyendo su
 * directorio de origen. Uno solo y reutilizado: por definición no tiene nada
 * dentro, así que un temporal por spawn solo dejaría basura en `tmpdir`.
 */
function emptySkillsDir(): string {
  const path = join(tmpdir(), 'gravity-skills-empty')
  mkdirSync(path, { recursive: true })
  return path
}

/**
 * Traduce la allowlist de MCP a lo que cada CLI sabe recibir. Vive aquí y no en
 * la tabla de proveedores porque cada vía necesita leer disco: el `.mcp.json`
 * del proyecto, o la config propia del CLI para derivar la denylist.
 */
function mcpScope(
  provider: AgentCliProvider,
  allowed: readonly string[],
  cwd: string,
  home: string,
): Pick<AgentCliArgsInput, 'mcpConfigPath' | 'mcpAllowed' | 'mcpDisabled'> {
  if (!allowed.length) return {}
  if (!providerCapabilities(provider).mcpAllowlist) return {}

  if (provider === 'copilot') {
    const disable = mcpServersToDisable(
      mcpServerNames(readMcpConfigFor(provider, cwd, home)),
      allowed,
    )
    // Sin nada que apagar no se emite el flag: `--disable-builtin-mcps` a solas
    // apagaría el MCP de GitHub, que no es lo que pidió la allowlist.
    return disable.length ? { mcpDisabled: disable } : {}
  }
  if (provider === 'gemini') return { mcpAllowed: [...allowed] }

  const path = writeScopedMcpConfig(
    allowed,
    readProjectMcpConfig(cwd),
    mkdtempSync(join(tmpdir(), 'gravity-mcp-')),
  )
  return path ? { mcpConfigPath: path } : {}
}

/**
 * Lector de stdout del CLI: `line()` por cada línea y `end()` al cerrar.
 * Los proveedores sin salida estructurada emiten cada línea como delta y el
 * texto acumulado como final, para que el post-proceso (changelog, results,
 * delegates) vea el turno completo igual que con NDJSON.
 */
export function createAgentCliParser(provider: AgentCliProvider): {
  line: (raw: string) => AgentCliUiEvent[]
  end: () => AgentCliUiEvent[]
} {
  const kind = agentCliSpec(provider).stream
  if (kind === 'text') {
    let buffer = ''
    return {
      line: raw => {
        buffer += `${raw}\n`
        return [{ type: 'assistant_delta', text: `${raw}\n` }]
      },
      end: () => (buffer.trim() ? [{ type: 'assistant_final', text: buffer.trimEnd() }] : []),
    }
  }
  const normalize = kind === 'cursor'
    ? normalizeCursorEvent
    : kind === 'copilot'
      ? normalizeCopilotEvent
      : kind === 'codex'
        ? normalizeCodexEvent
        : normalizeClaudeEvent
  return {
    // JSON.parse lanza en líneas no-NDJSON: el llamador las manda a stderr.
    line: raw => normalize(JSON.parse(raw) as unknown),
    end: () => [],
  }
}

export interface AgentCliSpawnHandlers {
  onEvent: (event: AgentCliUiEvent) => void
  onDone: (code: number) => void
}

/**
 * Spawn single-shot de un CLI de agente (sin continuación de contextos ni
 * post-proceso de changelog/delegates). Reutiliza `agentRuns` + generación
 * para que un stop no revive turnos en vuelo.
 */
export function runAgentCliSpawn(
  request: AgentCliStartRequest,
  config: AppConfig,
  home: string,
  handlers: AgentCliSpawnHandlers,
  promptOverride?: string,
): void {
  const generation = reserveAgentRun(request.paneId, null)
  const cwd = resolveWorkingDirectory(request.cwd, home)
  const prompt = promptOverride ?? composePrompt(request, cwd)
  let latestSessionId = request.cliSessionId

  const failBeforeSpawn = (message: string): void => {
    const current = agentRuns.get(request.paneId)
    if (current?.generation === generation) agentRuns.delete(request.paneId)
    handlers.onEvent({ type: 'error', message })
    handlers.onDone(1)
  }

  const { command: rawCommand, args } = commandAndArgs(
    request,
    config,
    cwd,
    prompt,
    latestSessionId,
    home,
  )
  if (!rawCommand) {
    failBeforeSpawn('El comando del CLI no está configurado.')
    return
  }

  const command = resolveCliExecutable(rawCommand)
  let proc: ChildProcessWithoutNullStreams
  try {
    proc = crossSpawn(command, args, {
      cwd,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    }) as ChildProcessWithoutNullStreams
  } catch (error) {
    failBeforeSpawn(error instanceof Error ? error.message : String(error))
    return
  }

  const reserved = agentRuns.get(request.paneId)
  if (!reserved || reserved.generation !== generation) {
    try { proc.kill('SIGTERM') } catch { /* already exited */ }
    return
  }
  agentRuns.set(request.paneId, { proc, windowId: -1, generation })
  closeAgentCliStdin(proc.stdin)

  let stdoutBuffer = ''
  let stderrBuffer = ''
  let sawAssistantText = false
  let spawnErrnoMessage: string | undefined

  const parser = createAgentCliParser(
    isAgentCliProvider(request.provider) ? request.provider : 'claude',
  )

  const emit = (events: AgentCliUiEvent[]): void => {
    for (const event of events) {
      if (event.type === 'session') {
        latestSessionId = event.cliSessionId
      }
      if (
        (event.type === 'assistant_delta' || event.type === 'assistant_final')
        && event.text.trim()
      ) {
        sawAssistantText = true
      }
      handlers.onEvent(event)
    }
  }

  const processLine = (line: string): void => {
    const trimmed = line.trim()
    if (!trimmed) return
    try {
      emit(parser.line(trimmed))
    } catch {
      stderrBuffer += `${trimmed}\n`
    }
  }

  proc.stdout.setEncoding('utf8')
  proc.stdout.on('data', (chunk: string) => {
    stdoutBuffer += chunk
    const lines = stdoutBuffer.split(/\r?\n/)
    stdoutBuffer = lines.pop() ?? ''
    lines.forEach(processLine)
  })
  proc.stderr.setEncoding('utf8')
  proc.stderr.on('data', (chunk: string) => {
    stderrBuffer += chunk
  })
  proc.on('error', error => {
    spawnErrnoMessage = error.message
    handlers.onEvent({
      type: 'error',
      message: formatCliSpawnFailure(command, -4058, error.message),
    })
  })
  proc.on('close', code => {
    if (stdoutBuffer.trim()) processLine(stdoutBuffer)
    emit(parser.end())
    const current = agentRuns.get(request.paneId)
    const phaseStillActive = current?.proc === proc && current.generation === generation
    if (phaseStillActive) agentRuns.delete(request.paneId)
    if (!shouldFinishOnProcessClose(phaseStillActive)) return
    if (code && !sawAssistantText) {
      handlers.onEvent({
        type: 'error',
        message: formatCliSpawnFailure(command, code, stderrBuffer || spawnErrnoMessage),
      })
    }
    handlers.onDone(code ?? 0)
  })
}

export function startAgentTurn(
  win: BrowserWindow,
  request: AgentCliStartRequest,
  config: AppConfig,
  home: string,
  /**
   * Generación ya reservada por el caller (p. ej. el handler de
   * `AGENT_CLI_START`, antes de su refresco async de Jira). Si falta, se
   * reserva aquí mismo — mismo camino que antes, ahora factorizado en
   * `reserveAgentRun` para no tener dos implementaciones de la reserva.
   */
  reservedGeneration?: number,
): void {
  const generation = reservedGeneration ?? reserveAgentRun(request.paneId, win)
  const cwd = resolveWorkingDirectory(request.cwd, home)
  const projectCwd = resolveProjectCwd(request, home)
  // Los paneles agente no tienen PTY; sincronizamos cwd lógico para el resto de IPC.
  if (cwd) initSessionCwd(request.paneId, cwd)
  const imagePaths = materializeClipboardImages(projectCwd, request.images)
  const beforeSnapshot = captureWorkspaceSnapshot(cwd)
  let latestSessionId = request.cliSessionId
  let changelogPersisted = false
  /** Mismo patrón que changelogPersisted: el round 2 de need-sections re-emite assistant_final. */
  let wikiIngestPersisted = false
  const contextDelivery = planContextDelivery(request, projectCwd)
  const initialPrompt = composePrompt(request, cwd, imagePaths, contextDelivery.prompt)
  let contextDeliveryCommitted = false
  const turnStartedAt = Date.now()
  const tokensAtStart = getContextDeliveryMetrics()
  /**
   * Repo y rama del turno, resueltos una sola vez: los tres eventos de Pulse que
   * puede emitir un turno (prompt, resultado, delegación) llevan la misma
   * etiqueta, y sin esto cada uno gastaría su propio par de `git`.
   */
  const repoCtx: Promise<{ repo?: string; branch?: string }> = cwd
    ? repoAndBranch(cwd).catch(() => ({}))
    : Promise.resolve({})

  /** Etiquetas comunes a todo evento de Pulse del turno. */
  const pulseTags = {
    ...(request.agentId ? { agentId: request.agentId } : {}),
    ...(request.name?.trim() ? { agentName: request.name.trim() } : {}),
    ...(request.workspace ? { workspace: request.workspace } : {}),
  }

  /** Nunca await en el camino del turno: la telemetría va por detrás. */
  const recordDerivedPulse = (event: Omit<PulseEvent, 'ts'>): void => {
    const ts = Date.now()
    void repoCtx.then(ctx => recordPulseEvent({ ts, ...ctx, ...event }))
  }

  const failBeforeSpawn = (message: string): void => {
    const current = agentRuns.get(request.paneId)
    if (current?.generation === generation) agentRuns.delete(request.paneId)
    send(win, request.paneId, { type: 'error', message })
    finishAgentTurn(win, request.paneId, 1)
  }

  const startPhase = (prompt: string, contextRound: number): void => {
    const { command: rawCommand, args } = commandAndArgs(
      request,
      config,
      cwd,
      prompt,
      latestSessionId,
      home,
    )
    if (!rawCommand) {
      failBeforeSpawn('El comando del CLI no está configurado.')
      return
    }

    const command = resolveCliExecutable(rawCommand)
    let proc: ChildProcessWithoutNullStreams
    try {
      proc = crossSpawn(command, args, {
        cwd,
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      }) as ChildProcessWithoutNullStreams
    } catch (error) {
      failBeforeSpawn(error instanceof Error ? error.message : String(error))
      return
    }

    const reserved = agentRuns.get(request.paneId)
    if (!reserved || reserved.generation !== generation) {
      // El usuario paró (o se reemplazó el turno) mientras spawneábamos.
      try { proc.kill('SIGTERM') } catch { /* already exited */ }
      return
    }
    agentRuns.set(request.paneId, { proc, windowId: win.id, generation })
    closeAgentCliStdin(proc.stdin)
    let stdoutBuffer = ''
    let stderrBuffer = ''
    let continuationPrompt: string | null = null
    let sawAssistantText = false
    let spawnErrnoMessage: string | undefined
    /** Evita pegar el mismo CreatePlan dos veces (started + completed). */
    let lastCreatePlanText = ''
    /** stdout crudo del turno: red de seguridad si el NDJSON no dio texto. */
    let rawStdout = ''
    const parser = createAgentCliParser(
      isAgentCliProvider(request.provider) ? request.provider : 'claude',
    )

    const emit = (events: AgentCliUiEvent[]): void => {
      {
        for (const event of events) {
          if (event.type === 'session') {
            latestSessionId = event.cliSessionId
            send(win, request.paneId, event)
            continue
          }
          if (
            event.type === 'assistant_delta'
            && event.source === 'create_plan'
            && event.text === lastCreatePlanText
          ) {
            continue
          }
          if (event.type === 'assistant_delta' && event.source === 'create_plan') {
            lastCreatePlanText = event.text
          }
          if (continuationPrompt &&
              (event.type === 'assistant_delta' || event.type === 'assistant_final') &&
              !(event.type === 'assistant_delta' && event.source === 'create_plan')) {
            continue
          }
          if (event.type === 'assistant_final') {
            const sectionRequest = extractContextSectionRequest(event.text)
            if (sectionRequest.fenceFound && contextRound < 2) {
              const payload = buildRequestedContextSections(
                request.contexts ?? [],
                projectCwd,
                sectionRequest.requests,
                sectionRequest.errors,
                { contextContents: request.contextContents },
              )
              contextDeliveryMetrics.sectionsRequested += sectionRequest.requests
                .reduce((sum, item) => sum + (item.sections?.length ?? 1), 0)
              contextDeliveryMetrics.sectionsDelivered += payload.sectionCount
              continuationPrompt = buildContextContinuationPrompt(
                initialPrompt,
                payload.prompt,
                Boolean(latestSessionId),
              )
              send(win, request.paneId, {
                type: 'context',
                status: 'loading',
                detail: `${payload.sectionCount}`,
              })
              continue
            }

            const finalText = sectionRequest.fenceFound
              ? [
                  sectionRequest.visibleText,
                  '[Context request stopped: the maximum of two requests was reached.]',
                  ...sectionRequest.errors.map(error => `[Context request error: ${error}]`),
                ].filter(Boolean).join('\n\n')
              : sectionRequest.visibleText
            const changedPaths = changedWorkspacePaths(
              beforeSnapshot,
              captureWorkspaceSnapshot(cwd),
            )
            // Con [] no escribe (ya persistido), pero sigue limpiando el
            // fence del texto visible.
            const wikiIngest = applyWikiIngestFromFinalText(
              finalText,
              wikiIngestPersisted ? [] : request.contexts ?? [],
              projectCwd,
              { agentId: request.agentId?.trim() || undefined },
            )
            if (wikiIngest.persisted) wikiIngestPersisted = true
            const { visibleText: afterChangelog, changes } = extractAiChangelog(
              wikiIngest.visibleText,
              changedPaths,
            )
            if (changes.length && !changelogPersisted) {
              appendAiChangelog(projectCwd, changes)
              changelogPersisted = true
            }
            const { visibleText: afterResults, payload: resultsPayload } = extractAiAgentResults(
              afterChangelog,
            )
            if (
              resultsPayload
              && request.agentId?.trim()
            ) {
              const resolvedAgentId = resolveResultsAgentId(projectCwd, request.agentId.trim())
              upsertAiAgentResults(projectCwd, resolvedAgentId, resultsPayload, {
                agentName: request.name?.trim(),
              })
              recordDerivedPulse({ kind: 'result', ...pulseTags })
            }
            const { visibleText, delegations } = coordinationCanDelegate(request.coordination)
              ? extractAiAgentDelegates(afterResults)
              : { visibleText: afterResults, delegations: [] }
            if (delegations.length && request.allowDelegations !== false) {
              const jobId = request.orchestrationJobId?.trim()
              send(win, request.paneId, {
                type: 'delegate',
                delegations,
                ...(jobId ? { orchestrationJobId: jobId } : {}),
              })
              // Un evento por delegación: el roster cuenta emitidas del
              // orquestador y recibidas del ejecutor con los mismos registros.
              for (const delegation of delegations) {
                recordDerivedPulse({
                  kind: 'delegate',
                  ...pulseTags,
                  ...(delegation.toAgentId?.trim() ? { toAgentId: delegation.toAgentId.trim() } : {}),
                })
              }
            }
            if (visibleText.trim()) sawAssistantText = true
            send(win, request.paneId, { ...event, text: visibleText })
          } else {
            if (event.type === 'assistant_delta' && event.text.trim()) sawAssistantText = true
            send(win, request.paneId, event)
          }
        }
      }
    }

    const processLine = (line: string): void => {
      const trimmed = line.trim()
      if (!trimmed) return
      rawStdout += `${trimmed}\n`
      try {
        emit(parser.line(trimmed))
      } catch {
        // Algunos errores tempranos del CLI no usan NDJSON.
        stderrBuffer += `${trimmed}\n`
      }
    }

    proc.stdout.setEncoding('utf8')
    proc.stdout.on('data', (chunk: string) => {
      stdoutBuffer += chunk
      const lines = stdoutBuffer.split(/\r?\n/)
      stdoutBuffer = lines.pop() ?? ''
      lines.forEach(processLine)
    })
    proc.stderr.setEncoding('utf8')
    proc.stderr.on('data', (chunk: string) => {
      stderrBuffer += chunk
    })
    proc.on('error', error => {
      spawnErrnoMessage = error.message
      send(win, request.paneId, {
        type: 'error',
        message: formatCliSpawnFailure(command, -4058, error.message),
      })
    })
    proc.on('close', code => {
      if (stdoutBuffer.trim()) processLine(stdoutBuffer)
      emit(parser.end())
      // Capturar antes del volcado crudo: emit(assistant_final) pone sawAssistantText=true.
      const sawParsedAssistantText = sawAssistantText
      // El CLI habló pero su NDJSON no encajó con el normalizador: mostrar el
      // volcado crudo en vez de un turno mudo (delata el esquema desconocido).
      if (!sawAssistantText && rawStdout.trim()) {
        emit([{ type: 'assistant_final', text: rawStdout.trimEnd() }])
      }
      const current = agentRuns.get(request.paneId)
      const phaseStillActive = current?.proc === proc && current.generation === generation
      if (phaseStillActive) agentRuns.delete(request.paneId)

      // Close obsoleto (turno reemplazado o ya finalizado): no emitir done/EXIT.
      if (!shouldFinishOnProcessClose(phaseStillActive)) return

      if (
        code === 0 &&
        contextRound === 0 &&
        latestSessionId &&
        !contextDeliveryCommitted
      ) {
        commitContextDelivery(request, latestSessionId, contextDelivery)
        contextDeliveryCommitted = true
      }

      if (continuationPrompt && code === 0) {
        send(win, request.paneId, {
          type: 'context',
          status: 'loaded',
        })
        agentRuns.set(request.paneId, { proc: null, windowId: win.id, generation })
        startPhase(continuationPrompt, contextRound + 1)
        return
      }
      if (code && !sawParsedAssistantText) {
        send(win, request.paneId, {
          type: 'error',
          message: formatCliSpawnFailure(command, code, stderrBuffer || spawnErrnoMessage),
        })
      }
      recordTurnInPulse()
      finishAgentTurn(win, request.paneId, code ?? 0)
    })
  }

  /**
   * Un turno = un prompt del usuario, sin importar cuántas fases de contexto
   * hicieron falta. Solo se llama en el cierre real (las continuaciones
   * retornan antes).
   *
   * ponytail: los tokens salen del delta del contador global, no de una
   * atribución por panel. Con varios paneles corriendo a la vez el reparto
   * entre turnos puede sesgarse, pero el total —que es lo que muestra el
   * hero band— queda exacto. Si algún día hace falta el desglose por
   * agente/modelo, el upgrade es propagar el usage por paneId desde el parser.
   */
  function recordTurnInPulse(): void {
    const after = getContextDeliveryMetrics()
    const event: PulseEvent = {
      ts: turnStartedAt,
      kind: 'prompt',
      provider: request.provider,
      permissionMode: request.permissionMode,
      ...pulseTags,
      tokensIn: Math.max(0, after.inputTokens - tokensAtStart.inputTokens),
      tokensOut: Math.max(0, after.outputTokens - tokensAtStart.outputTokens),
      durationMs: Math.max(0, Date.now() - turnStartedAt),
      ...(request.viaLoop ? { viaLoop: true } : {}),
    }
    void repoCtx.then(ctx => recordPulseEvent({ ...event, ...ctx }))
  }

  startPhase(initialPrompt, 0)
}

export function isAgentRunActive(paneId: string): boolean {
  return agentRuns.has(paneId)
}

/**
 * Reserva el paneId para un turno nuevo: mata cualquier turno anterior (síncrono,
 * sin `await` de por medio) y aparta el slot con una generación fresca.
 * `startAgentTurn` la usa cuando no recibe una generación ya reservada; el
 * handler de `AGENT_CLI_START` la llama directamente para reservar el pane ANTES
 * del refresco async de Jira — así Stop/close/quit encuentran algo que matar
 * mientras el turno todavía no arrancó, en vez de que `stopAgentRun` salga en
 * `if (!run) return` y el spawn llegue de todas formas cuando el refresco termine.
 */
export function reserveAgentRun(paneId: string, win: BrowserWindow | null): number {
  stopAgentRun(paneId)
  const generation = nextAgentRunGeneration++
  agentRuns.set(paneId, { proc: null, windowId: win?.id ?? -1, generation })
  return generation
}

/**
 * ¿La reserva sigue siendo la misma generación? El handler la comprueba tras el
 * `await` del refresco para decidir si el turno diferido todavía debe arrancar,
 * o si Stop / un turno más nuevo para el mismo pane la invalidó mientras tanto.
 */
export function isAgentRunReservationCurrent(paneId: string, generation: number): boolean {
  return agentRuns.get(paneId)?.generation === generation
}

/**
 * Detiene el proceso del pane.
 * Con `notify: true` emite done/EXIT de inmediato: si solo matamos y borramos del
 * mapa, el `close` posterior no notifica y la UI se queda en “thinking”.
 */
export function stopAgentRun(paneId: string, options: StopAgentRunOptions = {}): void {
  const run = agentRuns.get(paneId)
  if (!run) return
  agentRuns.delete(paneId)
  try { run.proc?.kill('SIGTERM') } catch { /* already exited */ }
  if (options.notify && options.win && !options.win.isDestroyed()) {
    finishAgentTurn(options.win, paneId, 130)
  }
}

export function stopAgentRunsForWindow(windowId: number): void {
  for (const [paneId, run] of agentRuns) {
    if (run.windowId === windowId) stopAgentRun(paneId)
  }
}

/** Mata todos los procesos de agente (p. ej. al salir de la app). */
export function stopAllAgentRuns(): void {
  for (const paneId of [...agentRuns.keys()]) {
    stopAgentRun(paneId)
  }
}

