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
  signalCode: NodeJS.Signals | null
  emitExit: () => void
}

function makeFakeProc(
  pid: number,
  exitCode: number | null = null,
  signalCode: NodeJS.Signals | null = null,
): FakeProc {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>()
  const proc = {
    pid,
    exitCode,
    signalCode,
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

/** Formato `ps -Ao pid=,ppid=,pgid=,lstart=` */
function psOutput(rows: ProcRow[]): string {
  return rows.map((r) => ` ${r.pid} ${r.ppid} ${r.pgid} ${r.start}`).join('\n') + '\n'
}

const START_A = 'Fri Aug 14 12:00:00 2026'
const START_B = 'Fri Aug 14 12:01:00 2026'
const START_C = 'Fri Aug 14 12:02:00 2026'

describe('collectDescendantPids', () => {
  it('tres niveles anidados: orden BFS, profundos al final', () => {
    const procs: ProcRow[] = [
      { pid: 10, ppid: 1, pgid: 10, start: START_A },
      { pid: 20, ppid: 10, pgid: 20, start: START_B },
      { pid: 30, ppid: 20, pgid: 30, start: START_C },
    ]
    expect(collectDescendantPids(10, procs)).toEqual([20, 30])
  })

  it('incluye hermanos y excluye procesos no relacionados', () => {
    const procs: ProcRow[] = [
      { pid: 10, ppid: 1, pgid: 10, start: START_A },
      { pid: 21, ppid: 10, pgid: 21, start: START_B },
      { pid: 22, ppid: 10, pgid: 22, start: START_B },
      { pid: 31, ppid: 21, pgid: 31, start: START_C },
      { pid: 99, ppid: 1, pgid: 99, start: START_C },
    ]
    expect(collectDescendantPids(10, procs)).toEqual([21, 22, 31])
  })

  it('ciclo de ppid no cuelga y no incluye 0/1', () => {
    const procs: ProcRow[] = [
      { pid: 10, ppid: 1, pgid: 10, start: START_A },
      { pid: 20, ppid: 10, pgid: 20, start: START_B },
      { pid: 10, ppid: 20, pgid: 10, start: START_A }, // ciclo artificial (segunda fila misma pid)
      { pid: 0, ppid: 10, pgid: 0, start: START_C },
      { pid: 1, ppid: 10, pgid: 1, start: START_C },
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

  it('señala pids positivos deepest-first (nunca negativos); descendientes antes que CLI', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    execFileSyncMock.mockReturnValue(
      psOutput([
        { pid: 100, ppid: 1, pgid: 100, start: START_A },
        { pid: 200, ppid: 100, pgid: 200, start: START_B },
        { pid: 300, ppid: 200, pgid: 200, start: START_C },
      ]),
    )
    const proc = makeFakeProc(100)
    killProcessTree(proc)

    expect(killSpy.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      [300, 'SIGTERM'],
      [200, 'SIGTERM'],
      [100, 'SIGTERM'],
    ])
    expect(killSpy.mock.calls.every((c) => typeof c[0] === 'number' && (c[0] as number) > 0)).toBe(
      true,
    )
  })

  it('nunca emite señal con pid negativo en ninguna ruta', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    const initial = psOutput([
      { pid: 100, ppid: 1, pgid: 100, start: START_A },
      { pid: 200, ppid: 100, pgid: 200, start: START_B },
    ])
    execFileSyncMock.mockReturnValue(initial)
    const proc = makeFakeProc(100)
    killProcessTree(proc)
    vi.advanceTimersByTime(3000)
    killProcessTreeNow(makeFakeProc(100))

    for (const call of killSpy.mock.calls) {
      expect(call[0] as number).toBeGreaterThan(0)
    }
  })

  it('escala a SIGKILL solo si pid+start coinciden en snapshot fresco', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    const initial = [
      { pid: 100, ppid: 1, pgid: 100, start: START_A },
      { pid: 200, ppid: 100, pgid: 200, start: START_B },
    ]
    execFileSyncMock.mockReturnValue(psOutput(initial))
    const proc = makeFakeProc(100)
    killProcessTree(proc)
    killSpy.mockClear()

    // Escalación: 200 sigue vivo con mismo start; 100 ya no está
    execFileSyncMock.mockReturnValue(
      psOutput([{ pid: 200, ppid: 1, pgid: 200, start: START_B }]),
    )

    vi.advanceTimersByTime(3000)
    expect(killSpy.mock.calls).toEqual([[200, 'SIGKILL']])
    // Sin probe kill(pid, 0)
    expect(killSpy.mock.calls.every((c) => c[1] !== 0)).toBe(true)
  })

  it('pid reciclado (mismo pid, start distinto) no recibe SIGKILL', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    execFileSyncMock.mockReturnValue(
      psOutput([
        { pid: 100, ppid: 1, pgid: 100, start: START_A },
        { pid: 200, ppid: 100, pgid: 200, start: START_B },
      ]),
    )
    const proc = makeFakeProc(100)
    killProcessTree(proc)
    killSpy.mockClear()

    execFileSyncMock.mockReturnValue(
      psOutput([
        { pid: 200, ppid: 1, pgid: 200, start: 'Sat Aug 15 09:00:00 2026' }, // reciclado
      ]),
    )

    vi.advanceTimersByTime(3000)
    expect(killSpy).not.toHaveBeenCalled()
  })

  it('no señala process.pid ni ancestros aunque aparezcan como descendientes', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    const selfPid = process.pid
    const ancestorPid = 50
    // Ancestría real primero (self → 50 → 1); luego self/50 aparecen bajo root 100
    execFileSyncMock.mockReturnValue(
      psOutput([
        { pid: selfPid, ppid: ancestorPid, pgid: selfPid, start: START_B },
        { pid: ancestorPid, ppid: 1, pgid: ancestorPid, start: START_C },
        { pid: 100, ppid: 1, pgid: 100, start: START_A },
        { pid: 200, ppid: 100, pgid: 200, start: START_B },
        { pid: selfPid, ppid: 100, pgid: selfPid, start: START_B },
        { pid: ancestorPid, ppid: 100, pgid: ancestorPid, start: START_C },
      ]),
    )
    const proc = makeFakeProc(100)
    killProcessTree(proc)

    const signaled = killSpy.mock.calls.map((c) => c[0] as number)
    expect(signaled).not.toContain(selfPid)
    expect(signaled).not.toContain(ancestorPid)
    expect(signaled).not.toContain(0)
    expect(signaled).not.toContain(1)
    expect(signaled).toEqual([200, 100])
  })

  it('ChildProcess con signalCode SIGTERM se trata como muerto (cero señales)', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    execFileSyncMock.mockReturnValue(
      psOutput([
        { pid: 100, ppid: 1, pgid: 100, start: START_A },
        { pid: 200, ppid: 100, pgid: 200, start: START_B },
      ]),
    )
    const proc = makeFakeProc(100, null, 'SIGTERM')
    killProcessTree(proc)
    killProcessTreeNow(proc)
    expect(killSpy).not.toHaveBeenCalled()
    expect(proc.kill).not.toHaveBeenCalled()
    expect(execFileSyncMock).not.toHaveBeenCalled()
  })

  it('NO escala si el proceso emitió exit antes', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    execFileSyncMock.mockReturnValue(
      psOutput([{ pid: 200, ppid: 1, pgid: 200, start: START_A }]),
    )
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

  it('descendiente sin fila en snapshot no se señala', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    // Solo el root; collectDescendantPids no verá hijos. Si hubiera un hijo
    // listado vía ppid pero sin fila propia no aplica — aquí verificamos que
    // sin filas de hijos no hay kill a pids inventados.
    execFileSyncMock.mockReturnValue(
      psOutput([{ pid: 100, ppid: 1, pgid: 100, start: START_A }]),
    )
    const proc = makeFakeProc(100)
    killProcessTree(proc)
    expect(killSpy.mock.calls.map((c) => [c[0], c[1]])).toEqual([[100, 'SIGTERM']])
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

  it('snapshotProcs usa lstart= en el argv de ps', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    execFileSyncMock.mockReturnValue(
      psOutput([{ pid: 100, ppid: 1, pgid: 100, start: START_A }]),
    )
    killProcessTree(makeFakeProc(100))
    expect(execFileSyncMock).toHaveBeenCalledWith(
      'ps',
      ['-Ao', 'pid=,ppid=,pgid=,lstart='],
      expect.any(Object),
    )
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

  it('manda SIGKILL a descendientes y CLI sin timer (pids positivos)', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    execFileSyncMock.mockReturnValue(
      psOutput([
        { pid: 700, ppid: 1, pgid: 700, start: START_A },
        { pid: 710, ppid: 700, pgid: 710, start: START_B },
      ]),
    )
    const proc = makeFakeProc(700)
    killProcessTreeNow(proc)
    expect(killSpy.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      [710, 'SIGKILL'],
      [700, 'SIGKILL'],
    ])
    vi.advanceTimersByTime(5000)
    expect(killSpy).toHaveBeenCalledTimes(2)
  })
})
