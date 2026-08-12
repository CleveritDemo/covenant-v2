import { describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

vi.mock('electron', () => ({
  app: { getPath: () => tmpdir() },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (buffer: Buffer) => buffer.toString(),
  },
}))

const { readJiraConfig, writeJiraConfig } = await import('../jiraConfig')

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
