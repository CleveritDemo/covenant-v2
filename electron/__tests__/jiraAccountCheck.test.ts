import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { CONFIG_DEFAULTS, type AppConfig } from '../../src/shared/configSchema'

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

const jiraMyself = vi.fn()
vi.mock('../jiraClient', () => ({ jiraMyself }))

const { bindJiraConfigAccess, checkJiraAccount } = await import('../jiraIpcOps')
const { writeJiraToken } = await import('../jiraAccountStore')

const accountDefault = {
  id: 'acc-default',
  label: 'default.atlassian.net',
  site: 'https://default.atlassian.net',
  email: 'default@atlassian.net',
}
const accountTarget = {
  id: 'acc-target',
  label: 'target.atlassian.net',
  site: 'https://target.atlassian.net',
  email: 'target@y.com',
}

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
}

beforeEach(() => {
  mockState.userDataDir = tmp('gravity-jira-check-')
  mockState.encryptionAvailable = true
  jiraMyself.mockReset()
  bindTestConfig({
    jiraAccounts: [accountDefault, accountTarget],
    jiraDefaultAccountId: 'acc-default',
  })
  writeJiraToken('acc-default', 'tok-default')
  writeJiraToken('acc-target', 'tok-target')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('checkJiraAccount', () => {
  it('cuenta inexistente devuelve ok:false', async () => {
    const result = await checkJiraAccount('missing')
    expect(result).toEqual({ ok: false, error: 'Cuenta Jira desconocida.' })
    expect(jiraMyself).not.toHaveBeenCalled()
  })

  it('cuenta sin token devuelve ok:false', async () => {
    bindTestConfig({
      jiraAccounts: [{ ...accountTarget, id: 'acc-no-tok' }],
      jiraDefaultAccountId: '',
    })

    const result = await checkJiraAccount('acc-no-tok')
    expect(result).toEqual({ ok: false, error: 'Falta la credencial de esta cuenta.' })
    expect(jiraMyself).not.toHaveBeenCalled()
  })

  it('verificación correcta devuelve nombre y correo de la cuenta pedida', async () => {
    jiraMyself.mockResolvedValue({
      ok: true,
      displayName: 'Ana Target',
      emailAddress: 'ana@target.com',
    })

    const result = await checkJiraAccount('acc-target')
    expect(result).toEqual({
      ok: true,
      displayName: 'Ana Target',
      email: 'ana@target.com',
    })
    expect(jiraMyself).toHaveBeenCalledTimes(1)
    expect(jiraMyself).toHaveBeenCalledWith({
      site: 'https://target.atlassian.net',
      email: 'target@y.com',
      apiToken: 'tok-target',
    })
    expect(jiraMyself).not.toHaveBeenCalledWith(
      expect.objectContaining({ email: 'default@atlassian.net' }),
    )
  })

  it('401 devuelve ok:false sin lanzar', async () => {
    jiraMyself.mockResolvedValue({ ok: false, error: 'Jira 401: credenciales inválidas' })

    await expect(checkJiraAccount('acc-target')).resolves.toEqual({
      ok: false,
      error: 'Jira 401: credenciales inválidas',
    })
  })
})
