import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentCliStartRequest } from '../../src/shared/agentCliTypes'
import type { AppConfig } from '../../src/shared/configSchema'
import { applyWikiIngest, ensureWikiWithSeed } from '../wikiStore'
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

  it('inyecta Wiki health en el prompt cuando el lint encuentra hallazgos', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-wiki-curator-lint-'))
    dirs.push(cwd)
    expect(ensureWikiWithSeed(cwd).ok).toBe(true)
    // `pkg/` existe (ancla la ruta) pero missing.ts no: debe acusarse muerta.
    mkdirSync(join(cwd, 'pkg'), { recursive: true })
    const ingest = applyWikiIngest(cwd, {
      ops: [{
        op: 'upsert',
        slug: 'stale-page',
        title: 'Stale page',
        type: 'concept',
        body: 'Apunta a [[nope]] y cita `pkg/missing.ts`.',
      }],
      log: 'seed lint',
    }, { agentId: 'test' })
    expect(ingest.ok).toBe(true)

    const requests: AgentCliStartRequest[] = []
    const runner: WikiCuratorRunner = (request, _config, _home, handlers) => {
      requests.push(request)
      handlers.onDone(0)
    }

    expect(startWikiCuratorTurn(
      fakeWindow(),
      { cwd, message: 'estado de la wiki' },
      { agentCliCommands: {} } as AppConfig,
      '/home',
      { runner },
    )).toEqual({ ok: true })
    const prompt = requests[0]!.prompt
    expect(prompt).toContain('## Wiki health')
    expect(prompt).toContain('- orphan page: [[stale-page]]')
    expect(prompt).toContain('- broken link: [[stale-page]] → [[nope]]')
    expect(prompt).toContain('- dead file path in [[stale-page]]: `pkg/missing.ts`')
  })

  it('no reporta rutas que viven en una subcarpeta de primer nivel (monorepo)', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-wiki-curator-mono-'))
    dirs.push(cwd)
    expect(ensureWikiWithSeed(cwd).ok).toBe(true)
    // La page cita `pkg/alive.ts`, que existe bajo cwd/app-x/pkg/alive.ts.
    mkdirSync(join(cwd, 'app-x', 'pkg'), { recursive: true })
    writeFileSync(join(cwd, 'app-x', 'pkg', 'alive.ts'), 'export {}\n')
    const ingest = applyWikiIngest(cwd, {
      ops: [{
        op: 'upsert',
        slug: 'mono-page',
        title: 'Mono page',
        type: 'concept',
        body: 'Cita `pkg/alive.ts` viva en subcarpeta y `unknown-root/deep.ts` sin anclaje.',
      }],
      log: 'seed mono',
    }, { agentId: 'test' })
    expect(ingest.ok).toBe(true)

    const requests: AgentCliStartRequest[] = []
    const runner: WikiCuratorRunner = (request, _config, _home, handlers) => {
      requests.push(request)
      handlers.onDone(0)
    }

    expect(startWikiCuratorTurn(
      fakeWindow(),
      { cwd, message: 'estado' },
      { agentCliCommands: {} } as AppConfig,
      '/home',
      { runner },
    )).toEqual({ ok: true })
    const prompt = requests[0]!.prompt
    expect(prompt).not.toContain('dead file path')
    // mono-page sigue siendo huérfana, así que la sección existe por eso.
    expect(prompt).toContain('- orphan page: [[mono-page]]')
  })

  it('con la wiki sana el prompt no lleva sección Wiki health', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-wiki-curator-sana-'))
    dirs.push(cwd)
    expect(ensureWikiWithSeed(cwd).ok).toBe(true)

    const requests: AgentCliStartRequest[] = []
    const runner: WikiCuratorRunner = (request, _config, _home, handlers) => {
      requests.push(request)
      handlers.onDone(0)
    }

    expect(startWikiCuratorTurn(
      fakeWindow(),
      { cwd, message: 'hola' },
      { agentCliCommands: {} } as AppConfig,
      '/home',
      { runner },
    )).toEqual({ ok: true })
    expect(requests[0]!.prompt).not.toContain('## Wiki health')
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

  it('mensaje /init produce prompt con Init mode; mensaje normal no', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-wiki-curator-init-'))
    dirs.push(cwd)
    expect(ensureWikiWithSeed(cwd).ok).toBe(true)

    const requests: AgentCliStartRequest[] = []
    const runner: WikiCuratorRunner = (request, _config, _home, handlers) => {
      requests.push(request)
      handlers.onDone(0)
    }

    expect(startWikiCuratorTurn(
      fakeWindow(),
      { cwd, message: '/init' },
      { agentCliCommands: {} } as AppConfig,
      '/home',
      { runner },
    )).toEqual({ ok: true })
    expect(requests[0]!.prompt).toContain('## Init mode')

    requests.length = 0
    expect(startWikiCuratorTurn(
      fakeWindow(),
      { cwd, message: 'hola' },
      { agentCliCommands: {} } as AppConfig,
      '/home',
      { runner },
    )).toEqual({ ok: true })
    expect(requests[0]!.prompt).not.toContain('## Init mode')
  })
})
