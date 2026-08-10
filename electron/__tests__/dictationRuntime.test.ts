import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getAppPath: () => '/tmp/app',
  },
  systemPreferences: {
    askForMediaAccess: vi.fn(async () => true),
  },
}))

import { EventEmitter } from 'events'
import {
  DictationRuntime,
  DICTATION_SILENCE_PEAK_THRESHOLD,
  classifyEmptyDictationStop,
  dictationAvailabilityForPlatform,
  isSilentDictationPeak,
  isValidDictationAudioFormat,
  parseDictationHelperLine,
  parsePeakFromMessage,
  resolveMacDictationHelperPath,
} from '../dictationRuntime'
import { IPC } from '../../src/shared/ipcChannels'

describe('parseDictationHelperLine', () => {
  it('parses ready/started/stopped', () => {
    expect(parseDictationHelperLine('{"type":"ready"}')).toEqual({ type: 'ready' })
    expect(parseDictationHelperLine('{"type":"started"}')).toEqual({ type: 'started' })
    expect(parseDictationHelperLine('{"type":"stopped"}')).toEqual({ type: 'stopped' })
  })

  it('parses partial and final text with optional peak', () => {
    expect(parseDictationHelperLine('{"type":"partial","text":"hola"}')).toEqual({
      type: 'partial',
      text: 'hola',
    })
    expect(parseDictationHelperLine('{"type":"final","text":"hola mundo","peak":0.42}')).toEqual({
      type: 'final',
      text: 'hola mundo',
      peak: 0.42,
    })
  })

  it('parses level peaks and rejects level without peak', () => {
    expect(parseDictationHelperLine('{"type":"level","peak":0.12}')).toEqual({
      type: 'level',
      peak: 0.12,
    })
    expect(parseDictationHelperLine('{"type":"level"}')).toBeNull()
  })

  it('parses errors including no-audio peak in message', () => {
    expect(parseDictationHelperLine('{"type":"error","code":"permission-denied","message":"no"}'))
      .toEqual({ type: 'error', code: 'permission-denied', message: 'no' })
    expect(parseDictationHelperLine('{"type":"error","code":"audio-failed","message":"bad format"}'))
      .toEqual({ type: 'error', code: 'audio-failed', message: 'bad format' })
    expect(parseDictationHelperLine(
      '{"type":"error","code":"no-audio","message":"no-audio peak=0.000120 threshold=0.008000"}',
    )).toEqual({
      type: 'error',
      code: 'no-audio',
      message: 'no-audio peak=0.000120 threshold=0.008000',
      peak: 0.00012,
    })
    expect(parseDictationHelperLine('not-json')).toBeNull()
    expect(parseDictationHelperLine('')).toBeNull()
  })
})

describe('silence / energy helpers', () => {
  it('parsePeakFromMessage extracts peak=', () => {
    expect(parsePeakFromMessage('no-audio peak=0.001234 threshold=0.008')).toBeCloseTo(0.001234)
    expect(parsePeakFromMessage('no peak here')).toBeUndefined()
  })

  it('isSilentDictationPeak uses Swift threshold mirror', () => {
    expect(DICTATION_SILENCE_PEAK_THRESHOLD).toBe(0.008)
    expect(isSilentDictationPeak(0)).toBe(true)
    expect(isSilentDictationPeak(0.007)).toBe(true)
    expect(isSilentDictationPeak(0.008)).toBe(false)
    expect(isSilentDictationPeak(0.2)).toBe(false)
    expect(isSilentDictationPeak(NaN)).toBe(true)
  })

  it('classifyEmptyDictationStop distinguishes no-audio vs no-speech', () => {
    expect(classifyEmptyDictationStop('hola', 0)).toBe('ok')
    expect(classifyEmptyDictationStop('', 0.001)).toBe('no-audio')
    expect(classifyEmptyDictationStop('', 0.05)).toBe('no-speech')
    expect(classifyEmptyDictationStop('  ', undefined)).toBe('no-speech')
  })
})

describe('isValidDictationAudioFormat', () => {
  it('rejects zero/invalid rate or channels', () => {
    expect(isValidDictationAudioFormat(0, 1)).toBe(false)
    expect(isValidDictationAudioFormat(48000, 0)).toBe(false)
    expect(isValidDictationAudioFormat(NaN, 2)).toBe(false)
  })

  it('accepts positive rate and channels', () => {
    expect(isValidDictationAudioFormat(48000, 1)).toBe(true)
    expect(isValidDictationAudioFormat(44100, 2)).toBe(true)
  })
})

describe('dictationAvailabilityForPlatform', () => {
  it('rejects non-darwin with unsupported', () => {
    expect(dictationAvailabilityForPlatform('win32', '/x')).toMatchObject({
      ok: false,
      error: 'unsupported',
    })
    expect(dictationAvailabilityForPlatform('linux', null)).toMatchObject({
      ok: false,
      error: 'unsupported',
    })
  })

  it('rejects darwin without helper', () => {
    expect(dictationAvailabilityForPlatform('darwin', null)).toMatchObject({
      ok: false,
      error: 'helper-missing',
    })
  })

  it('accepts darwin with helper path', () => {
    expect(dictationAvailabilityForPlatform('darwin', '/bin/helper')).toEqual({
      ok: true,
      platform: 'darwin',
    })
  })
})

describe('resolveMacDictationHelperPath', () => {
  it('returns null on non-darwin', () => {
    expect(resolveMacDictationHelperPath({ platform: 'linux' })).toBeNull()
  })
})

function mockHelperProcess() {
  const stdout = new EventEmitter() as EventEmitter & {
    setEncoding: (enc: string) => void
  }
  const stderr = new EventEmitter() as EventEmitter & {
    setEncoding: (enc: string) => void
  }
  stdout.setEncoding = () => {}
  stderr.setEncoding = () => {}
  const stdin = new EventEmitter() as EventEmitter & {
    write: (chunk: string) => boolean
  }
  const writes: string[] = []
  const proc = new EventEmitter() as EventEmitter & {
    stdout: typeof stdout
    stderr: typeof stderr
    stdin: typeof stdin
    killed: boolean
    kill: (sig?: string) => void
  }
  proc.stdout = stdout
  proc.stderr = stderr
  proc.stdin = stdin
  proc.killed = false
  proc.kill = () => {
    proc.killed = true
    proc.emit('exit', 0, null)
  }

  stdin.write = (chunk: string) => {
    writes.push(chunk)
    const line = chunk.trim()
    if (line.startsWith('START')) {
      stdout.emit('data', `${JSON.stringify({ type: 'started' })}\n`)
    } else if (line === 'STOP') {
      stdout.emit('data', `${JSON.stringify({ type: 'final', text: 'hola gravity', peak: 0.31 })}\n`)
      stdout.emit('data', `${JSON.stringify({ type: 'stopped' })}\n`)
    } else if (line === 'QUIT') {
      proc.kill()
    }
    return true
  }

  const emitReady = (): void => {
    stdout.emit('data', `${JSON.stringify({ type: 'ready' })}\n`)
  }

  /** Simula spawn: ready solo después de que el runtime ya escucha stdout. */
  const spawn = (): typeof proc => {
    queueMicrotask(emitReady)
    return proc
  }

  return { proc, stdout, stderr, writes, emitReady, spawn }
}

describe('DictationRuntime', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns unsupported on windows without spawning', async () => {
    const spawnHelper = vi.fn()
    const runtime = new DictationRuntime({
      platform: 'win32',
      resolveHelperPath: () => '/fake',
      spawnHelper,
      askMicrophoneAccess: async () => true,
    })

    const start = await runtime.start('es-ES')
    expect(start.ok).toBe(false)
    expect(start.error).toBe('unsupported')
    expect(spawnHelper).not.toHaveBeenCalled()
  })

  it('requestMicrophoneAccess reports denied without spawning helper', async () => {
    const spawnHelper = vi.fn()
    const runtime = new DictationRuntime({
      platform: 'darwin',
      resolveHelperPath: () => '/fake',
      spawnHelper,
      askMicrophoneAccess: async () => false,
    })
    await expect(runtime.requestMicrophoneAccess()).resolves.toMatchObject({
      ok: false,
      error: 'permission-denied',
    })
    expect(spawnHelper).not.toHaveBeenCalled()
  })

  it('waits for helper ready before sending START', async () => {
    const { writes, emitReady, proc } = mockHelperProcess()
    const runtime = new DictationRuntime({
      platform: 'darwin',
      resolveHelperPath: () => '/tmp/gravity-mac-dictation',
      askMicrophoneAccess: async () => true,
      spawnHelper: () => {
        setTimeout(emitReady, 30)
        return proc as never
      },
    })
    const started = runtime.start('es-ES')
    await new Promise(r => setTimeout(r, 5))
    expect(writes.some(w => w.startsWith('START'))).toBe(false)
    await expect(started).resolves.toMatchObject({ ok: true })
    expect(writes.some(w => w.startsWith('START'))).toBe(true)
    runtime.dispose()
  })

  it('starts and stops with transcript from helper', async () => {
    const { spawn } = mockHelperProcess()
    const emit = vi.fn()
    const runtime = new DictationRuntime({
      platform: 'darwin',
      resolveHelperPath: () => '/tmp/gravity-mac-dictation',
      askMicrophoneAccess: async () => true,
      spawnHelper: () => spawn() as never,
      emit,
    })
    const started = await runtime.start('es-ES')
    expect(started.ok).toBe(true)
    const stopped = await runtime.stop()
    expect(stopped.ok).toBe(true)
    expect(stopped.text).toBe('hola gravity')
    expect(stopped.peak).toBe(0.31)
    expect(emit).toHaveBeenCalledWith(IPC.DICTATION_RESULT, 'hola gravity')
    runtime.dispose()
  })

  it('emits DICTATION_LEVEL for live helper level events', async () => {
    const { proc, stdout, spawn } = mockHelperProcess()
    proc.stdin.write = (chunk: string) => {
      const line = chunk.trim()
      if (line.startsWith('START')) {
        stdout.emit('data', `${JSON.stringify({ type: 'started' })}\n`)
        stdout.emit('data', `${JSON.stringify({ type: 'level', peak: 0.11 })}\n`)
        stdout.emit('data', `${JSON.stringify({ type: 'level', peak: 0.28 })}\n`)
      } else if (line === 'STOP') {
        stdout.emit('data', `${JSON.stringify({ type: 'final', text: 'ok', peak: 0.28 })}\n`)
        stdout.emit('data', `${JSON.stringify({ type: 'stopped' })}\n`)
      }
      return true
    }
    const emit = vi.fn()
    const runtime = new DictationRuntime({
      platform: 'darwin',
      resolveHelperPath: () => '/tmp/gravity-mac-dictation',
      askMicrophoneAccess: async () => true,
      spawnHelper: () => spawn() as never,
      emit,
    })
    await runtime.start('es-ES')
    expect(emit).toHaveBeenCalledWith(IPC.DICTATION_LEVEL, 0.11)
    expect(emit).toHaveBeenCalledWith(IPC.DICTATION_LEVEL, 0.28)
    await runtime.stop()
    runtime.dispose()
  })

  it('uses lastPartial when final text is empty but peak is audible', async () => {
    const { proc, stdout, spawn } = mockHelperProcess()
    proc.stdin.write = (chunk: string) => {
      const line = chunk.trim()
      if (line.startsWith('START')) {
        stdout.emit('data', `${JSON.stringify({ type: 'started' })}\n`)
        stdout.emit('data', `${JSON.stringify({ type: 'partial', text: 'desde partial' })}\n`)
      } else if (line === 'STOP') {
        stdout.emit('data', `${JSON.stringify({ type: 'final', text: '', peak: 0.22 })}\n`)
        stdout.emit('data', `${JSON.stringify({ type: 'stopped' })}\n`)
      }
      return true
    }
    const runtime = new DictationRuntime({
      platform: 'darwin',
      resolveHelperPath: () => '/tmp/gravity-mac-dictation',
      askMicrophoneAccess: async () => true,
      spawnHelper: () => spawn() as never,
    })
    await runtime.start('es-ES')
    const stopped = await runtime.stop()
    expect(stopped.ok).toBe(true)
    expect(stopped.text).toBe('desde partial')
    expect(stopped.peak).toBe(0.22)
    runtime.dispose()
  })

  it('maps no-audio on STOP when helper reports silent peak', async () => {
    const { proc, stdout, stderr, spawn } = mockHelperProcess()
    proc.stdin.write = (chunk: string) => {
      const line = chunk.trim()
      if (line.startsWith('START')) {
        stdout.emit('data', `${JSON.stringify({ type: 'started' })}\n`)
      } else if (line === 'STOP') {
        stderr.emit('data', '[mac-dictation] stop done reason=timeout chars=0 peak=0.000100 code=no-audio\n')
        stdout.emit('data', `${JSON.stringify({
          type: 'error',
          code: 'no-audio',
          message: 'no-audio peak=0.000100 threshold=0.008000',
        })}\n`)
        stdout.emit('data', `${JSON.stringify({ type: 'stopped' })}\n`)
      }
      return true
    }
    const emit = vi.fn()
    const runtime = new DictationRuntime({
      platform: 'darwin',
      resolveHelperPath: () => '/tmp/gravity-mac-dictation',
      askMicrophoneAccess: async () => true,
      spawnHelper: () => spawn() as never,
      emit,
    })
    await runtime.start('es-ES')
    const stopped = await runtime.stop()
    expect(stopped.ok).toBe(false)
    expect(stopped.error).toBe('no-audio')
    expect(stopped.peak).toBeCloseTo(0.0001)
    expect(stopped.message).toMatch(/peak=/)
    expect(emit).toHaveBeenCalledWith(
      IPC.DICTATION_ERROR,
      expect.objectContaining({ code: 'no-audio' }),
    )
    runtime.dispose()
  })

  it('empty final with audible peak stays ok (renderer → no-speech)', async () => {
    const { proc, stdout, spawn } = mockHelperProcess()
    proc.stdin.write = (chunk: string) => {
      const line = chunk.trim()
      if (line.startsWith('START')) {
        stdout.emit('data', `${JSON.stringify({ type: 'started' })}\n`)
      } else if (line === 'STOP') {
        stdout.emit('data', `${JSON.stringify({ type: 'final', text: '', peak: 0.15 })}\n`)
        stdout.emit('data', `${JSON.stringify({ type: 'stopped' })}\n`)
      }
      return true
    }
    const runtime = new DictationRuntime({
      platform: 'darwin',
      resolveHelperPath: () => '/tmp/gravity-mac-dictation',
      askMicrophoneAccess: async () => true,
      spawnHelper: () => spawn() as never,
    })
    await runtime.start('es-ES')
    const stopped = await runtime.stop()
    expect(stopped.ok).toBe(true)
    expect(stopped.text).toBe('')
    expect(stopped.peak).toBe(0.15)
    expect(classifyEmptyDictationStop(stopped.text ?? '', stopped.peak)).toBe('no-speech')
    runtime.dispose()
  })

  it('maps audio-failed helper error and includes stderr', async () => {
    const { proc, stdout, stderr, spawn } = mockHelperProcess()
    proc.stdin.write = (chunk: string) => {
      if (chunk.trim().startsWith('START')) {
        stderr.emit('data', '[mac-dictation] invalid input format rate=0 channels=0\n')
        stdout.emit('data', `${JSON.stringify({
          type: 'error',
          code: 'audio-failed',
          message: 'invalid audio input format',
        })}\n`)
      }
      return true
    }
    const runtime = new DictationRuntime({
      platform: 'darwin',
      resolveHelperPath: () => '/tmp/gravity-mac-dictation',
      askMicrophoneAccess: async () => true,
      spawnHelper: () => spawn() as never,
    })
    const start = await runtime.start('es-ES')
    expect(start.ok).toBe(false)
    expect(start.error).toBe('audio-failed')
    expect(start.message).toMatch(/stderr:/)
    expect(runtime.lastHelperStderr()).toMatch(/invalid input format/)
    runtime.dispose()
  })

  it('maps helper crash during start to audio-failed when stderr mentions AVAudio', async () => {
    const { proc, stderr, spawn } = mockHelperProcess()
    proc.stdin.write = (chunk: string) => {
      if (chunk.trim().startsWith('START')) {
        stderr.emit('data', '[mac-dictation] engine.start NSException: AVAudioEngineGraph\n')
        queueMicrotask(() => proc.emit('exit', null, 'SIGABRT'))
      }
      return true
    }
    const runtime = new DictationRuntime({
      platform: 'darwin',
      resolveHelperPath: () => '/tmp/gravity-mac-dictation',
      askMicrophoneAccess: async () => true,
      spawnHelper: () => spawn() as never,
    })
    const start = await runtime.start('es-ES')
    expect(start.ok).toBe(false)
    expect(start.error).toBe('audio-failed')
    expect(start.message).toMatch(/stderr:/)
    runtime.dispose()
  })

  it('maps mic denial to permission-denied', async () => {
    const runtime = new DictationRuntime({
      platform: 'darwin',
      resolveHelperPath: () => '/tmp/helper',
      askMicrophoneAccess: async () => false,
      spawnHelper: vi.fn(),
    })
    const start = await runtime.start()
    expect(start).toMatchObject({ ok: false, error: 'permission-denied' })
  })
})
