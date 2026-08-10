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

function mockSpawnSuccess(): void {
  spawnMock.mockImplementation(() => {
    const child = new EventEmitter() as EventEmitter & {
      stderr: EventEmitter
      stdout: EventEmitter
    }
    child.stderr = new EventEmitter()
    child.stdout = new EventEmitter()
    queueMicrotask(() => child.emit('close', 0))
    return child
  })
}

function mockSpawnFail(stderr: string, code = 1): void {
  spawnMock.mockImplementation(() => {
    const child = new EventEmitter() as EventEmitter & {
      stderr: EventEmitter
      stdout: EventEmitter
    }
    child.stderr = new EventEmitter()
    child.stdout = new EventEmitter()
    queueMicrotask(() => {
      child.stderr.emit('data', Buffer.from(stderr))
      child.emit('close', code)
    })
    return child
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
    const dest = join(base, 'org', 'ws', 'repo-a')
    mkdirSync(join(dest, '.git'), { recursive: true })
    mockSpawnSuccess()

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
    expect(result.workspaceDir).toBe(join(base, 'org', 'ws'))
    expect(result.skipped).toEqual(['owner/repo-a'])
    expect(result.cloned).toEqual(['owner/repo-b'])
    expect(spawnMock).toHaveBeenCalledTimes(1)
    const args = spawnMock.mock.calls[0]?.[1] as string[]
    expect(args).toContain('clone')
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

  it('marca skip cuando .git es archivo (worktree)', async () => {
    const base = tempDir()
    const dest = join(base, 'org', 'ws', 'repo')
    mkdirSync(dest, { recursive: true })
    writeFileSync(join(dest, '.git'), 'gitdir: /tmp/elsewhere\n')
    mockSpawnSuccess()

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
    expect(spawnMock).not.toHaveBeenCalled()
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
})
