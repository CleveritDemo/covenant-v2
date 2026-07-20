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
  upsertAiAgentResults,
} from './aiAgentResults'
import { captureWorkspaceSnapshot, changedWorkspacePaths } from './turnFileChanges'

interface AgentRun {
  proc: ChildProcessWithoutNullStreams | null
  windowId: number
}

const agentRuns = new Map<string, AgentRun>()

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
  const forceFullRefresh = shouldForceFullContextRefresh(
    previous?.turnsSinceFullRefresh ?? null,
  )
  const delivery = buildContextPromptDelivery(request.contexts ?? [], cwd, {
    allowAnnotationUpdates: request.autoImproveContexts === true,
    previousSnapshot: previous?.snapshot,
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
    const tool = obj.tool_call && typeof obj.tool_call === 'object'
      ? Object.keys(obj.tool_call as Record<string, unknown>)[0]
      : undefined
    out.push({
      type: 'tool',
      name: tool ?? 'tool',
      status,
    })
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
  })
  const imageSection = buildImageAttachmentSection(imagePaths)
  const userPrompt = request.prompt.trim()
    || (imagePaths.length
      ? 'Please inspect the attached image(s) and respond helpfully.'
      : '')
  const resultsInstruction = request.emitResults === true
    ? buildAiAgentResultsInstruction(request.name)
    : ''
  return [
    ...(identityPrompt ? [identityPrompt, ''] : []),
    ...(contextPrompt ? [contextPrompt, ''] : []),
    ...(imageSection ? [imageSection] : []),
    '## User request',
    userPrompt,
    '',
    buildAiChangelogInstruction(),
    ...(resultsInstruction ? ['', resultsInstruction] : []),
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
    if (request.permissionMode === 'ask') {
      args.push(
        '--disallowedTools',
        'Edit,Write,NotebookEdit,Bash,MultiEdit',
      )
    }
    if (request.permissionMode === 'auto') args.push('--permission-mode', 'bypassPermissions')
    if (request.permissionMode === 'plan') args.push('--permission-mode', 'plan')
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
  if (request.permissionMode === 'ask') args.push('--mode', 'ask')
  if (request.permissionMode === 'auto') args.push('--force')
  if (request.permissionMode === 'plan') args.push('--mode', 'plan')
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
  agentRuns.set(request.paneId, { proc: null, windowId: win.id })
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
    agentRuns.delete(request.paneId)
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

    agentRuns.set(request.paneId, { proc, windowId: win.id })
    let stdoutBuffer = ''
    let stderrBuffer = ''
    let continuationPrompt: string | null = null
    let sawAssistantText = false

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
          if (continuationPrompt &&
              (event.type === 'assistant_delta' || event.type === 'assistant_final')) {
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
            const { visibleText, payload: resultsPayload } = extractAiAgentResults(afterChangelog)
            if (
              resultsPayload
              && request.emitResults === true
              && request.name?.trim()
            ) {
              upsertAiAgentResults(cwd, request.name.trim(), resultsPayload)
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
      const phaseStillActive = current?.proc === proc
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
        agentRuns.set(request.paneId, { proc: null, windowId: win.id })
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

export function stopAgentRun(paneId: string): void {
  const run = agentRuns.get(paneId)
  if (!run) return
  agentRuns.delete(paneId)
  try { run.proc?.kill('SIGTERM') } catch { /* already exited */ }
}

export function stopAgentRunsForWindow(windowId: number): void {
  for (const [paneId, run] of agentRuns) {
    if (run.windowId === windowId) stopAgentRun(paneId)
  }
}

