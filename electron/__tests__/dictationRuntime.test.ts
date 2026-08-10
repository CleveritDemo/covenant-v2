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
  dictationAvailabilityForPlatform,
  parseDictationHelperLine,
  resolveMacDictationHelperPath,
} from '../dictationRuntime'
import { IPC } from '../../src/shared/ipcChannels'

describe('parseDictationHelperLine', () => {
  it('parses ready/started/stopped', () => {
    expect(parseDictationHelperLine('{"type":"ready"}')).toEqual({ type: 'ready' })
    expect(parseDictationHelperLine('{"type":"started"}')).toEqual({ type: 'started' })
    expect(parseDictationHelperLine('{"type":"stopped"}')).toEqual({ type: 'stopped' })
  })

  it('parses partial and final text', () => {
    expect(parseDictationHelperLine('{"type":"partial","text":"hola"}')).toEqual({
      type: 'partial',
      text: 'hola',
    })
    expect(parseDictationHelperLine('{"type":"final","text":"hola mundo"}')).toEqual({
      type: 'final',
      text: 'hola mundo',
    })
  })

  it('parses errors and ignores garbage', () => {
    expect(parseDictationHelperLine('{"type":"error","code":"permission-denied","message":"no"}'))
      .toEqual({ type: 'error', code: 'permission-denied', message: 'no' })
    expect(parseDictationHelperLine('not-json')).toBeNull()
    expect(parseDictationHelperLine('')).toBeNull()
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
    proc.emit('exit', 0)
  }

  stdin.write = (chunk: string) => {
    const line = chunk.trim()
    if (line.startsWith('START')) {
      stdout.emit('data', `${JSON.stringify({ type: 'started' })}\n`)
    } else if (line === 'STOP') {
      stdout.emit('data', `${JSON.stringify({ type: 'final', text: 'hola gravity' })}\n`)
      stdout.emit('data', `${JSON.stringify({ type: 'stopped' })}\n`)
    } else if (line === 'QUIT') {
      proc.kill()
    }
    return true
  }

  queueMicrotask(() => {
    stdout.emit('data', `${JSON.stringify({ type: 'ready' })}\n`)
  })

  return { proc, stdout }
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

  it('starts and stops with transcript from helper', async () => {
    const { proc } = mockHelperProcess()
    const emit = vi.fn()
    const runtime = new DictationRuntime({
      platform: 'darwin',
      resolveHelperPath: () => '/tmp/gravity-mac-dictation',
      askMicrophoneAccess: async () => true,
      spawnHelper: () => proc as never,
      emit,
    })
    const started = await runtime.start('es-ES')
    expect(started.ok).toBe(true)
    const stopped = await runtime.stop()
    expect(stopped.ok).toBe(true)
    expect(stopped.text).toBe('hola gravity')
    expect(emit).toHaveBeenCalledWith(IPC.DICTATION_RESULT, 'hola gravity')
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
