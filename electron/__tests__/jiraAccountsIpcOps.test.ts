import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { CONFIG_DEFAULTS, type AppConfig } from '../../src/shared/configSchema'
const { writeJiraConfig, writeJiraCredentials } = await import('../jiraConfig')

const mockState = vi.hoisted(() => ({
  userDataDir: '',
  encryptionAvailable: true,
}))

vi.mock('electron', () => ({
  app: { getPath: () => mockState.userDataDir },
  safeStorage: {
    isEncryptionAvailable: () => mockState.encryptionAvailable,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (buffer: Buffer) => buffer.toString(),
  },
}))

const {
  bindJiraConfigAccess,
  resolveJiraAccount,
  seedJiraAccountsFromLegacyCredentials,
} = await import('../jiraIpcOps')
const {
  deleteJiraToken,
  readJiraToken,
  writeJiraToken,
} = await import('../jiraAccountStore')
const { writeJiraWorkspaceAccountId } = await import('../jiraWorkspaceAccount')

function tmp(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix))
}

function bindTestConfig(initial: Partial<AppConfig> = {}) {
  let config: AppConfig = { ...CONFIG_DEFAULTS, ...initial }
  bindJiraConfigAccess({
    read: () => config,
    write: next => {
      config = next
    },
  })
  return {
    getConfig: () => config,
  }
}

function projectWithJiraJson(dir: string): void {
  writeJiraConfig(dir, {
    site: 'https://x.atlassian.net',
    projectKeys: ['GRAV'],
    defaultJql: 'x',
    refreshSeconds: 900,
    maxComments: 10,
  })
}

const accountA = {
  id: 'acc-a',
  label: 'x.atlassian.net',
  site: 'https://x.atlassian.net',
  email: 'a@x.com',
}
const accountB = {
  id: 'acc-b',
  label: 'y.atlassian.net',
  site: 'https://y.atlassian.net',
  email: 'b@y.com',
}

beforeEach(() => {
  mockState.userDataDir = tmp('gravity-jira-acc-')
  mockState.encryptionAvailable = true
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('resolveJiraAccount precedencia', () => {
  it('binding de carpeta gana sobre default y sobre única cuenta', () => {
    const dir = tmp('gravity-jira-proj-')
    projectWithJiraJson(dir)
    writeJiraToken('acc-a', 'tok-a')
    writeJiraToken('acc-b', 'tok-b')
    writeJiraWorkspaceAccountId(dir, 'acc-b')
    bindTestConfig({
      jiraAccounts: [accountA, accountB],
      jiraDefaultAccountId: 'acc-a',
    })

    const resolved = resolveJiraAccount(dir)
    expect(resolved?.accountId).toBe('acc-b')
    expect(resolved?.apiToken).toBe('tok-b')
  })

  it('default gana cuando no hay binding', () => {
    const dir = tmp('gravity-jira-proj-')
    projectWithJiraJson(dir)
    writeJiraToken('acc-a', 'tok-a')
    writeJiraToken('acc-b', 'tok-b')
    bindTestConfig({
      jiraAccounts: [accountA, accountB],
      jiraDefaultAccountId: 'acc-a',
    })

    expect(resolveJiraAccount(dir)?.accountId).toBe('acc-a')
  })

  it('única cuenta si no hay binding ni default', () => {
    const dir = tmp('gravity-jira-proj-')
    projectWithJiraJson(dir)
    writeJiraToken('acc-a', 'tok-a')
    bindTestConfig({ jiraAccounts: [accountA], jiraDefaultAccountId: '' })

    expect(resolveJiraAccount(dir)?.accountId).toBe('acc-a')
  })

  it('null si hay varias cuentas sin binding ni default', () => {
    const dir = tmp('gravity-jira-proj-')
    projectWithJiraJson(dir)
    writeJiraToken('acc-a', 'tok-a')
    writeJiraToken('acc-b', 'tok-b')
    bindTestConfig({ jiraAccounts: [accountA, accountB], jiraDefaultAccountId: '' })

    expect(resolveJiraAccount(dir)).toBeNull()
  })
})

describe('resolveJiraAccount token y legacy', () => {
  it('cuenta elegida sin token devuelve null, no salta a otra', () => {
    const dir = tmp('gravity-jira-proj-')
    projectWithJiraJson(dir)
    writeJiraToken('acc-b', 'tok-b')
    writeJiraWorkspaceAccountId(dir, 'acc-a')
    bindTestConfig({
      jiraAccounts: [accountA, accountB],
      jiraDefaultAccountId: 'acc-b',
    })

    expect(resolveJiraAccount(dir)).toBeNull()
  })

  it('fallback legacy cuando jiraAccounts está vacío', () => {
    const dir = tmp('gravity-jira-proj-')
    projectWithJiraJson(dir)
    bindTestConfig({ jiraAccounts: [], jiraDefaultAccountId: '' })
    writeJiraCredentials({
      site: 'https://x.atlassian.net',
      email: 'legacy@x.com',
      apiToken: 'legacy-tok',
    })

    expect(resolveJiraAccount(dir)).toEqual({
      accountId: '',
      label: '',
      site: 'https://x.atlassian.net',
      email: 'legacy@x.com',
      apiToken: 'legacy-tok',
    })
  })
})

describe('seedJiraAccountsFromLegacyCredentials', () => {
  it('crea N cuentas, default en la primera y no toca jira-credentials.json', () => {
    const legacyPath = join(mockState.userDataDir, 'jira-credentials.json')
    const legacyPayload = {
      plain: {
        'https://x.atlassian.net': { email: 'x@x.com', apiToken: 'tok-x' },
        'https://y.atlassian.net': { email: 'y@y.com', apiToken: 'tok-y' },
      },
    }
    writeFileSync(legacyPath, JSON.stringify(legacyPayload), 'utf8')

    const persisted: AppConfig[] = []
    const next = seedJiraAccountsFromLegacyCredentials(
      { ...CONFIG_DEFAULTS, jiraAccounts: [], jiraDefaultAccountId: '' },
      cfg => persisted.push(cfg),
    )

    expect(next.jiraAccounts).toHaveLength(2)
    expect(next.jiraAccounts[0]?.label).toBe('x.atlassian.net')
    expect(next.jiraDefaultAccountId).toBe(next.jiraAccounts[0]?.id)
    expect(readJiraToken(next.jiraAccounts[0]!.id)).toBe('tok-x')
    expect(readJiraToken(next.jiraAccounts[1]!.id)).toBe('tok-y')
    expect(persisted).toHaveLength(1)
    expect(readFileSync(legacyPath, 'utf8')).toBe(JSON.stringify(legacyPayload))
  })
})

describe('delete de cuenta', () => {
  it('limpia token y default', () => {
    writeJiraToken('acc-a', 'tok-a')
    let config: AppConfig = {
      ...CONFIG_DEFAULTS,
      jiraAccounts: [accountA],
      jiraDefaultAccountId: 'acc-a',
    }
    const id = 'acc-a'
    config = {
      ...config,
      jiraAccounts: config.jiraAccounts.filter(account => account.id !== id),
      jiraDefaultAccountId: config.jiraDefaultAccountId === id ? '' : config.jiraDefaultAccountId,
    }
    deleteJiraToken(id)

    expect(readJiraToken('acc-a')).toBeNull()
    expect(config.jiraDefaultAccountId).toBe('')
    expect(config.jiraAccounts).toEqual([])
  })
})
