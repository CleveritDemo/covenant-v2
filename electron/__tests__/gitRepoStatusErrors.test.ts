import { EventEmitter } from 'events'
import { mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { spawn as spawnType } from 'child_process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GIT_ERROR_CODES } from '../../src/shared/gitErrorCodes'

const hoist = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  realSpawn: null as typeof spawnType | null,
}))

vi.mock('child_process', async importOriginal => {
  const actual = await importOriginal<typeof import('child_process')>()
  hoist.realSpawn = actual.spawn
  hoist.spawnMock.mockImplementation(actual.spawn)
  return { ...actual, spawn: hoist.spawnMock }
})

import { gitGetRepoStatus } from '../gitSessionOps'

describe('gitGetRepoStatus repo root errors', () => {
  const dirs: string[] = []
  const tempDir = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'ia-terminal-git-status-err-'))
    dirs.push(dir)
    return dir
  }

  afterEach(() => {
    if (hoist.realSpawn) hoist.spawnMock.mockImplementation(hoist.realSpawn)
    dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true }))
  })

  it('returns NOT_A_REPO when cwd has no .git marker', async () => {
    const dir = tempDir()
    const status = await gitGetRepoStatus(dir)
    expect(status.isRepo).toBe(false)
    expect(status.errorCode).toBe(GIT_ERROR_CODES.NOT_A_REPO)
    expect(status.error).toBeTruthy()
  })

  it('returns REPO_UNREADABLE when .git exists but rev-parse fails', async () => {
    const dir = tempDir()
    mkdirSync(join(dir, '.git'))
    const status = await gitGetRepoStatus(dir)
    expect(status.isRepo).toBe(false)
    expect(status.errorCode).toBe(GIT_ERROR_CODES.REPO_UNREADABLE)
    expect(status.error).toMatch(/not a git repository|fatal/i)
  })

  it('returns GIT_UNAVAILABLE when git cannot be spawned, even with .git marker', async () => {
    const dir = tempDir()
    mkdirSync(join(dir, '.git'))
    const stderr = 'spawn git ENOENT'
    hoist.spawnMock.mockImplementation(() => {
      const child = new EventEmitter() as ReturnType<typeof spawnType>
      Object.assign(child, { stdout: new EventEmitter(), stderr: new EventEmitter() })
      setImmediate(() => child.emit('error', Object.assign(new Error(stderr), { code: 'ENOENT' })))
      return child
    })
    const status = await gitGetRepoStatus(dir)
    expect(status.isRepo).toBe(false)
    expect(status.errorCode).toBe(GIT_ERROR_CODES.GIT_UNAVAILABLE)
    expect(status.error).toBe(stderr)
  })
})
