import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChildProcess } from 'child_process'

const execFileMock = vi.fn(
  (_file: string, _args: string[], _cb?: (...args: unknown[]) => void) => undefined,
)

vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process')
  return {
    ...actual,
    execFile: (...args: unknown[]) => execFileMock(...(args as [string, string[], ...unknown[]])),
  }
})

import { killProcessTree, killProcessTreeNow } from '../processTree'

type FakeProc = ChildProcess & {
  exitCode: number | null
  emitExit: () => void
}

function makeFakeProc(pid: number, exitCode: number | null = null): FakeProc {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>()
  const proc = {
    pid,
    exitCode,
    kill: vi.fn(),
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      const list = listeners.get(event) ?? []
      list.push(cb)
      listeners.set(event, list)
      return proc
    }),
    emitExit: () => {
      proc.exitCode = 0
      for (const cb of listeners.get('exit') ?? []) cb(0)
    },
  }
  return proc as unknown as FakeProc
}

describe('killProcessTree', () => {
  const originalPlatform = process.platform
  let killSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    execFileMock.mockClear()
    killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.useRealTimers()
    killSpy.mockRestore()
    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })

  it('posix manda SIGTERM al grupo con pid negativo', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    const proc = makeFakeProc(4242)
    killProcessTree(proc)
    expect(killSpy).toHaveBeenCalledWith(-4242, 'SIGTERM')
  })

  it('escala a SIGKILL al grupo tras 3000ms', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    const proc = makeFakeProc(100)
    killProcessTree(proc)
    killSpy.mockClear()
    vi.advanceTimersByTime(3000)
    expect(killSpy).toHaveBeenCalledWith(-100, 'SIGKILL')
  })

  it('NO escala si el proceso emitió exit antes', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    const proc = makeFakeProc(200)
    killProcessTree(proc)
    proc.emitExit()
    killSpy.mockClear()
    vi.advanceTimersByTime(3000)
    expect(killSpy).not.toHaveBeenCalled()
  })

  it('ESRCH en el kill de grupo cae al proc.kill', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    const err = Object.assign(new Error('No such process'), { code: 'ESRCH' })
    killSpy.mockImplementation(() => {
      throw err
    })
    const proc = makeFakeProc(300)
    killProcessTree(proc)
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM')
  })

  it('win32 usa taskkill con /T y /F', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' })
    const proc = makeFakeProc(500)
    killProcessTree(proc)
    expect(execFileMock).toHaveBeenCalledWith(
      'taskkill',
      ['/pid', '500', '/T', '/F'],
      expect.any(Function),
    )
    expect(killSpy).not.toHaveBeenCalled()
  })
})

describe('killProcessTreeNow', () => {
  const originalPlatform = process.platform
  let killSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    execFileMock.mockClear()
    killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.useRealTimers()
    killSpy.mockRestore()
    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })

  it('manda SIGKILL sin esperar', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    const proc = makeFakeProc(700)
    killProcessTreeNow(proc)
    expect(killSpy).toHaveBeenCalledWith(-700, 'SIGKILL')
    expect(killSpy).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(5000)
    expect(killSpy).toHaveBeenCalledTimes(1)
  })
})
