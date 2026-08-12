import { describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// Estado mutable compartido con el factory de vi.mock (que se hoistea por encima de
// los imports): permite que un test aislado apunte `app.getPath` a su propio
// directorio temporal y/o active el cifrado, sin duplicar el mock completo.
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

const { readJiraConfig, writeJiraConfig, readJiraCredentials, writeJiraCredentials } =
  await import('../jiraConfig')

describe('readJiraConfig', () => {
  it('sin archivo devuelve null, no lanza', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-jira-'))
    expect(readJiraConfig(dir)).toBeNull()
  })

  it('ida y vuelta por disco', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-jira-'))
    writeJiraConfig(dir, {
      site: 'https://x.atlassian.net',
      projectKeys: ['GRAV'],
      defaultJql: 'project = GRAV',
      refreshSeconds: 300,
      maxComments: 5,
    })
    expect(readJiraConfig(dir)?.projectKeys).toEqual(['GRAV'])
    expect(readJiraConfig(dir)?.refreshSeconds).toBe(300)
  })

  it('el archivo escrito no contiene ningún campo de credencial', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-jira-'))
    writeJiraConfig(dir, {
      site: 'https://x.atlassian.net',
      projectKeys: [],
      defaultJql: 'project = GRAV',
      refreshSeconds: 900,
      maxComments: 10,
    })
    const raw = readFileSync(join(dir, '.gravity', 'jira.json'), 'utf8')
    expect(raw).not.toMatch(/token|password|secret/i)
  })

  it('un JSON corrupto devuelve null en vez de romper el turno', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-jira-'))
    writeJiraConfig(dir, {
      site: 'https://x.atlassian.net',
      projectKeys: [],
      defaultJql: 'x',
      refreshSeconds: 900,
      maxComments: 10,
    })
    const { writeFileSync } = require('fs') as typeof import('fs')
    writeFileSync(join(dir, '.gravity', 'jira.json'), '{ roto', 'utf8')
    expect(readJiraConfig(dir)).toBeNull()
  })
})

describe('readJiraCredentials / writeJiraCredentials', () => {
  it('ida y vuelta: lee lo mismo que se escribió', () => {
    mockState.userDataDir = mkdtempSync(join(tmpdir(), 'gravity-jira-creds-'))
    mockState.encryptionAvailable = false

    writeJiraCredentials({ site: 'https://x.atlassian.net', email: 'user@x.com', apiToken: 'tok-123' })

    expect(readJiraCredentials('https://x.atlassian.net')).toEqual({
      site: 'https://x.atlassian.net',
      email: 'user@x.com',
      apiToken: 'tok-123',
    })
  })

  it('un sitio sin credenciales guardadas devuelve null', () => {
    mockState.userDataDir = mkdtempSync(join(tmpdir(), 'gravity-jira-creds-'))
    mockState.encryptionAvailable = false

    expect(readJiraCredentials('https://sin-guardar.atlassian.net')).toBeNull()
  })

  it('una entrada a medio escribir no cuenta como credencial válida', () => {
    mockState.userDataDir = mkdtempSync(join(tmpdir(), 'gravity-jira-creds-'))
    mockState.encryptionAvailable = false
    const path = join(mockState.userDataDir, 'jira-credentials.json')

    // Sin apiToken: como si el proceso se hubiera interrumpido a mitad de escritura.
    writeFileSync(path, JSON.stringify({ plain: { 'https://x.atlassian.net': { email: 'user@x.com' } } }), 'utf8')
    expect(readJiraCredentials('https://x.atlassian.net')).toBeNull()

    // Sin email: el mismo caso, del otro lado.
    writeFileSync(path, JSON.stringify({ plain: { 'https://x.atlassian.net': { apiToken: 'tok-123' } } }), 'utf8')
    expect(readJiraCredentials('https://x.atlassian.net')).toBeNull()
  })

  it('dos sitios no colisionan: escribir el segundo no toca el primero', () => {
    mockState.userDataDir = mkdtempSync(join(tmpdir(), 'gravity-jira-creds-'))
    mockState.encryptionAvailable = false

    writeJiraCredentials({ site: 'https://x.atlassian.net', email: 'x@x.com', apiToken: 'tok-x' })
    writeJiraCredentials({ site: 'https://y.atlassian.net', email: 'y@y.com', apiToken: 'tok-y' })

    expect(readJiraCredentials('https://x.atlassian.net')).toEqual({
      site: 'https://x.atlassian.net',
      email: 'x@x.com',
      apiToken: 'tok-x',
    })
    expect(readJiraCredentials('https://y.atlassian.net')).toEqual({
      site: 'https://y.atlassian.net',
      email: 'y@y.com',
      apiToken: 'tok-y',
    })
  })

  it('con cifrado disponible, el token no queda en claro en disco pero sigue siendo legible', () => {
    mockState.userDataDir = mkdtempSync(join(tmpdir(), 'gravity-jira-creds-'))
    mockState.encryptionAvailable = true

    try {
      writeJiraCredentials({ site: 'https://x.atlassian.net', email: 'user@x.com', apiToken: 'super-secreto' })

      const raw = readFileSync(join(mockState.userDataDir, 'jira-credentials.json'), 'utf8')
      expect(raw).not.toContain('super-secreto')

      expect(readJiraCredentials('https://x.atlassian.net')).toEqual({
        site: 'https://x.atlassian.net',
        email: 'user@x.com',
        apiToken: 'super-secreto',
      })
    } finally {
      mockState.encryptionAvailable = false
    }
  })
})
