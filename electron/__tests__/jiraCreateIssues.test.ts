import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const mockState = vi.hoisted(() => ({
  userDataDir: '',
}))

vi.mock('electron', () => ({
  app: { getPath: () => mockState.userDataDir },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (buffer: Buffer) => buffer.toString(),
  },
}))

const jiraIssueTypes = vi.fn()
const jiraCreateIssue = vi.fn()
vi.mock('../jiraClient', async importOriginal => {
  const actual = await importOriginal<typeof import('../jiraClient')>()
  return { ...actual, jiraIssueTypes, jiraCreateIssue }
})

import type { AppConfig } from '../../src/shared/configSchema'

const { createJiraIssues, listJiraIssueTypes, bindJiraConfigAccess } = await import('../jiraIpcOps')
const { writeJiraConfig, writeJiraCredentials } = await import('../jiraConfig')
const { CONFIG_DEFAULTS } = await import('../../src/shared/configSchema')

const cred = { site: 'https://x.atlassian.net', email: 'a@b.c', apiToken: 'tok' }

function project(): string {
  const dir = mkdtempSync(join(tmpdir(), 'gravity-jira-create-'))
  writeJiraConfig(dir, {
    site: 'https://x.atlassian.net',
    projectKeys: ['GRAV'],
    defaultJql: 'project = GRAV',
    refreshSeconds: 900,
    maxComments: 10,
  })
  writeJiraCredentials(cred)
  return dir
}

beforeEach(() => {
  mockState.userDataDir = mkdtempSync(join(tmpdir(), 'gravity-jira-userdata-'))
  let config: AppConfig = { ...CONFIG_DEFAULTS }
  bindJiraConfigAccess({ read: () => config, write: next => { config = next } })
  jiraIssueTypes.mockReset().mockResolvedValue([
    { id: '1', name: 'Story', subtask: false },
    { id: '2', name: 'Sub-task', subtask: true },
  ])
  jiraCreateIssue.mockReset()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => vi.restoreAllMocks())

describe('listJiraIssueTypes', () => {
  it('sin credenciales no llama a la red', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-jira-empty-'))
    const out = await listJiraIssueTypes(dir, 'GRAV')
    expect(out.ok).toBe(false)
    expect(jiraIssueTypes).not.toHaveBeenCalled()
  })
})

describe('createJiraIssues', () => {
  it('sin proyecto, projectKey vacío o más de 50 nodos: ok false sin red', async () => {
    expect(await createJiraIssues('', { projectKey: 'GRAV', nodes: [] })).toMatchObject({
      ok: false,
      results: [],
    })
    expect(await createJiraIssues(project(), { projectKey: '', nodes: [{ tempId: 'a', issueTypeName: 'Story', summary: 's' }] }))
      .toMatchObject({ ok: false, results: [] })
    const many = Array.from({ length: 51 }, (_, i) => ({
      tempId: `n${i}`,
      issueTypeName: 'Story',
      summary: 's',
    }))
    expect(await createJiraIssues(project(), { projectKey: 'GRAV', nodes: many })).toMatchObject({
      ok: false,
      results: [],
    })
    expect(jiraIssueTypes).not.toHaveBeenCalled()
  })

  it('crea padre y subtarea en orden y pasa parentKey', async () => {
    const dir = project()
    jiraCreateIssue
      .mockResolvedValueOnce({ key: 'GRAV-10' })
      .mockResolvedValueOnce({ key: 'GRAV-11' })

    const out = await createJiraIssues(dir, {
      projectKey: 'GRAV',
      nodes: [
        { tempId: 'p', issueTypeName: 'Story', summary: 'Padre' },
        { tempId: 'c', parentTempId: 'p', issueTypeName: 'Sub-task', summary: 'Hijo' },
      ],
    })

    expect(out.ok).toBe(true)
    expect(out.results).toEqual([
      { tempId: 'p', ok: true, key: 'GRAV-10' },
      { tempId: 'c', ok: true, key: 'GRAV-11' },
    ])
    expect(jiraIssueTypes).toHaveBeenCalledTimes(1)
    expect(jiraCreateIssue).toHaveBeenNthCalledWith(1, expect.anything(), {
      projectKey: 'GRAV',
      issueTypeId: '1',
      summary: 'Padre',
      description: undefined,
      parentKey: undefined,
    })
    expect(jiraCreateIssue).toHaveBeenNthCalledWith(2, expect.anything(), {
      projectKey: 'GRAV',
      issueTypeId: '2',
      summary: 'Hijo',
      description: undefined,
      parentKey: 'GRAV-10',
    })
  })

  it('tipo desconocido falla el nodo y salta descendientes', async () => {
    const dir = project()
    jiraCreateIssue.mockResolvedValue({ key: 'GRAV-10' })

    const out = await createJiraIssues(dir, {
      projectKey: 'GRAV',
      nodes: [
        { tempId: 'p', issueTypeName: 'Epic', summary: 'Padre' },
        { tempId: 'c', parentTempId: 'p', issueTypeName: 'Sub-task', summary: 'Hijo' },
      ],
    })

    expect(out.ok).toBe(false)
    expect(out.results.find(r => r.tempId === 'p')?.error).toMatch(/Epic/)
    expect(out.results.find(r => r.tempId === 'c')).toEqual({
      tempId: 'c',
      ok: false,
      error: 'padre no creado',
    })
    expect(jiraCreateIssue).not.toHaveBeenCalled()
  })

  it('un fallo de API no aborta el lote: ok true si al menos uno se creó', async () => {
    const dir = project()
    jiraCreateIssue
      .mockRejectedValueOnce(new Error('Jira 400'))
      .mockResolvedValueOnce({ key: 'GRAV-20' })

    const out = await createJiraIssues(dir, {
      projectKey: 'GRAV',
      nodes: [
        { tempId: 'a', issueTypeName: 'Story', summary: 'falla' },
        { tempId: 'b', issueTypeName: 'Story', summary: 'ok' },
      ],
    })

    expect(out.ok).toBe(true)
    expect(out.results).toEqual([
      { tempId: 'a', ok: false, error: 'Jira 400' },
      { tempId: 'b', ok: true, key: 'GRAV-20' },
    ])
  })

  it('parentTempId inexistente o ciclo marcan ok:false sin lanzar', async () => {
    const dir = project()

    const missing = await createJiraIssues(dir, {
      projectKey: 'GRAV',
      nodes: [{ tempId: 'x', parentTempId: 'fantasma', issueTypeName: 'Story', summary: 's' }],
    })
    expect(missing.results[0]).toMatchObject({ ok: false, error: 'parentTempId inexistente' })

    const cycle = await createJiraIssues(dir, {
      projectKey: 'GRAV',
      nodes: [
        { tempId: 'a', parentTempId: 'b', issueTypeName: 'Story', summary: 'a' },
        { tempId: 'b', parentTempId: 'a', issueTypeName: 'Story', summary: 'b' },
      ],
    })
    expect(cycle.results.every(r => r.ok === false)).toBe(true)
    expect(jiraCreateIssue).not.toHaveBeenCalled()
  })
})
