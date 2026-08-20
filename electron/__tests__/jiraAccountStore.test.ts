import { describe, expect, it, vi } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const mockState = vi.hoisted(() => ({
  userDataDir: '',
  encryptionAvailable: false,
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
  readJiraToken,
  writeJiraToken,
  deleteJiraToken,
  listJiraTokenIds,
  readLegacyJiraCredentials,
} = await import('../jiraAccountStore')

describe('jiraAccountStore', () => {
  it('write→read devuelve el token y listJiraTokenIds lo lista', () => {
    mockState.userDataDir = mkdtempSync(join(tmpdir(), 'gravity-jira-acc-'))
    mockState.encryptionAvailable = true

    writeJiraToken('acc-1', 'tok-123')
    expect(readJiraToken('acc-1')).toBe('tok-123')
    expect(listJiraTokenIds()).toEqual(['acc-1'])
  })

  it('delete quita la entrada y deja las demás', () => {
    mockState.userDataDir = mkdtempSync(join(tmpdir(), 'gravity-jira-acc-'))
    mockState.encryptionAvailable = true

    writeJiraToken('acc-1', 'tok-1')
    writeJiraToken('acc-2', 'tok-2')
    deleteJiraToken('acc-1')

    expect(readJiraToken('acc-1')).toBeNull()
    expect(readJiraToken('acc-2')).toBe('tok-2')
    expect(listJiraTokenIds()).toEqual(['acc-2'])
  })

  it('sin safeStorage el write lanza y el delete no lanza', () => {
    mockState.userDataDir = mkdtempSync(join(tmpdir(), 'gravity-jira-acc-'))
    mockState.encryptionAvailable = false

    expect(() => writeJiraToken('acc-1', 'super-secreto')).toThrow(/almac[eé]n seguro/i)
    expect(existsSync(join(mockState.userDataDir, 'jira-tokens.json'))).toBe(false)

    writeFileSync(
      join(mockState.userDataDir, 'jira-tokens.json'),
      JSON.stringify({ plain: { 'acc-1': 'viejo' } }),
      'utf8',
    )
    expect(() => deleteJiraToken('acc-1')).not.toThrow()
    expect(readJiraToken('acc-1')).toBeNull()
  })

  it('un archivo `{ plain: { ... } }` se lee', () => {
    mockState.userDataDir = mkdtempSync(join(tmpdir(), 'gravity-jira-acc-'))
    mockState.encryptionAvailable = false
    writeFileSync(
      join(mockState.userDataDir, 'jira-tokens.json'),
      JSON.stringify({ plain: { 'acc-a': 'tok-a', empty: '  ' } }),
      'utf8',
    )

    expect(readJiraToken('acc-a')).toBe('tok-a')
    expect(readJiraToken('empty')).toBeNull()
    expect(listJiraTokenIds()).toEqual(['acc-a'])
  })

  it('JSON roto devuelve vacío sin lanzar', () => {
    mockState.userDataDir = mkdtempSync(join(tmpdir(), 'gravity-jira-acc-'))
    mockState.encryptionAvailable = false
    writeFileSync(join(mockState.userDataDir, 'jira-tokens.json'), '{ roto', 'utf8')

    expect(readJiraToken('acc-1')).toBeNull()
    expect(listJiraTokenIds()).toEqual([])
    expect(() => deleteJiraToken('acc-1')).not.toThrow()
  })

  it('readLegacyJiraCredentials devuelve entradas completas, descarta incompletas y no muta el archivo', () => {
    mockState.userDataDir = mkdtempSync(join(tmpdir(), 'gravity-jira-acc-'))
    mockState.encryptionAvailable = false
    const legacyPath = join(mockState.userDataDir, 'jira-credentials.json')
    const legacyPayload = {
      plain: {
        'https://x.atlassian.net': { email: 'x@x.com', apiToken: 'tok-x' },
        'https://y.atlassian.net': { email: 'y@y.com' },
        'https://z.atlassian.net': { apiToken: 'tok-z' },
      },
    }
    writeFileSync(legacyPath, JSON.stringify(legacyPayload), 'utf8')

    expect(readLegacyJiraCredentials()).toEqual([
      { site: 'https://x.atlassian.net', email: 'x@x.com', apiToken: 'tok-x' },
    ])
    expect(readFileSync(legacyPath, 'utf8')).toBe(JSON.stringify(legacyPayload))
  })
})
