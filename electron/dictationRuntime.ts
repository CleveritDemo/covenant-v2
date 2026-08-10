/**
 * Dictado push-to-talk vía helper nativo macOS (SFSpeechRecognizer).
 * Win/Linux: unsupported (sin Web Speech).
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { app, systemPreferences } from 'electron'
import { IPC } from '../src/shared/ipcChannels'

export type DictationErrorCode =
  | 'unsupported'
  | 'permission-denied'
  | 'start-failed'
  | 'helper-missing'
  | 'not-running'
  | 'busy'

export interface DictationStartResult {
  ok: boolean
  error?: DictationErrorCode
  message?: string
}

export interface DictationStopResult {
  ok: boolean
  text?: string
  error?: DictationErrorCode
  message?: string
}

export interface DictationAvailability {
  ok: boolean
  platform: NodeJS.Platform
  error?: DictationErrorCode
  message?: string
}

export type DictationHelperEvent =
  | { type: 'ready' }
  | { type: 'started' }
  | { type: 'partial'; text: string }
  | { type: 'final'; text: string }
  | { type: 'stopped' }
  | { type: 'error'; code: string; message: string }

export function parseDictationHelperLine(raw: string): DictationHelperEvent | null {
  const line = raw.trim()
  if (!line) return null
  try {
    const data = JSON.parse(line) as Record<string, unknown>
    const type = typeof data.type === 'string' ? data.type : ''
    switch (type) {
      case 'ready':
      case 'started':
      case 'stopped':
        return { type }
      case 'partial':
      case 'final':
        return {
          type,
          text: typeof data.text === 'string' ? data.text : '',
        }
      case 'error':
        return {
          type: 'error',
          code: typeof data.code === 'string' ? data.code : 'error',
          message: typeof data.message === 'string' ? data.message : 'error',
        }
      default:
        return null
    }
  } catch {
    return null
  }
}

export function resolveMacDictationHelperPath(
  options?: {
    resourcesPath?: string
    appPath?: string
    platform?: NodeJS.Platform
  },
): string | null {
  const platform = options?.platform ?? process.platform
  if (platform !== 'darwin') return null
  const name = 'gravity-mac-dictation'
  const resourcesPath = options?.resourcesPath
    ?? (typeof process.resourcesPath === 'string' ? process.resourcesPath : '')
  const appPath = options?.appPath
    ?? (typeof app?.getAppPath === 'function' ? app.getAppPath() : '')
  const candidates = [
    resourcesPath ? join(resourcesPath, name) : '',
    appPath ? join(appPath, '..', 'native', 'mac-dictation', name) : '',
    join(__dirname, '..', '..', 'native', 'mac-dictation', name),
    join(process.cwd(), 'native', 'mac-dictation', name),
  ].filter(Boolean)
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

export function dictationAvailabilityForPlatform(
  platform: NodeJS.Platform,
  helperPath: string | null,
): DictationAvailability {
  if (platform !== 'darwin') {
    return {
      ok: false,
      platform,
      error: 'unsupported',
      message: 'Native dictation is only supported on macOS',
    }
  }
  if (!helperPath) {
    return {
      ok: false,
      platform,
      error: 'helper-missing',
      message: 'macOS dictation helper binary not found',
    }
  }
  return { ok: true, platform }
}

type EmitFn = (channel: string, ...args: unknown[]) => void

export interface DictationRuntimeDeps {
  platform?: NodeJS.Platform
  resolveHelperPath?: () => string | null
  askMicrophoneAccess?: () => Promise<boolean>
  spawnHelper?: (helperPath: string) => ChildProcessWithoutNullStreams
  emit?: EmitFn
}

/**
 * Una sesión activa a la vez. start pide mic (Electron) + arranca el helper;
 * stop envía STOP y resuelve con el transcript final.
 */
export class DictationRuntime {
  private proc: ChildProcessWithoutNullStreams | null = null
  private stdoutBuf = ''
  private sessionActive = false
  private startWaiters: Array<(ok: boolean, error?: DictationErrorCode, message?: string) => void> = []
  private stopWaiters: Array<(text: string) => void> = []
  private lastPartial = ''
  private readonly platform: NodeJS.Platform
  private readonly resolveHelperPath: () => string | null
  private readonly askMicrophoneAccess: () => Promise<boolean>
  private readonly spawnHelper: (helperPath: string) => ChildProcessWithoutNullStreams
  private emit: EmitFn

  constructor(deps: DictationRuntimeDeps = {}) {
    this.platform = deps.platform ?? process.platform
    this.resolveHelperPath = deps.resolveHelperPath ?? (() => resolveMacDictationHelperPath())
    this.askMicrophoneAccess = deps.askMicrophoneAccess ?? (async () => {
      if (process.platform !== 'darwin') return false
      try {
        return await systemPreferences.askForMediaAccess('microphone')
      } catch {
        return false
      }
    })
    this.spawnHelper = deps.spawnHelper ?? ((helperPath: string) => spawn(helperPath, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
    }))
    this.emit = deps.emit ?? (() => {})
  }

  setEmit(emit: EmitFn): void {
    this.emit = emit
  }

  availability(): DictationAvailability {
    return dictationAvailabilityForPlatform(this.platform, this.resolveHelperPath())
  }

  async start(lang = 'en-US'): Promise<DictationStartResult> {
    const avail = this.availability()
    if (!avail.ok) {
      return { ok: false, error: avail.error, message: avail.message }
    }
    if (this.sessionActive) {
      return { ok: false, error: 'busy', message: 'Dictation already running' }
    }
    const micOk = await this.askMicrophoneAccess()
    if (!micOk) {
      return { ok: false, error: 'permission-denied', message: 'Microphone permission denied' }
    }
    const helperPath = this.resolveHelperPath()
    if (!helperPath) {
      return { ok: false, error: 'helper-missing', message: 'macOS dictation helper binary not found' }
    }

    this.ensureProcess(helperPath)
    this.lastPartial = ''
    this.sessionActive = true

    return await new Promise<DictationStartResult>(resolve => {
      const timer = setTimeout(() => {
        this.failStartWaiters('start-failed', 'Timed out starting dictation')
        this.sessionActive = false
        resolve({ ok: false, error: 'start-failed', message: 'Timed out starting dictation' })
      }, 15_000)

      this.startWaiters.push((ok, error, message) => {
        clearTimeout(timer)
        if (!ok) this.sessionActive = false
        resolve(ok
          ? { ok: true }
          : { ok: false, error: error ?? 'start-failed', message })
      })
      this.writeCommand(`START ${lang.trim() || 'en-US'}`)
    })
  }

  async stop(): Promise<DictationStopResult> {
    if (!this.sessionActive && !this.proc) {
      return { ok: false, error: 'not-running', message: 'No active dictation session' }
    }
    if (!this.proc) {
      this.sessionActive = false
      return { ok: true, text: this.lastPartial.trim() }
    }

    return await new Promise<DictationStopResult>(resolve => {
      const timer = setTimeout(() => {
        const text = this.lastPartial.trim()
        this.sessionActive = false
        this.clearStopWaiters()
        resolve({ ok: true, text })
      }, 8_000)

      this.stopWaiters.push(text => {
        clearTimeout(timer)
        this.sessionActive = false
        resolve({ ok: true, text })
      })
      this.writeCommand('STOP')
    })
  }

  dispose(): void {
    this.sessionActive = false
    this.startWaiters = []
    this.stopWaiters = []
    if (this.proc) {
      try {
        this.writeCommand('QUIT')
      } catch { /* ignore */ }
      try {
        this.proc.kill('SIGTERM')
      } catch { /* ignore */ }
      this.proc = null
    }
  }

  private ensureProcess(helperPath: string): void {
    if (this.proc && !this.proc.killed) return
    const proc = this.spawnHelper(helperPath)
    this.proc = proc
    this.stdoutBuf = ''
    proc.stdout.setEncoding('utf8')
    proc.stderr.setEncoding('utf8')
    proc.stdout.on('data', (chunk: string) => this.onStdout(chunk))
    proc.stderr.on('data', () => { /* noise */ })
    proc.on('exit', () => {
      this.proc = null
      if (this.sessionActive) {
        this.failStartWaiters('start-failed', 'Dictation helper exited')
        this.sessionActive = false
        this.emitResultError('start-failed', 'Dictation helper exited')
      }
    })
  }

  private writeCommand(line: string): void {
    this.proc?.stdin.write(`${line}\n`)
  }

  private onStdout(chunk: string): void {
    this.stdoutBuf += chunk
    let idx = this.stdoutBuf.indexOf('\n')
    while (idx >= 0) {
      const line = this.stdoutBuf.slice(0, idx)
      this.stdoutBuf = this.stdoutBuf.slice(idx + 1)
      this.handleEvent(parseDictationHelperLine(line))
      idx = this.stdoutBuf.indexOf('\n')
    }
  }

  private handleEvent(event: DictationHelperEvent | null): void {
    if (!event) return
    switch (event.type) {
      case 'ready':
        break
      case 'started':
        this.resolveStartWaiters(true)
        break
      case 'partial':
        this.lastPartial = event.text
        this.emit(IPC.DICTATION_PARTIAL, event.text)
        break
      case 'final':
        this.lastPartial = event.text
        this.resolveStopWaiters(event.text.trim())
        this.emit(IPC.DICTATION_RESULT, event.text.trim())
        break
      case 'stopped':
        if (this.stopWaiters.length) {
          this.resolveStopWaiters(this.lastPartial.trim())
        }
        break
      case 'error': {
        const code = mapHelperErrorCode(event.code)
        this.failStartWaiters(code, event.message)
        this.sessionActive = false
        this.emitResultError(code, event.message)
        break
      }
      default:
        break
    }
  }

  private resolveStartWaiters(ok: boolean, error?: DictationErrorCode, message?: string): void {
    const waiters = this.startWaiters
    this.startWaiters = []
    for (const w of waiters) w(ok, error, message)
  }

  private failStartWaiters(error: DictationErrorCode, message: string): void {
    this.resolveStartWaiters(false, error, message)
  }

  private resolveStopWaiters(text: string): void {
    const waiters = this.stopWaiters
    this.stopWaiters = []
    for (const w of waiters) w(text)
  }

  private clearStopWaiters(): void {
    this.stopWaiters = []
  }

  private emitResultError(code: DictationErrorCode, message: string): void {
    this.emit(IPC.DICTATION_ERROR, { code, message })
  }
}

function mapHelperErrorCode(code: string): DictationErrorCode {
  if (code === 'permission-denied') return 'permission-denied'
  if (code === 'unsupported') return 'unsupported'
  if (code === 'already-running') return 'busy'
  return 'start-failed'
}

let singleton: DictationRuntime | null = null

export function getDictationRuntime(): DictationRuntime {
  if (!singleton) singleton = new DictationRuntime()
  return singleton
}

export function resetDictationRuntimeForTests(): void {
  singleton?.dispose()
  singleton = null
}
