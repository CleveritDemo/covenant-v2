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
    expect(result).toEqual({ ok: false, error: 'invalid-org-slug' })
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
})
