import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChildProcess } from 'child_process'

const execFileMock = vi.fn(
  (_file: string, _args: string[], _cb?: (...args: unknown[]) => void) => undefined,
)
const execFileSyncMock = vi.fn((_file: string, _args: string[], _opts?: unknown) => '')

vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process')
  return {
    ...actual,
    execFile: (...args: unknown[]) => execFileMock(...(args as [string, string[], ...unknown[]])),
    execFileSync: (...args: unknown[]) =>
      execFileSyncMock(...(args as [string, string[], unknown?])),
  }
})

import {
  collectDescendantPids,
  killProcessTree,
  killProcessTreeNow,
  type ProcRow,
} from '../processTree'

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

/** Formato `ps -Ao pid=,ppid=,pgid=` */
function psOutput(rows: ProcRow[]): string {
  return rows.map((r) => ` ${r.pid} ${r.ppid} ${r.pgid}`).join('\n') + '\n'
}

describe('collectDescendantPids', () => {
  it('tres niveles anidados: orden BFS, profundos al final', () => {
    const procs: ProcRow[] = [
      { pid: 10, ppid: 1, pgid: 10 },
      { pid: 20, ppid: 10, pgid: 20 },
      { pid: 30, ppid: 20, pgid: 30 },
    ]
    expect(collectDescendantPids(10, procs)).toEqual([20, 30])
  })

  it('incluye hermanos y excluye procesos no relacionados', () => {
    const procs: ProcRow[] = [
      { pid: 10, ppid: 1, pgid: 10 },
      { pid: 21, ppid: 10, pgid: 21 },
      { pid: 22, ppid: 10, pgid: 22 },
      { pid: 31, ppid: 21, pgid: 31 },
      { pid: 99, ppid: 1, pgid: 99 },
    ]
    expect(collectDescendantPids(10, procs)).toEqual([21, 22, 31])
  })

  it('ciclo de ppid no cuelga y no incluye 0/1', () => {
    const procs: ProcRow[] = [
      { pid: 10, ppid: 1, pgid: 10 },
      { pid: 20, ppid: 10, pgid: 20 },
      { pid: 10, ppid: 20, pgid: 10 }, // ciclo artificial (segunda fila misma pid)
      { pid: 0, ppid: 10, pgid: 0 },
      { pid: 1, ppid: 10, pgid: 1 },
    ]
    expect(collectDescendantPids(10, procs)).toEqual([20])
  })
})

describe('killProcessTree', () => {
  const originalPlatform = process.platform
  let killSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    execFileMock.mockClear()
    execFileSyncMock.mockReset()
    execFileSyncMock.mockReturnValue('')
    killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.useRealTimers()
    killSpy.mockRestore()
    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })

  it('líder de grupo recibe pid negativo; no-líder recibe positivo; descendientes antes que CLI', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    // CLI 100 (líder), shell 200 (líder), sleep 300 (no líder, pgid del shell)
    execFileSyncMock.mockReturnValue(
      psOutput([
        { pid: 100, ppid: 1, pgid: 100 },
        { pid: 200, ppid: 100, pgid: 200 },
        { pid: 300, ppid: 200, pgid: 200 },
      ]),
    )
    const proc = makeFakeProc(100)
    killProcessTree(proc)

    expect(killSpy.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      [300, 'SIGTERM'],
      [-200, 'SIGTERM'],
      [-100, 'SIGTERM'],
    ])
  })

  it('escala a SIGKILL solo pids que siguen vivos tras 3000ms', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    execFileSyncMock.mockReturnValue(
      psOutput([
        { pid: 100, ppid: 1, pgid: 100 },
        { pid: 200, ppid: 100, pgid: 200 },
      ]),
    )
    const proc = makeFakeProc(100)
    killProcessTree(proc)
    killSpy.mockClear()

    // 200 still alive; 100 dead (ESRCH on signal 0)
    killSpy.mockImplementation((pid: number, signal?: NodeJS.Signals | number) => {
      if (signal === 0) {
        if (pid === 100) throw Object.assign(new Error('gone'), { code: 'ESRCH' })
        return true
      }
      return true
    })

    vi.advanceTimersByTime(3000)
    const killCalls = killSpy.mock.calls.filter((c) => c[1] !== 0)
    expect(killCalls).toEqual([[-200, 'SIGKILL']])
  })

  it('NO escala si el proceso emitió exit antes', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    execFileSyncMock.mockReturnValue(psOutput([{ pid: 200, ppid: 1, pgid: 200 }]))
    const proc = makeFakeProc(200)
    killProcessTree(proc)
    proc.emitExit()
    killSpy.mockClear()
    vi.advanceTimersByTime(3000)
    expect(killSpy).not.toHaveBeenCalled()
  })

  it('sin fila en snapshot cae a proc.kill para el CLI', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    execFileSyncMock.mockReturnValue('')
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
    expect(execFileSyncMock).not.toHaveBeenCalled()
  })
})

describe('killProcessTreeNow', () => {
  const originalPlatform = process.platform
  let killSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    execFileMock.mockClear()
    execFileSyncMock.mockReset()
    execFileSyncMock.mockReturnValue('')
    killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.useRealTimers()
    killSpy.mockRestore()
    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })

  it('manda SIGKILL a descendientes y CLI sin timer', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    execFileSyncMock.mockReturnValue(
      psOutput([
        { pid: 700, ppid: 1, pgid: 700 },
        { pid: 710, ppid: 700, pgid: 710 },
      ]),
    )
    const proc = makeFakeProc(700)
    killProcessTreeNow(proc)
    expect(killSpy.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      [-710, 'SIGKILL'],
      [-700, 'SIGKILL'],
    ])
    vi.advanceTimersByTime(5000)
    expect(killSpy).toHaveBeenCalledTimes(2)
  })
})
