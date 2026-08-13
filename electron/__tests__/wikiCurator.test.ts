import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentCliStartRequest } from '../../src/shared/agentCliTypes'
import type { AppConfig } from '../../src/shared/configSchema'
import { ensureWikiWithSeed } from '../wikiStore'
import {
  clearWikiCuratorForTests,
  startWikiCuratorTurn,
  writeWikiCuratorConfig,
  type WikiCuratorRunner,
} from '../wikiCurator'

function fakeWindow(): import('electron').BrowserWindow {
  return {
    id: 1,
    isDestroyed: () => false,
    webContents: { send: vi.fn() },
  } as unknown as import('electron').BrowserWindow
}

describe('startWikiCuratorTurn provider', () => {
  const dirs: string[] = []

  beforeEach(() => {
    clearWikiCuratorForTests()
  })

  afterEach(() => {
    clearWikiCuratorForTests()
    for (const dir of dirs.splice(0)) {
      try { rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  })

  it('usa el provider de curator.json cuando está configurado', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-wiki-curator-prov-'))
    dirs.push(cwd)
    expect(ensureWikiWithSeed(cwd).ok).toBe(true)
    expect(writeWikiCuratorConfig(cwd, { provider: 'cursor', model: 'auto' }).ok).toBe(true)

    const requests: AgentCliStartRequest[] = []
    const runner: WikiCuratorRunner = (request, _config, _home, handlers) => {
      requests.push(request)
      handlers.onDone(0)
    }

    const result = startWikiCuratorTurn(
      fakeWindow(),
      { cwd, message: 'lista pages' },
      { agentCliCommands: {} } as AppConfig,
      '/home',
      { runner },
    )

    expect(result).toEqual({ ok: true })
    expect(requests).toHaveLength(1)
    expect(requests[0]!.provider).toBe('cursor')
    expect(requests[0]!.model).toBe('auto')
    expect(requests[0]!.permissionMode).toBe('plan')
  })

  it('cae a claude cuando curator.json no trae provider', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-wiki-curator-fb-'))
    dirs.push(cwd)
    expect(ensureWikiWithSeed(cwd).ok).toBe(true)
    expect(writeWikiCuratorConfig(cwd, { name: 'Solo nombre' }).ok).toBe(true)

    const requests: AgentCliStartRequest[] = []
    const runner: WikiCuratorRunner = (request, _config, _home, handlers) => {
      requests.push(request)
      handlers.onDone(0)
    }

    const result = startWikiCuratorTurn(
      fakeWindow(),
      { cwd, message: 'hola' },
      { agentCliCommands: {} } as AppConfig,
      '/home',
      { runner },
    )

    expect(result).toEqual({ ok: true })
    expect(requests).toHaveLength(1)
    expect(requests[0]!.provider).toBe('claude')
  })

  it('acepta turno solo con imagen y la pasa al runner', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-wiki-curator-img-'))
    dirs.push(cwd)
    expect(ensureWikiWithSeed(cwd).ok).toBe(true)

    const requests: AgentCliStartRequest[] = []
    const runner: WikiCuratorRunner = (request, _config, _home, handlers) => {
      requests.push(request)
      handlers.onDone(0)
    }

    const image = {
      name: 'paste-1.png',
      mimeType: 'image/png',
      base64: 'aaaa',
    }
    const result = startWikiCuratorTurn(
      fakeWindow(),
      { cwd, message: '', images: [image] },
      { agentCliCommands: {} } as AppConfig,
      '/home',
      { runner },
    )

    expect(result).toEqual({ ok: true })
    expect(requests).toHaveLength(1)
    expect(requests[0]!.images).toEqual([image])
    expect(requests[0]!.prompt).toContain('(imagen adjunta)')
  })
})
