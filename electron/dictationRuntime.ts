/**
 * Dictado push-to-talk vía helper nativo macOS (SFSpeechRecognizer).
 * Win/Linux: unsupported (sin Web Speech).
 *
 * Contrato STOP (helper → DictationStopResult):
 * - Texto no vacío → `{ ok: true, text, peak }`
 * - Texto vacío + peak bajo umbral → `{ ok: false, error: 'no-audio', peak }`
 *   (mic silencioso / input equivocado; no es “no speech”)
 * - Texto vacío + peak OK → `{ ok: true, text: '', peak }`
 *   (renderer mapea a no-speech; hubo buffers audibles pero ASR sin palabras)
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { app, systemPreferences } from 'electron'
import { IPC } from '../src/shared/ipcChannels'
import { appendCrashDiagnostics } from './crashLog'
import type { DictationPermissionResult } from '../src/shared/dictation'
import {
  emptyDictationBands,
  normalizeDictationBands,
  type DictationLevelPayload,
} from '../src/shared/dictationSpectrum'

/** Espejo de `silencePeakThreshold` en native/mac-dictation/main.swift */
export const DICTATION_SILENCE_PEAK_THRESHOLD = 0.008

export type DictationErrorCode =
  | 'unsupported'
  | 'permission-denied'
  | 'start-failed'
  | 'audio-failed'
  | 'no-audio'
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
  /** Pico abs. de sesión (PCM float) reportado por el helper. */
  peak?: number
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
  | { type: 'level'; peak: number; bands: number[] }
  | { type: 'final'; text: string; peak?: number }
  | { type: 'stopped' }
  | { type: 'error'; code: string; message: string; peak?: number }

export function parseDictationHelperLine(raw: string): DictationHelperEvent | null {
  const line = raw.trim()
  if (!line) return null
  try {
    const data = JSON.parse(line) as Record<string, unknown>
    const type = typeof data.type === 'string' ? data.type : ''
    const peak = typeof data.peak === 'number' && Number.isFinite(data.peak)
      ? data.peak
      : undefined
    switch (type) {
      case 'ready':
      case 'started':
      case 'stopped':
        return { type }
      case 'partial':
        return {
          type,
          text: typeof data.text === 'string' ? data.text : '',
        }
      case 'level':
        if (peak === undefined) return null
        return {
          type: 'level',
          peak,
          bands: normalizeDictationBands(data.bands),
        }
      case 'final':
        return {
          type,
          text: typeof data.text === 'string' ? data.text : '',
          ...(peak !== undefined ? { peak } : {}),
        }
      case 'error': {
        const parsedPeak = peak ?? parsePeakFromMessage(
          typeof data.message === 'string' ? data.message : '',
        )
        return {
          type: 'error',
          code: typeof data.code === 'string' ? data.code : 'error',
          message: typeof data.message === 'string' ? data.message : 'error',
          ...(parsedPeak !== undefined ? { peak: parsedPeak } : {}),
        }
      }
      default:
        return null
    }
  } catch {
    return null
  }
}

/** Extrae `peak=0.123` del mensaje de error del helper. */
export function parsePeakFromMessage(message: string): number | undefined {
  const match = /peak=([0-9]*\.?[0-9]+)/i.exec(message)
  if (!match) return undefined
  const value = Number(match[1])
  return Number.isFinite(value) ? value : undefined
}

/** true si el pico está por debajo del umbral de silencio (espejo Swift). */
export function isSilentDictationPeak(
  peak: number,
  threshold = DICTATION_SILENCE_PEAK_THRESHOLD,
): boolean {
  return !Number.isFinite(peak) || peak < threshold
}

/**
 * Clasifica resultado vacío de STOP: no-audio vs no-speech vs ok.
 * El helper ya decide en producción; esta función documenta/testea el umbral.
 */
export function classifyEmptyDictationStop(
  text: string,
  peak: number | undefined,
): 'ok' | 'no-audio' | 'no-speech' {
  if (text.trim()) return 'ok'
  if (peak !== undefined && isSilentDictationPeak(peak)) return 'no-audio'
  return 'no-speech'
}

/** Heurística de formato válido (espejo del guard Swift). */
export function isValidDictationAudioFormat(sampleRate: number, channelCount: number): boolean {
  return Number.isFinite(sampleRate)
    && Number.isFinite(channelCount)
    && sampleRate > 0
    && channelCount > 0
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
  private stderrBuf = ''
  private helperReady = false
  private readyWaiters: Array<() => void> = []
  private sessionActive = false
  private startWaiters: Array<(ok: boolean, error?: DictationErrorCode, message?: string) => void> = []
  private stopWaiters: Array<(result: DictationStopResult) => void> = []
  private lastPartial = ''
  private lastPeak: number | undefined
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

  /** Últimas líneas de stderr del helper (diagnóstico). */
  lastHelperStderr(): string {
    return this.stderrBuf.trim()
  }

  availability(): DictationAvailability {
    return dictationAvailabilityForPlatform(this.platform, this.resolveHelperPath())
  }

  async requestMicrophoneAccess(): Promise<DictationPermissionResult> {
    if (this.platform !== 'darwin') {
      return { ok: false, error: 'unsupported', message: 'Microphone permission is only supported on macOS' }
    }
    const micOk = await this.askMicrophoneAccess()
    if (!micOk) {
      return { ok: false, error: 'permission-denied', message: 'Microphone permission denied' }
    }
    return { ok: true }
  }

  async start(lang = 'en-US'): Promise<DictationStartResult> {
    const avail = this.availability()
    if (!avail.ok) {
      return { ok: false, error: avail.error, message: avail.message }
    }
    if (this.sessionActive) {
      return { ok: false, error: 'busy', message: 'Dictation already running' }
    }
    const permission = await this.requestMicrophoneAccess()
    if (!permission.ok) {
      return {
        ok: false,
        error: permission.error === 'unsupported' ? 'unsupported' : 'permission-denied',
        message: permission.message,
      }
    }
    const helperPath = this.resolveHelperPath()
    if (!helperPath) {
      return { ok: false, error: 'helper-missing', message: 'macOS dictation helper binary not found' }
    }

    try {
      await this.ensureProcessReady(helperPath)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Dictation helper failed to become ready'
      const stderr = this.lastHelperStderr()
      return {
        ok: false,
        error: 'start-failed',
        message: stderr ? `${message}; stderr: ${stderr}` : message,
      }
    }

    this.lastPartial = ''
    this.lastPeak = undefined
    this.sessionActive = true

    return await new Promise<DictationStartResult>(resolve => {
      const timer = setTimeout(() => {
        const stderr = this.lastHelperStderr()
        const message = stderr
          ? `Timed out starting dictation; stderr: ${stderr}`
          : 'Timed out starting dictation'
        this.failStartWaiters('start-failed', message)
        this.sessionActive = false
        resolve({ ok: false, error: 'start-failed', message })
      }, 15_000)

      this.startWaiters.push((ok, error, message) => {
        clearTimeout(timer)
        if (!ok) this.sessionActive = false
        const detail = !ok && this.lastHelperStderr()
          ? `${message ?? error ?? 'start-failed'}; stderr: ${this.lastHelperStderr()}`
          : message
        resolve(ok
          ? { ok: true }
          : { ok: false, error: error ?? 'start-failed', message: detail })
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
      return { ok: true, text: this.lastPartial.trim(), peak: this.lastPeak }
    }

    return await new Promise<DictationStopResult>(resolve => {
      const timer = setTimeout(() => {
        const text = this.lastPartial.trim()
        this.sessionActive = false
        this.clearStopWaiters()
        resolve({ ok: true, text, peak: this.lastPeak })
      }, 2_500)

      this.stopWaiters.push(result => {
        clearTimeout(timer)
        this.sessionActive = false
        if (!result.ok) {
          resolve(result)
          return
        }
        const finalText = (result.text?.trim() || this.lastPartial).trim()
        resolve({
          ok: true,
          text: finalText,
          peak: result.peak ?? this.lastPeak,
        })
      })
      this.writeCommand('STOP')
    })
  }

  dispose(): void {
    this.sessionActive = false
    this.helperReady = false
    this.readyWaiters = []
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

  private async ensureProcessReady(helperPath: string): Promise<void> {
    if (this.proc && !this.proc.killed && this.helperReady) return
    if (!this.proc || this.proc.killed) {
      this.spawnProcess(helperPath)
    }
    if (this.helperReady) return
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Timed out waiting for dictation helper ready'))
      }, 8_000)
      this.readyWaiters.push(() => {
        clearTimeout(timer)
        resolve()
      })
    })
  }

  private spawnProcess(helperPath: string): void {
    const proc = this.spawnHelper(helperPath)
    this.proc = proc
    this.stdoutBuf = ''
    this.stderrBuf = ''
    this.helperReady = false
    proc.stdout.setEncoding('utf8')
    proc.stderr.setEncoding('utf8')
    proc.stdout.on('data', (chunk: string) => this.onStdout(chunk))
    proc.stderr.on('data', (chunk: string) => {
      this.stderrBuf = `${this.stderrBuf}${chunk}`.slice(-4000)
    })
    // Sin este listener, un fallo de spawn (helper ausente, sin permisos de
    // ejecución, quarantine de macOS) emite `'error'` sobre un EventEmitter sin
    // oyente: excepción no capturada en main y la app entera se cierra al
    // pulsar el micrófono. Con `'error'` no siempre llega `'exit'`, así que el
    // cierre de la sesión se hace aquí también.
    proc.on('error', error => {
      const detail = `Dictation helper failed to spawn: ${
        error instanceof Error ? error.message : String(error)
      }`
      appendCrashDiagnostics('dictation-helper-error', { helperPath, detail })
      if (this.proc === proc) this.proc = null
      this.helperReady = false
      if (this.sessionActive || this.startWaiters.length) {
        this.failStartWaiters('start-failed', detail)
        this.sessionActive = false
        this.emitResultError('start-failed', detail)
      }
    })
    proc.on('exit', (code, signal) => {
      this.proc = null
      this.helperReady = false
      if (this.sessionActive || this.startWaiters.length) {
        const stderr = this.lastHelperStderr()
        const detail = [
          `Dictation helper exited (code=${code ?? '?'}${signal ? ` signal=${signal}` : ''})`,
          stderr ? `stderr: ${stderr}` : '',
        ].filter(Boolean).join('; ')
        // Crash de AVAudioEngine / abort → start-failed o audio-failed según stderr.
        const codeName = /audio|AVAudio|format|prepare|installTap/i.test(stderr)
          ? 'audio-failed' as const
          : 'start-failed' as const
        this.failStartWaiters(codeName, detail)
        this.sessionActive = false
        this.emitResultError(codeName, detail)
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
        this.helperReady = true
        for (const w of this.readyWaiters.splice(0, this.readyWaiters.length)) w()
        break
      case 'started':
        this.resolveStartWaiters(true)
        break
      case 'partial':
        this.lastPartial = event.text
        this.emit(IPC.DICTATION_PARTIAL, event.text)
        break
      case 'level':
        this.emit(IPC.DICTATION_LEVEL, {
          peak: event.peak,
          bands: event.bands.length > 0 ? event.bands : emptyDictationBands(),
        } satisfies DictationLevelPayload)
        break
      case 'final': {
        if (event.peak !== undefined) this.lastPeak = event.peak
        const text = (event.text.trim() || this.lastPartial).trim()
        this.lastPartial = text
        this.resolveStopWaiters({ ok: true, text, peak: event.peak ?? this.lastPeak })
        this.emit(IPC.DICTATION_RESULT, text)
        break
      }
      case 'stopped':
        if (this.stopWaiters.length) {
          this.resolveStopWaiters({
            ok: true,
            text: this.lastPartial.trim(),
            peak: this.lastPeak,
          })
        }
        break
      case 'error': {
        const code = mapHelperErrorCode(event.code)
        const message = this.lastHelperStderr()
          ? `${event.message}; stderr: ${this.lastHelperStderr()}`
          : event.message
        if (event.peak !== undefined) this.lastPeak = event.peak
        // no-audio (y similares) llegan en STOP: resolver stopWaiters, no start.
        if (this.stopWaiters.length && (code === 'no-audio' || !this.startWaiters.length)) {
          this.resolveStopWaiters({
            ok: false,
            error: code,
            message,
            peak: event.peak ?? this.lastPeak,
          })
          this.sessionActive = false
          this.emitResultError(code, message)
          break
        }
        this.failStartWaiters(code, message)
        this.sessionActive = false
        this.emitResultError(code, message)
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

  private resolveStopWaiters(result: DictationStopResult): void {
    const waiters = this.stopWaiters
    this.stopWaiters = []
    for (const w of waiters) w(result)
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
  if (code === 'audio-failed') return 'audio-failed'
  if (code === 'no-audio') return 'no-audio'
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
