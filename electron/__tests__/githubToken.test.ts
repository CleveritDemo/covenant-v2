import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { CONFIG_DEFAULTS } from '../../src/shared/configSchema'

const mocks = vi.hoisted(() => ({
  readAccountToken: vi.fn(),
}))

vi.mock('../githubAccountStore', () => ({
  readAccountToken: mocks.readAccountToken,
}))

const { resolveGithubToken, resolveGithubTokenWithSource } = await import('../githubToken')

const savedEnv = process.env.GITHUB_TOKEN

beforeEach(() => {
  delete process.env.GITHUB_TOKEN
  mocks.readAccountToken.mockReset()
})

afterEach(() => {
  if (savedEnv === undefined) delete process.env.GITHUB_TOKEN
  else process.env.GITHUB_TOKEN = savedEnv
})

function workspaceWithBinding(accountId: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'gravity-gh-token-'))
  mkdirSync(join(dir, '.gravity'))
  writeFileSync(join(dir, '.gravity', 'github.json'), `${JSON.stringify({ accountId })}\n`, 'utf8')
  return dir
}

describe('resolveGithubTokenWithSource workspace', () => {
  it('workspace gana a settings', async () => {
    const cwd = workspaceWithBinding('acc-1')
    mocks.readAccountToken.mockReturnValue('workspace-token')
    const result = await resolveGithubTokenWithSource(
      {
        ...CONFIG_DEFAULTS,
        githubToken: 'settings-token',
        githubAccounts: [{ id: 'acc-1', label: 'Work' }],
      },
      { cwd },
    )
    expect(result).toEqual({ token: 'workspace-token', source: 'workspace' })
    await expect(
      resolveGithubToken(
        {
          ...CONFIG_DEFAULTS,
          githubToken: 'settings-token',
          githubAccounts: [{ id: 'acc-1', label: 'Work' }],
        },
        { cwd },
      ),
    ).resolves.toBe('workspace-token')
  })

  it('binding huérfano cae a settings, no a workspace', async () => {
    const cwd = workspaceWithBinding('ghost')
    mocks.readAccountToken.mockReturnValue('workspace-token')
    const result = await resolveGithubTokenWithSource(
      {
        ...CONFIG_DEFAULTS,
        githubToken: 'settings-token',
        githubAccounts: [{ id: 'acc-1', label: 'Work' }],
      },
      { cwd },
    )
    expect(result).toEqual({ token: 'settings-token', source: 'settings' })
    expect(existsSync(join(cwd, '.gravity', 'github.json'))).toBe(false)
    expect(mocks.readAccountToken).not.toHaveBeenCalled()
  })

  it('sin cwd se comporta como hoy', async () => {
    workspaceWithBinding('acc-1')
    mocks.readAccountToken.mockReturnValue('workspace-token')
    const result = await resolveGithubTokenWithSource({
      ...CONFIG_DEFAULTS,
      githubToken: 'settings-token',
      githubAccounts: [{ id: 'acc-1', label: 'Work' }],
    })
    expect(result).toEqual({ token: 'settings-token', source: 'settings' })
    expect(mocks.readAccountToken).not.toHaveBeenCalled()
  })
})
