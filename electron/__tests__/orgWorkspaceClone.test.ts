import { EventEmitter } from 'events'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const spawnMock = vi.fn()

vi.mock('child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}))

import {
  buildWorkspaceDir,
  cloneOrgWorkspace,
  lastPathSegment,
  sanitizeSlug,
} from '../orgWorkspaceClone'

function mockChild(opts?: { stdout?: string; stderr?: string; code?: number }): EventEmitter & {
  stderr: EventEmitter
  stdout: EventEmitter
} {
  const child = new EventEmitter() as EventEmitter & {
    stderr: EventEmitter
    stdout: EventEmitter
  }
  child.stderr = new EventEmitter()
  child.stdout = new EventEmitter()
  queueMicrotask(() => {
    if (opts?.stdout) child.stdout.emit('data', Buffer.from(opts.stdout))
    if (opts?.stderr) child.stderr.emit('data', Buffer.from(opts.stderr))
    child.emit('close', opts?.code ?? 0)
  })
  return child
}

function mockSpawnSuccess(): void {
  spawnMock.mockImplementation((_cmd: unknown, args: string[]) => {
    if (args.includes('config') && args.includes('remote.origin.url')) {
      return mockChild({ stdout: 'https://github.com/owner/repo-a.git\n' })
    }
    return mockChild()
  })
}

function mockSpawnFail(stderr: string, code = 1): void {
  spawnMock.mockImplementation(() => mockChild({ stderr, code }))
}

/** Responde origin por destino según el path `-C` del git config. */
function mockSpawnWithOrigins(originsByDest: Record<string, string>): void {
  spawnMock.mockImplementation((_cmd: unknown, args: string[]) => {
    if (args[0] === '-C' && args.includes('config')) {
      const dest = args[1] ?? ''
      const origin = originsByDest[dest]
      if (origin === undefined) return mockChild({ code: 1, stderr: 'missing' })
      return mockChild({ stdout: `${origin}\n` })
    }
    return mockChild()
  })
}

describe('sanitizeSlug', () => {
  it('acepta slugs seguros', () => {
    expect(sanitizeSlug('acme-org')).toBe('acme-org')
    expect(sanitizeSlug('Team_1.0')).toBe('Team_1.0')
  })

  it('rechaza path traversal y caracteres inválidos', () => {
    expect(sanitizeSlug('../evil')).toBeNull()
    expect(sanitizeSlug('a/b')).toBeNull()
    expect(sanitizeSlug('a\\b')).toBeNull()
    expect(sanitizeSlug('..')).toBeNull()
    expect(sanitizeSlug('')).toBeNull()
    expect(sanitizeSlug('has space')).toBeNull()
  })
})

describe('path helpers', () => {
  it('buildWorkspaceDir une base/org/workspace', () => {
    expect(buildWorkspaceDir('/tmp/ws', 'org', 'team')).toBe(join('/tmp/ws', 'org', 'team'))
  })

  it('lastPathSegment toma el nombre del repo', () => {
    expect(lastPathSegment('owner/repo')).toBe('repo')
    expect(lastPathSegment('owner/repo.git')).toBe('repo.git')
  })
})

describe('cloneOrgWorkspace', () => {
  const dirs: string[] = []
  const tempDir = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'org-ws-clone-'))
    dirs.push(dir)
    return dir
  }

  beforeEach(() => {
    spawnMock.mockReset()
  })

  afterEach(() => {
    dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true }))
  })

  it('crea rutas sanitizadas y skipea repos con .git existente', async () => {
    const base = tempDir()
    const workspaceDir = join(base, 'org', 'ws')
    const dest = join(workspaceDir, 'repo-a')
    mkdirSync(join(dest, '.git'), { recursive: true })
    mockSpawnWithOrigins({
      [dest]: 'https://github.com/owner/repo-a.git',
    })

    const result = await cloneOrgWorkspace({
      baseDir: base,
      orgSlug: 'org',
      workspaceSlug: 'ws',
      token: 'secret-token',
      repos: [
        { repoFullName: 'owner/repo-a', cloneUrl: 'https://github.com/owner/repo-a.git' },
        { repoFullName: 'owner/repo-b', cloneUrl: 'https://github.com/owner/repo-b.git' },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.workspaceDir).toBe(workspaceDir)
    expect(result.skipped).toEqual(['owner/repo-a'])
    expect(result.cloned).toEqual(['owner/repo-b'])
    expect(spawnMock).toHaveBeenCalledTimes(3)
    const cloneCall = spawnMock.mock.calls.find(c => (c[1] as string[]).includes('clone'))
    expect(cloneCall).toBeTruthy()
    const args = cloneCall?.[1] as string[]
    expect(args.join(' ')).not.toContain('secret-token')
    expect(args.some(a => a.startsWith('http.extraHeader=AUTHORIZATION: basic '))).toBe(true)
  })

  it('aborta en fallo de clone sin filtrar el token en el error', async () => {
    const base = tempDir()
    mockSpawnFail('auth failed for secret-token user')

    const result = await cloneOrgWorkspace({
      baseDir: base,
      orgSlug: 'org',
      workspaceSlug: 'ws',
      token: 'secret-token',
      repos: [{ repoFullName: 'owner/x', cloneUrl: 'https://github.com/owner/x.git' }],
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('owner/x')
    expect(result.error).not.toContain('secret-token')
    expect(result.error).toContain('***')
    expect(result.failure?.kind).toBeTruthy()
    expect(result.failure?.raw).toContain('***')
    expect(result.failure?.raw).not.toContain('secret-token')
    expect(result.failure?.repoFullName).toBe('owner/x')
  })

  it('rechaza orgSlug inseguro antes de mkdir', async () => {
    const base = tempDir()
    const result = await cloneOrgWorkspace({
      baseDir: base,
      orgSlug: '../escape',
      workspaceSlug: 'ws',
      token: 't',
      repos: [],
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('invalid-org-slug')
    expect(result.failure).toEqual({ kind: 'invalid-config', raw: 'invalid-org-slug' })
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('marca skip cuando .git es archivo (worktree) y el origin coincide', async () => {
    const base = tempDir()
    const dest = join(base, 'org', 'ws', 'repo')
    mkdirSync(dest, { recursive: true })
    writeFileSync(join(dest, '.git'), 'gitdir: /tmp/elsewhere\n')
    mockSpawnWithOrigins({
      [dest]: 'https://github.com/o/repo.git',
    })

    const result = await cloneOrgWorkspace({
      baseDir: base,
      orgSlug: 'org',
      workspaceSlug: 'ws',
      token: 'tok',
      repos: [{ repoFullName: 'o/repo', cloneUrl: 'https://github.com/o/repo.git' }],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.skipped).toEqual(['o/repo'])
    expect(result.cloned).toEqual([])
    expect(spawnMock).toHaveBeenCalledTimes(1)
    expect((spawnMock.mock.calls[0]?.[1] as string[]).includes('config')).toBe(true)
  })

  it('usa folderName personalizado como carpeta destino', async () => {
    const base = tempDir()
    mockSpawnSuccess()

    const result = await cloneOrgWorkspace({
      baseDir: base,
      orgSlug: 'org',
      workspaceSlug: 'ws',
      token: 'tok',
      repos: [{
        repoFullName: 'owner/repo-a',
        cloneUrl: 'https://github.com/owner/repo-a.git',
        folderName: 'custom-dir',
      }],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.cloned).toEqual(['owner/repo-a'])
    expect(spawnMock).toHaveBeenCalledTimes(1)
    const args = spawnMock.mock.calls[0]?.[1] as string[]
    expect(args[args.length - 1]).toBe(join(base, 'org', 'ws', 'custom-dir'))
  })

  it('skipea instalado por folderName y no busca el nombre remoto', async () => {
    const base = tempDir()
    const workspaceDir = join(base, 'org', 'ws')
    const customDest = join(workspaceDir, 'custom-dir')
    mkdirSync(join(customDest, '.git'), { recursive: true })
    // Señuelo: .git bajo el nombre remoto no debe contar si hay folderName.
    mkdirSync(join(workspaceDir, 'repo-a', '.git'), { recursive: true })
    mockSpawnWithOrigins({
      [customDest]: 'https://github.com/owner/repo-a.git',
    })

    const result = await cloneOrgWorkspace({
      baseDir: base,
      orgSlug: 'org',
      workspaceSlug: 'ws',
      token: 'tok',
      repos: [{
        repoFullName: 'owner/repo-a',
        cloneUrl: 'https://github.com/owner/repo-a.git',
        folderName: 'custom-dir',
      }],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.skipped).toEqual(['owner/repo-a'])
    expect(result.cloned).toEqual([])
    expect(spawnMock).toHaveBeenCalledTimes(1)
    const configArgs = spawnMock.mock.calls[0]?.[1] as string[]
    expect(configArgs[1]).toBe(customDest)
  })

  it('con folderName no trata repo-a/.git como instalado', async () => {
    const base = tempDir()
    const workspaceDir = join(base, 'org', 'ws')
    const decoyDir = join(workspaceDir, 'repo-a')
    mkdirSync(join(decoyDir, '.git'), { recursive: true })
    spawnMock.mockImplementation((_cmd: unknown, args: string[]) => {
      if (args.includes('clone')) return mockChild()
      if (args[0] === '-C' && args[1] === decoyDir) {
        return mockChild({ code: 1, stderr: 'missing' })
      }
      return mockChild()
    })

    const result = await cloneOrgWorkspace({
      baseDir: base,
      orgSlug: 'org',
      workspaceSlug: 'ws',
      token: 'tok',
      repos: [{
        repoFullName: 'owner/repo-a',
        cloneUrl: 'https://github.com/owner/repo-a.git',
        folderName: 'custom-dir',
      }],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.skipped).toEqual([])
    expect(result.cloned).toEqual(['owner/repo-a'])
    expect(spawnMock).toHaveBeenCalledTimes(2)
    const cloneCall = spawnMock.mock.calls.find(c => (c[1] as string[]).includes('clone'))
    const args = cloneCall?.[1] as string[]
    expect(args[args.length - 1]).toBe(join(workspaceDir, 'custom-dir'))
  })

  it('rechaza folderName inseguro antes de llamar git', async () => {
    const base = tempDir()
    mockSpawnSuccess()

    const result = await cloneOrgWorkspace({
      baseDir: base,
      orgSlug: 'org',
      workspaceSlug: 'ws',
      token: 'tok',
      repos: [{
        repoFullName: 'owner/repo-a',
        cloneUrl: 'https://github.com/owner/repo-a.git',
        folderName: '../escape',
      }],
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('invalid folder name')
    expect(result.error).toContain('owner/repo-a')
    expect(result.failure?.repoFullName).toBe('owner/repo-a')
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('skipea cuando el mismo repo ya está clonado con otro nombre de carpeta', async () => {
    const base = tempDir()
    const workspaceDir = join(base, 'org', 'ws')
    const origin = 'git@github-credicorp:credicorp-internal/brd-rimay-platform.git'
    const siblingDir = join(workspaceDir, 'rimay-platform')
    mkdirSync(join(siblingDir, '.git'), { recursive: true })
    mockSpawnWithOrigins({
      [siblingDir]: origin,
    })

    const result = await cloneOrgWorkspace({
      baseDir: base,
      orgSlug: 'org',
      workspaceSlug: 'ws',
      token: 'tok',
      repos: [{
        repoFullName: 'credicorp-internal/brd-rimay-platform',
        cloneUrl: origin,
        folderName: 'brd-rimay-platform',
      }],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.skipped).toEqual(['credicorp-internal/brd-rimay-platform'])
    expect(result.cloned).toEqual([])
    const cloneCalls = spawnMock.mock.calls.filter(
      (call: unknown[]) => (call[1] as string[]).includes('clone'),
    )
    expect(cloneCalls).toHaveLength(0)
  })

  it('clona cuando la carpeta existente apunta a otro origin', async () => {
    const base = tempDir()
    const workspaceDir = join(base, 'org', 'ws')
    const siblingDir = join(workspaceDir, 'rimay-platform')
    mkdirSync(join(siblingDir, '.git'), { recursive: true })
    spawnMock.mockImplementation((_cmd: unknown, args: string[]) => {
      if (args[0] === '-C' && args.includes('config')) {
        const dest = args[1] ?? ''
        if (dest === siblingDir) {
          return mockChild({ stdout: 'https://github.com/other/another-repo.git\n' })
        }
        return mockChild({ code: 1, stderr: 'missing' })
      }
      return mockChild()
    })

    const result = await cloneOrgWorkspace({
      baseDir: base,
      orgSlug: 'org',
      workspaceSlug: 'ws',
      token: 'tok',
      repos: [{
        repoFullName: 'credicorp-internal/brd-rimay-platform',
        cloneUrl: 'git@github-credicorp:credicorp-internal/brd-rimay-platform.git',
        folderName: 'brd-rimay-platform',
      }],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.skipped).toEqual([])
    expect(result.cloned).toEqual(['credicorp-internal/brd-rimay-platform'])
    const cloneCalls = spawnMock.mock.calls.filter(
      (call: unknown[]) => (call[1] as string[]).includes('clone'),
    )
    expect(cloneCalls).toHaveLength(1)
    const cloneArgs = cloneCalls[0]?.[1] as string[]
    expect(cloneArgs[cloneArgs.length - 1]).toBe(join(workspaceDir, 'brd-rimay-platform'))
  })
})
