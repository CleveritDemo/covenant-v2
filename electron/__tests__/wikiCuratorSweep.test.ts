import { existsSync, mkdtempSync, readdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentCliStartRequest } from '../../src/shared/agentCliTypes'
import type { AppConfig } from '../../src/shared/configSchema'
import type { WikiSweepEvent } from '../../src/shared/wikiCuratorSweep'
import { projectDirPath } from '../projectDir'
import { ensureWikiWithSeed } from '../wikiStore'
import {
  clearWikiCuratorForTests,
  startWikiCuratorTurn,
  type WikiCuratorRunner,
} from '../wikiCurator'
import {
  clearWikiSweepForTests,
  isWikiSweepRunning,
  startWikiSweep,
  stopWikiSweep,
  wikiSweepPaneId,
} from '../wikiCuratorSweep'
import * as wikiHealth from '../wikiHealth'
import * as wikiIngest from '../wikiIngest'

function fakeWindow(): import('electron').BrowserWindow {
  return {
    id: 1,
    isDestroyed: () => false,
    webContents: { send: vi.fn() },
  } as unknown as import('electron').BrowserWindow
}

describe('wikiCuratorSweep runner', () => {
  const dirs: string[] = []

  beforeEach(() => {
    clearWikiSweepForTests()
    clearWikiCuratorForTests()
  })

  afterEach(() => {
    clearWikiSweepForTests()
    clearWikiCuratorForTests()
    for (const dir of dirs.splice(0)) {
      try { rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  })

  it('rechaza un segundo start mientras corre', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-wiki-sweep-dup-'))
    dirs.push(cwd)
    expect(ensureWikiWithSeed(cwd).ok).toBe(true)

    let release: (() => void) | undefined
    const runner: WikiCuratorRunner = (_request, _config, _home, handlers) => {
      release = () => handlers.onDone(0)
    }

    const win = fakeWindow()
    const appConfig = { agentCliCommands: {} } as AppConfig
    expect(startWikiSweep(win, cwd, appConfig, '/home', { runner })).toEqual({ ok: true })
    expect(isWikiSweepRunning(cwd)).toBe(true)
    expect(startWikiSweep(win, cwd, appConfig, '/home', { runner })).toEqual({
      ok: false,
      error: 'Ya hay un barrido de wiki en curso para este proyecto.',
    })
    release?.()
  })

  it('corre los cinco pases en secuencia con paneId wiki-sweep y sesión compartida', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-wiki-sweep-seq-'))
    dirs.push(cwd)
    expect(ensureWikiWithSeed(cwd).ok).toBe(true)

    const requests: AgentCliStartRequest[] = []
    const events: WikiSweepEvent[] = []
    const win = fakeWindow()
    vi.spyOn(win.webContents, 'send').mockImplementation((_channel, _cwd, event) => {
      events.push(event as WikiSweepEvent)
    })

    const runner: WikiCuratorRunner = (request, _config, _home, handlers) => {
      requests.push(request)
      handlers.onEvent({ type: 'session', cliSessionId: 'sweep-session-1' })
      handlers.onEvent({
        type: 'assistant_final',
        text: '```ia-terminal-wiki\n{"ops":[],"log":"sweep pass"}\n```',
      })
      queueMicrotask(() => handlers.onDone(0))
    }

    const appConfig = { agentCliCommands: {} } as AppConfig
    expect(startWikiSweep(win, cwd, appConfig, '/home', { runner })).toEqual({ ok: true })

    await vi.waitFor(() => {
      expect(events.some(event => event.type === 'done')).toBe(true)
    }, { timeout: 3000 })

    expect(requests).toHaveLength(5)
    expect(requests.every(request => request.paneId === wikiSweepPaneId(cwd))).toBe(true)
    expect(requests.every(request => request.allowDelegations === false)).toBe(true)
    expect(requests.every(request => request.permissionMode === 'plan')).toBe(true)
    expect(requests[0]!.cliSessionId).toBeUndefined()
    expect(requests[1]!.cliSessionId).toBe('sweep-session-1')
    expect(requests.every(request => request.contexts?.some(ctx => ctx.kind === 'wiki'))).toBe(true)
    expect(requests.every(request => request.contexts?.some(ctx => ctx.kind === 'folderTree'))).toBe(true)
    expect(events.filter(event => event.type === 'pass_start')).toHaveLength(5)
    expect(events.filter(event => event.type === 'pass_done')).toHaveLength(5)
    const done = events.find(event => event.type === 'done')
    expect(done).toMatchObject({ type: 'done', stopped: false })
    expect(typeof (done as { snapshotPath: string | null }).snapshotPath).toBe('string')
    expect(isWikiSweepRunning(cwd)).toBe(false)
  })

  it('crea snapshot en .gravity/wiki/.snapshots antes del primer pase', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-wiki-sweep-snap-'))
    dirs.push(cwd)
    expect(ensureWikiWithSeed(cwd).ok).toBe(true)

    const win = fakeWindow()
    const runner: WikiCuratorRunner = (_request, _config, _home, handlers) => {
      queueMicrotask(() => handlers.onDone(0))
    }

    expect(startWikiSweep(win, cwd, { agentCliCommands: {} } as AppConfig, '/home', { runner })).toEqual({ ok: true })
    await vi.waitFor(() => expect(isWikiSweepRunning(cwd)).toBe(false), { timeout: 3000 })

    const snapshotsRoot = join(projectDirPath(cwd), 'wiki', '.snapshots')
    expect(existsSync(snapshotsRoot)).toBe(true)
    const snapshotDirs = readdirSync(snapshotsRoot)
    expect(snapshotDirs.length).toBeGreaterThan(0)
    const latest = join(snapshotsRoot, snapshotDirs[0]!, 'pages')
    expect(existsSync(latest)).toBe(true)
  })

  it('stopWikiSweep marca done con stopped:true', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-wiki-sweep-stop-'))
    dirs.push(cwd)
    expect(ensureWikiWithSeed(cwd).ok).toBe(true)

    const events: WikiSweepEvent[] = []
    const win = fakeWindow()
    vi.spyOn(win.webContents, 'send').mockImplementation((_channel, _cwd, event) => {
      events.push(event as WikiSweepEvent)
    })

    let pass = 0
    let unblockSecond: (() => void) | undefined
    const runner: WikiCuratorRunner = (_request, _config, _home, handlers) => {
      pass += 1
      if (pass === 1) {
        queueMicrotask(() => handlers.onDone(0))
        return
      }
      unblockSecond = () => handlers.onDone(1)
    }

    expect(startWikiSweep(win, cwd, { agentCliCommands: {} } as AppConfig, '/home', { runner })).toEqual({ ok: true })

    await vi.waitFor(() => {
      expect(events.some(event => event.type === 'pass_start' && event.pass === 'truth')).toBe(true)
    }, { timeout: 3000 })

    stopWikiSweep(cwd, win)
    unblockSecond?.()

    await vi.waitFor(() => {
      expect(events.some(event => event.type === 'done' && event.stopped)).toBe(true)
    }, { timeout: 3000 })
    expect(pass).toBe(2)
    expect(events.filter(event => event.type === 'pass_done')).toHaveLength(1)
    expect(events.filter(event => event.type === 'done')).toHaveLength(1)
    expect(isWikiSweepRunning(cwd)).toBe(false)
    expect(startWikiSweep(win, cwd, { agentCliCommands: {} } as AppConfig, '/home', { runner })).toEqual({ ok: true })
    stopWikiSweep(cwd, win)
  })

  it('stop a mitad de un pase resuelve, emite un solo done stopped y libera sweepRuns', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-wiki-sweep-stop-mid-'))
    dirs.push(cwd)
    expect(ensureWikiWithSeed(cwd).ok).toBe(true)

    const events: WikiSweepEvent[] = []
    const win = fakeWindow()
    vi.spyOn(win.webContents, 'send').mockImplementation((_channel, _cwd, event) => {
      events.push(event as WikiSweepEvent)
    })

    const runner: WikiCuratorRunner = () => {
      /* bloqueado hasta stop */
    }

    expect(startWikiSweep(win, cwd, { agentCliCommands: {} } as AppConfig, '/home', { runner })).toEqual({ ok: true })

    await vi.waitFor(() => {
      expect(events.some(event => event.type === 'pass_start' && event.pass === 'health')).toBe(true)
    }, { timeout: 3000 })

    stopWikiSweep(cwd, win)

    await vi.waitFor(() => {
      expect(events.filter(event => event.type === 'done')).toHaveLength(1)
    }, { timeout: 3000 })

    const done = events.find(event => event.type === 'done')
    expect(done).toMatchObject({ type: 'done', stopped: true })
    expect(isWikiSweepRunning(cwd)).toBe(false)
    expect(startWikiSweep(win, cwd, { agentCliCommands: {} } as AppConfig, '/home', { runner })).toEqual({ ok: true })
    stopWikiSweep(cwd, win)
  })

  it('un throw en el bucle emite error + un solo done y libera sweepRuns', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-wiki-sweep-throw-'))
    dirs.push(cwd)
    expect(ensureWikiWithSeed(cwd).ok).toBe(true)

    const events: WikiSweepEvent[] = []
    const win = fakeWindow()
    vi.spyOn(win.webContents, 'send').mockImplementation((_channel, _cwd, event) => {
      events.push(event as WikiSweepEvent)
    })

    const runner: WikiCuratorRunner = (_request, _config, _home, handlers) => {
      queueMicrotask(() => handlers.onDone(0))
    }

    vi.spyOn(wikiHealth, 'buildWikiHealthSection').mockImplementationOnce(() => {
      throw new Error('health boom')
    })

    expect(startWikiSweep(win, cwd, { agentCliCommands: {} } as AppConfig, '/home', { runner })).toEqual({ ok: true })

    await vi.waitFor(() => {
      expect(events.filter(event => event.type === 'done')).toHaveLength(1)
    }, { timeout: 3000 })

    expect(events.some(event => event.type === 'error' && event.message === 'health boom')).toBe(true)
    expect(events.filter(event => event.type === 'done')).toHaveLength(1)
    expect(isWikiSweepRunning(cwd)).toBe(false)
  })

  it('pass_done transporta los errors del ingest', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-wiki-sweep-ingest-err-'))
    dirs.push(cwd)
    expect(ensureWikiWithSeed(cwd).ok).toBe(true)

    const events: WikiSweepEvent[] = []
    const win = fakeWindow()
    vi.spyOn(win.webContents, 'send').mockImplementation((_channel, _cwd, event) => {
      events.push(event as WikiSweepEvent)
    })

    const runner: WikiCuratorRunner = (_request, _config, _home, handlers) => {
      handlers.onEvent({
        type: 'assistant_final',
        text: '```ia-terminal-wiki\n{"ops":[],"log":"sweep pass"}\n```',
      })
      queueMicrotask(() => handlers.onDone(0))
    }

    vi.spyOn(wikiIngest, 'applyWikiIngestFromFinalText').mockReturnValue({
      visibleText: '',
      applied: 0,
      errors: ['slug inválido: foo'],
      persisted: false,
    })

    expect(startWikiSweep(win, cwd, { agentCliCommands: {} } as AppConfig, '/home', { runner })).toEqual({ ok: true })

    await vi.waitFor(() => {
      expect(events.some(event => event.type === 'pass_done')).toBe(true)
    }, { timeout: 3000 })

    const passDone = events.find(event => event.type === 'pass_done')
    expect(passDone).toMatchObject({
      type: 'pass_done',
      pass: 'health',
      opsApplied: 0,
      errors: ['slug inválido: foo'],
    })
    stopWikiSweep(cwd, win)
  })
})

describe('startWikiCuratorTurn vs sweep', () => {
  const dirs: string[] = []

  beforeEach(() => {
    clearWikiSweepForTests()
    clearWikiCuratorForTests()
  })

  afterEach(() => {
    clearWikiSweepForTests()
    clearWikiCuratorForTests()
    for (const dir of dirs.splice(0)) {
      try { rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  })

  it('rechaza turno manual mientras corre el barrido', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-wiki-sweep-guard-'))
    dirs.push(cwd)
    expect(ensureWikiWithSeed(cwd).ok).toBe(true)

    const win = fakeWindow()
    const sends = vi.spyOn(win.webContents, 'send')
    const runner: WikiCuratorRunner = () => { /* bloqueado */ }

    expect(startWikiSweep(win, cwd, { agentCliCommands: {} } as AppConfig, '/home', { runner })).toEqual({ ok: true })
    const result = startWikiCuratorTurn(
      win,
      { cwd, message: 'hola' },
      { agentCliCommands: {} } as AppConfig,
      '/home',
      { runner },
    )
    expect(result).toEqual({ ok: false, error: 'Hay un barrido de wiki en curso.' })
    expect(sends).toHaveBeenCalledWith(
      expect.any(String),
      cwd,
      { type: 'error', message: 'Hay un barrido de wiki en curso.' },
    )
  })
})
