import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { mkdirSync, statSync, writeFileSync } from 'fs'
import { basename, extname, join, resolve } from 'path'
import type { BrowserWindow } from 'electron'
import type { AppConfig } from '../src/shared/configSchema'
import type {
  AgentCliImageAttachment,
  AgentCliStartRequest,
  AgentCliUiEvent,
} from '../src/shared/agentCliTypes'
import { IPC } from '../src/shared/ipcChannels'
import { filterTabContextUpdatesByChangedPaths, extractTabContextUpdates } from '../src/shared/tabContext'
import { buildAgentIdentityPrompt } from '../src/shared/agentIdentity'
import { initSessionCwd } from './cdRecentCapture'
import {
  buildContextCatalogPrompt,
  buildContextPromptDelivery,
  buildRequestedContextSections,
  extractContextSectionRequest,
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
  coordinationCanDelegate,
  formatDelegationResultFollowUp,
  isProductOwner,
} from '../src/shared/agentOrchestration'
import { captureWorkspaceSnapshot, changedWorkspacePaths } from './turnFileChanges'

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

export interface ContextDeliveryMetrics {
  catalogChars: number
  sectionsRequested: number
  sectionsDelivered: number
  sectionsPreattached: number
  annotationUpserts: number
}

const contextDeliveryMetrics: ContextDeliveryMetrics = {
  catalogChars: 0,
  sectionsRequested: 0,
  sectionsDelivered: 0,
  sectionsPreattached: 0,
  annotationUpserts: 0,
}

export function getContextDeliveryMetrics(): ContextDeliveryMetrics {
  return { ...contextDeliveryMetrics }
}

export function clearContextDeliveryMetrics(): void {
  contextDeliveryMetrics.catalogChars = 0
  contextDeliveryMetrics.sectionsRequested = 0
  contextDeliveryMetrics.sectionsDelivered = 0
  contextDeliveryMetrics.sectionsPreattached = 0
  contextDeliveryMetrics.annotationUpserts = 0
}

export function shouldForceFullContextRefresh(turnsSinceFullRefresh: number | null): boolean {
  return turnsSinceFullRefresh == null ||
    turnsSinceFullRefresh >= CONTEXT_FULL_REFRESH_INTERVAL_TURNS - 1
}

function contextSessionKey(provider: AgentCliStartRequest['provider'], cliSessionId: string): string {
  return `${provider}\0${cliSessionId}`
}

function planContextDelivery(
  request: AgentCliStartRequest,
  cwd: string,
): PlannedContextDelivery {
  const sessionKey = request.cliSessionId
    ? contextSessionKey(request.provider, request.cliSessionId)
    : null
  const previous = sessionKey ? sessionContextDeliveries.get(sessionKey) : undefined
  const forceFullRefresh = request.forceContextFullRefresh === true
    || shouldForceFullContextRefresh(
      previous?.turnsSinceFullRefresh ?? null,
    )
  const delivery = buildContextPromptDelivery(request.contexts ?? [], cwd, {
    allowAnnotationUpdates: request.autoImproveContexts === true,
    previousSnapshot: request.forceContextFullRefresh === true ? undefined : previous?.snapshot,
    forceFullRefresh,
    userPrompt: request.prompt,
    discoveredContexts: request.discoveredContexts,
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
 * Escribe las imágenes pegadas bajo `.iaterminal/clipboard-images` y
 * devuelve rutas absolutas que el CLI puede abrir con su herramienta Read.
 */
export function materializeClipboardImages(
  cwd: string,
  images: AgentCliImageAttachment[] | undefined,
): string[] {
  if (!Array.isArray(images) || images.length === 0) return []
  const dir = join(cwd, '.iaterminal', 'clipboard-images')
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

function resolveWorkingDirectory(requested: string, fallback: string): string {
  try {
    const dir = resolve(requested || fallback)
    return statSync(dir).isDirectory() ? dir : fallback
  } catch {
    return fallback
  }
}

export function composePrompt(
  request: AgentCliStartRequest,
  cwd: string,
  imagePaths: string[] = [],
  contextPrompt = buildContextCatalogPrompt(
    Array.isArray(request.contexts) ? request.contexts : [],
    cwd,
    { allowAnnotationUpdates: request.autoImproveContexts === true },
  ),
): string {
  const identityPrompt = buildAgentIdentityPrompt({
    name: request.name,
    role: request.role,
    objective: request.objective,
    rules: request.rules,
  })
  const imageSection = buildImageAttachmentSection(imagePaths)
  const userPrompt = request.prompt.trim()
    || (imagePaths.length
      ? 'Please inspect the attached image(s) and respond helpfully.'
      : '')
  const resultsInstruction = buildAiAgentResultsInstruction(request.name)
  const canDelegate = coordinationCanDelegate(request.coordination)
  const allowDelegations = request.allowDelegations !== false
  const allowedAgentIds = (request.orchestrationAgents ?? []).map(agent => agent.agentId)
  const orchestrationBlock = canDelegate
    ? [
        buildOrchestratorAgentsBlock(request.orchestrationAgents ?? []),
        '',
        isProductOwner(request.coordination)
          ? buildAiAgentProductOwnerInstruction({
            allowDelegations,
            round: request.orchestrationRound,
            maxRounds: request.orchestrationMaxRounds,
            allowedAgentIds,
          })
          : buildAiAgentDelegateInstruction({
            allowDelegations,
            round: request.orchestrationRound,
            maxRounds: request.orchestrationMaxRounds,
            allowedAgentIds,
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
    ...(contextPrompt ? [contextPrompt, ''] : []),
    ...(orchestrationBlock ? [orchestrationBlock, ''] : []),
    ...(delegationFollowUps.length ? [...delegationFollowUps, ''] : []),
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
): { command: string; args: string[] } {
  const permissionMode = request.permissionMode

  if (request.provider === 'claude') {
    const args = [
      '-p',
      prompt,
      '--output-format',
      'stream-json',
      '--verbose',
      '--include-partial-messages',
    ]
    if (cliSessionId) args.push('--resume', cliSessionId)
    // Ask: sin escritura. Claude no tiene --mode ask; en -p no hay UI de
    // confirmación, así que bloqueamos herramientas que mutan el workspace.
    if (permissionMode === 'ask') {
      args.push(
        '--disallowedTools',
        'Edit,Write,NotebookEdit,Bash,MultiEdit',
      )
    }
    if (permissionMode === 'auto') args.push('--permission-mode', 'bypassPermissions')
    if (permissionMode === 'plan') args.push('--permission-mode', 'plan')
    if (request.model?.trim()) args.push('--model', request.model.trim())
    return { command: config.agentCliClaudeCommand.trim(), args }
  }

  const args = [
    '-p',
    '--output-format',
    'stream-json',
    '--stream-partial-output',
    '--workspace',
    cwd,
  ]
  if (cliSessionId) args.push('--resume', cliSessionId)
  // Ask/Plan son solo lectura en el CLI de Cursor; sin flag, el default escribe.
  if (permissionMode === 'ask') args.push('--mode', 'ask')
  if (permissionMode === 'auto') args.push('--force')
  if (permissionMode === 'plan') args.push('--mode', 'plan')
  if (request.model?.trim()) args.push('--model', request.model.trim())
  args.push(prompt)
  return { command: config.agentCliCursorCommand.trim(), args }
}

export function startAgentTurn(
  win: BrowserWindow,
  request: AgentCliStartRequest,
  config: AppConfig,
  home: string,
): void {
  stopAgentRun(request.paneId)
  // Reserva el paneId ya: el close del proceso anterior no debe emitir EXIT
  // mientras arrancamos el turno nuevo (p. ej. durante await de cwd en el renderer).
  const generation = nextAgentRunGeneration++
  agentRuns.set(request.paneId, { proc: null, windowId: win.id, generation })
  const cwd = resolveWorkingDirectory(request.cwd, home)
  // Los paneles agente no tienen PTY; sincronizamos cwd lógico para el resto de IPC.
  if (cwd) initSessionCwd(request.paneId, cwd)
  const imagePaths = materializeClipboardImages(cwd, request.images)
  const beforeSnapshot = captureWorkspaceSnapshot(cwd)
  let latestSessionId = request.cliSessionId
  let changelogPersisted = false
  const contextDelivery = planContextDelivery(request, cwd)
  const initialPrompt = composePrompt(request, cwd, imagePaths, contextDelivery.prompt)
  let contextDeliveryCommitted = false

  const failBeforeSpawn = (message: string): void => {
    const current = agentRuns.get(request.paneId)
    if (current?.generation === generation) agentRuns.delete(request.paneId)
    send(win, request.paneId, { type: 'error', message })
    finishAgentTurn(win, request.paneId, 1)
  }

  const startPhase = (prompt: string, contextRound: number): void => {
    const { command, args } = commandAndArgs(request, config, cwd, prompt, latestSessionId)
    if (!command) {
      failBeforeSpawn('El comando del CLI no está configurado.')
      return
    }

    let proc: ChildProcessWithoutNullStreams
    try {
      proc = spawn(command, args, {
        cwd,
        env: process.env,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
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
    let stdoutBuffer = ''
    let stderrBuffer = ''
    let continuationPrompt: string | null = null
    let sawAssistantText = false
    /** Evita pegar el mismo CreatePlan dos veces (started + completed). */
    let lastCreatePlanText = ''

    const processLine = (line: string): void => {
      const trimmed = line.trim()
      if (!trimmed) return
      try {
        const value = JSON.parse(trimmed) as unknown
        const events = request.provider === 'claude'
          ? normalizeClaudeEvent(value)
          : normalizeCursorEvent(value)
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
                cwd,
                sectionRequest.requests,
                sectionRequest.errors,
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
            const contextFilteredText = filterTabContextUpdatesByChangedPaths(
              finalText,
              changedPaths,
              request.contexts ?? [],
            )
            const annotationUpdates = extractTabContextUpdates(contextFilteredText).updates
            contextDeliveryMetrics.annotationUpserts += annotationUpdates.reduce(
              (sum, update) => sum + (update.annotations?.length ?? 0),
              0,
            )
            const { visibleText: afterChangelog, changes } = extractAiChangelog(
              contextFilteredText,
              changedPaths,
            )
            if (changes.length && !changelogPersisted) {
              appendAiChangelog(cwd, changes)
              changelogPersisted = true
            }
            const { visibleText: afterResults, payload: resultsPayload } = extractAiAgentResults(
              afterChangelog,
            )
            if (
              resultsPayload
              && request.agentId?.trim()
            ) {
              const resolvedAgentId = resolveResultsAgentId(cwd, request.agentId.trim())
              upsertAiAgentResults(cwd, resolvedAgentId, resultsPayload, {
                agentName: request.name?.trim(),
              })
            }
            const { visibleText, delegations } = coordinationCanDelegate(request.coordination)
              ? extractAiAgentDelegates(afterResults)
              : { visibleText: afterResults, delegations: [] }
            if (delegations.length && request.allowDelegations !== false) {
              send(win, request.paneId, { type: 'delegate', delegations })
            }
            if (visibleText.trim()) sawAssistantText = true
            send(win, request.paneId, { ...event, text: visibleText })
          } else {
            if (event.type === 'assistant_delta' && event.text.trim()) sawAssistantText = true
            send(win, request.paneId, event)
          }
        }
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
      send(win, request.paneId, { type: 'error', message: error.message })
    })
    proc.on('close', code => {
      if (stdoutBuffer.trim()) processLine(stdoutBuffer)
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
      if (code && stderrBuffer.trim()) {
        send(win, request.paneId, {
          type: 'error',
          message: stderrBuffer.trim(),
        })
      } else if (code && !sawAssistantText) {
        send(win, request.paneId, {
          type: 'error',
          message: stderrBuffer.trim() || `El CLI terminó con código ${code}.`,
        })
      }
      finishAgentTurn(win, request.paneId, code ?? 0)
    })
  }

  startPhase(initialPrompt, 0)
}

export function isAgentRunActive(paneId: string): boolean {
  return agentRuns.has(paneId)
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

