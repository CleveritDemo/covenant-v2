import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentCliStartRequest } from '../../src/shared/agentCliTypes'
import type { AppConfig } from '../../src/shared/configSchema'
import { projectDirPath } from '../projectDir'
import { applyWikiIngest, ensureWikiWithSeed, wikiRootPath } from '../wikiStore'
import {
  clearWikiCuratorForTests,
  applyWikiCuratorConfigToApp,
  maybeMigrateWikiCuratorFromProject,
  startWikiCuratorTurn,
  stopWikiCuratorTurn,
  writeWikiCuratorConfig,
  type WikiCuratorRunner,
} from '../wikiCurator'
import { isWikiCuratorActive } from '../wikiCuratorActive'

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

  it('usa el provider de AppConfig.wikiCurator cuando está configurado', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-wiki-curator-prov-'))
    dirs.push(cwd)
    expect(ensureWikiWithSeed(cwd).ok).toBe(true)

    const requests: AgentCliStartRequest[] = []
    const runner: WikiCuratorRunner = (request, _config, _home, handlers) => {
      requests.push(request)
      handlers.onDone(0)
    }

    const appConfig = {
      agentCliCommands: {},
      wikiCurator: { provider: 'cursor' as const, model: 'auto' },
    } as AppConfig

    const result = startWikiCuratorTurn(
      fakeWindow(),
      { cwd, message: 'lista pages' },
      appConfig,
      '/home',
      { runner },
    )

    expect(result).toEqual({ ok: true })
    expect(requests).toHaveLength(1)
    expect(requests[0]!.provider).toBe('cursor')
    expect(requests[0]!.model).toBe('auto')
    expect(requests[0]!.permissionMode).toBe('plan')
  })

  it('cae a claude cuando AppConfig.wikiCurator no trae provider', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-wiki-curator-fb-'))
    dirs.push(cwd)
    expect(ensureWikiWithSeed(cwd).ok).toBe(true)

    const requests: AgentCliStartRequest[] = []
    const runner: WikiCuratorRunner = (request, _config, _home, handlers) => {
      requests.push(request)
      handlers.onDone(0)
    }

    const appConfig = {
      agentCliCommands: {},
      wikiCurator: { name: 'Solo nombre' },
    } as AppConfig

    const result = startWikiCuratorTurn(
      fakeWindow(),
      { cwd, message: 'hola' },
      appConfig,
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

  it('/init incluye contextos wiki y folderTree del discover', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-wiki-curator-ctx-'))
    dirs.push(cwd)
    expect(ensureWikiWithSeed(cwd).ok).toBe(true)
    writeFileSync(
      join(projectDirPath(cwd), 'folders.md'),
      '<!-- iaterminal:context {"version":1,"id":"iaterminal:folderTree","name":"folders","fileName":"folders.md","kind":"folderTree"} -->\n',
      'utf8',
    )

    const chatRequests: AgentCliStartRequest[] = []
    const initRequests: AgentCliStartRequest[] = []
    const runner: WikiCuratorRunner = (request, _config, _home, handlers) => {
      if (request.prompt.includes('## Init mode')) initRequests.push(request)
      else chatRequests.push(request)
      handlers.onDone(0)
    }

    expect(startWikiCuratorTurn(
      fakeWindow(),
      { cwd, message: 'hola' },
      { agentCliCommands: {} } as AppConfig,
      '/home',
      { runner },
    )).toEqual({ ok: true })
    expect(chatRequests[0]!.contexts.every(c => c.kind === 'wiki')).toBe(true)
    expect(chatRequests[0]!.contexts.some(c => c.kind === 'folderTree')).toBe(false)

    expect(startWikiCuratorTurn(
      fakeWindow(),
      { cwd, message: '/init' },
      { agentCliCommands: {} } as AppConfig,
      '/home',
      { runner },
    )).toEqual({ ok: true })
    const initKinds = initRequests[0]!.contexts.map(c => c.kind).sort()
    expect(initKinds).toEqual(['folderTree', 'wiki'])
  })

  it('/init sin wiki previa crea árbol mínimo y arranca el turno', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-wiki-curator-no-wiki-'))
    dirs.push(cwd)

    const requests: AgentCliStartRequest[] = []
    const runner: WikiCuratorRunner = (request, _config, _home, handlers) => {
      requests.push(request)
      handlers.onDone(0)
    }

    const result = startWikiCuratorTurn(
      fakeWindow(),
      { cwd, message: '/init' },
      { agentCliCommands: {} } as AppConfig,
      '/home',
      { runner },
    )

    expect(result).toEqual({ ok: true })
    expect(requests).toHaveLength(1)
    expect(requests[0]!.prompt).toContain('## Init mode')
    expect(requests[0]!.contexts.some(c => c.kind === 'wiki')).toBe(true)
    expect(requests[0]!.contexts.some(c => c.kind === 'folderTree')).toBe(true)
  })

  it('turno manual sin init deja creado el árbol wiki/pages al terminar', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-wiki-curator-manual-tree-'))
    dirs.push(cwd)

    const runner: WikiCuratorRunner = (_request, _config, _home, handlers) => {
      queueMicrotask(() => handlers.onDone(0))
    }

    expect(startWikiCuratorTurn(
      fakeWindow(),
      { cwd, message: 'hola' },
      { agentCliCommands: {} } as AppConfig,
      '/home',
      { runner },
    )).toEqual({ ok: true })

    await vi.waitFor(() => {
      expect(existsSync(join(wikiRootPath(cwd), 'pages'))).toBe(true)
    }, { timeout: 3000 })
  })
})

describe('wikiCurator active registry', () => {
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

  it('marca y desmarca el registro al terminar el turno', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-wiki-curator-active-done-'))
    dirs.push(cwd)
    expect(ensureWikiWithSeed(cwd).ok).toBe(true)

    const runner: WikiCuratorRunner = (_request, _config, _home, handlers) => {
      queueMicrotask(() => handlers.onDone(0))
    }

    expect(isWikiCuratorActive(cwd)).toBe(false)
    expect(startWikiCuratorTurn(
      fakeWindow(),
      { cwd, message: 'hola' },
      { agentCliCommands: {} } as AppConfig,
      '/home',
      { runner },
    )).toEqual({ ok: true })
    expect(isWikiCuratorActive(cwd)).toBe(true)

    await vi.waitFor(() => expect(isWikiCuratorActive(cwd)).toBe(false), { timeout: 3000 })
  })

  it('desmarca el registro al parar el turno', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-wiki-curator-active-stop-'))
    dirs.push(cwd)
    expect(ensureWikiWithSeed(cwd).ok).toBe(true)

    const runner: WikiCuratorRunner = () => { /* bloqueado */ }
    const win = fakeWindow()

    expect(startWikiCuratorTurn(
      win,
      { cwd, message: 'hola' },
      { agentCliCommands: {} } as AppConfig,
      '/home',
      { runner },
    )).toEqual({ ok: true })
    expect(isWikiCuratorActive(cwd)).toBe(true)

    stopWikiCuratorTurn(cwd, win)
    expect(isWikiCuratorActive(cwd)).toBe(false)
  })
})

describe('wikiCurator AppConfig helpers', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      try { rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  })

  it('maybeMigrateWikiCuratorFromProject copia curator.json cuando AppConfig está vacío', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-wiki-curator-mig-'))
    dirs.push(cwd)
    expect(ensureWikiWithSeed(cwd).ok).toBe(true)
    expect(writeWikiCuratorConfig(cwd, { provider: 'cursor', model: 'composer-2.5' }).ok).toBe(true)

    const appConfig = { agentCliCommands: {}, wikiCurator: {} } as AppConfig
    const result = maybeMigrateWikiCuratorFromProject(cwd, appConfig)

    expect(result.migrated).toBe(true)
    expect(result.config).toEqual({ provider: 'cursor', model: 'composer-2.5' })
    expect(result.appConfig.wikiCurator).toEqual({ provider: 'cursor', model: 'composer-2.5' })
  })

  it('maybeMigrateWikiCuratorFromProject no migra si AppConfig ya tiene curador', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-wiki-curator-no-mig-'))
    dirs.push(cwd)
    expect(ensureWikiWithSeed(cwd).ok).toBe(true)
    expect(writeWikiCuratorConfig(cwd, { provider: 'claude', model: 'opus' }).ok).toBe(true)

    const appConfig = {
      agentCliCommands: {},
      wikiCurator: { provider: 'cursor', model: 'auto' },
    } as AppConfig
    const result = maybeMigrateWikiCuratorFromProject(cwd, appConfig)

    expect(result.migrated).toBe(false)
    expect(result.config).toEqual({ provider: 'cursor', model: 'auto' })
  })

  it('applyWikiCuratorConfigToApp sanitiza y devuelve AppConfig actualizado', () => {
    const appConfig = { agentCliCommands: {}, wikiCurator: {} } as AppConfig
    const applied = applyWikiCuratorConfigToApp(appConfig, {
      name: 'Wiki TL',
      provider: 'cursor',
      model: 'auto',
      rules: ['corta'],
    })

    expect(applied.config).toEqual({
      name: 'Wiki TL',
      provider: 'cursor',
      model: 'auto',
      rules: ['corta'],
    })
    expect(applied.appConfig.wikiCurator).toEqual(applied.config)
  })
})
