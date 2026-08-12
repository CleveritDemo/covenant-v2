import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearJiraCache, jiraGetIssue, jiraMyself, jiraSearch } from '../jiraClient'

const cred = { site: 'https://x.atlassian.net', email: 'a@b.c', apiToken: 'tok' }

const issuePayload = {
  key: 'GRAV-412',
  fields: {
    summary: 'Loop chain colgada',
    status: { name: 'In Progress' },
    issuetype: { name: 'Bug' },
    assignee: { displayName: 'Rodrigo' },
    priority: { name: 'High' },
    updated: '2026-08-12T09:40:00.000Z',
    description: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'El FIFO no libera.' }] }] },
    comment: {
      comments: [
        { author: { displayName: 'Ana' }, created: '2026-08-11T10:00:00.000Z', body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'reproducido' }] }] } },
      ],
    },
    subtasks: [],
    issuelinks: [],
  },
}

function stubFetch(handler: (url: string, init: RequestInit) => unknown): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    const body = handler(url, init)
    return { ok: true, status: 200, json: async () => body } as unknown as Response
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => { clearJiraCache() })
afterEach(() => { vi.unstubAllGlobals() })

describe('jiraMyself', () => {
  it('manda Basic auth con email:token en base64', async () => {
    const fetchMock = stubFetch(() => ({ displayName: 'Rodrigo' }))
    const result = await jiraMyself(cred)
    expect(result).toEqual({ ok: true, displayName: 'Rodrigo' })
    const init = fetchMock.mock.calls[0][1] as RequestInit
    const auth = (init.headers as Record<string, string>).Authorization
    expect(auth).toBe(`Basic ${Buffer.from('a@b.c:tok').toString('base64')}`)
  })

  it('un 401 devuelve un error legible, no una excepción', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) } as unknown as Response)))
    const result = await jiraMyself(cred)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('401')
  })

  it('una red caída devuelve error, no rechaza la promesa', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ENOTFOUND') }))
    await expect(jiraMyself(cred)).resolves.toMatchObject({ ok: false })
  })
})

describe('jiraSearch', () => {
  it('mapea la respuesta a JiraIssueRef', async () => {
    stubFetch(() => ({ issues: [issuePayload] }))
    const refs = await jiraSearch(cred, 'project = GRAV', 8)
    expect(refs).toEqual([{
      key: 'GRAV-412',
      summary: 'Loop chain colgada',
      status: 'In Progress',
      issueType: 'Bug',
      assignee: 'Rodrigo',
    }])
  })

  it('escapa el JQL en la query string', async () => {
    const fetchMock = stubFetch(() => ({ issues: [] }))
    await jiraSearch(cred, 'summary ~ "a b"', 8)
    expect(fetchMock.mock.calls[0][0]).toContain('jql=summary+%7E+%22a+b%22')
  })

  it('una respuesta sin issues devuelve lista vacía', async () => {
    stubFetch(() => ({}))
    await expect(jiraSearch(cred, 'x', 8)).resolves.toEqual([])
  })
})

describe('jiraGetIssue', () => {
  it('aplana el ADF de descripción y comentarios', async () => {
    stubFetch(() => issuePayload)
    const issue = await jiraGetIssue(cred, 'GRAV-412', 10)
    expect(issue.description).toBe('El FIFO no libera.')
    expect(issue.comments[0]).toEqual({
      author: 'Ana',
      created: '2026-08-11T10:00:00.000Z',
      body: 'reproducido',
    })
    expect(issue.url).toBe('https://x.atlassian.net/browse/GRAV-412')
  })

  it('sin asignado no inventa un nombre', async () => {
    stubFetch(() => ({ ...issuePayload, fields: { ...issuePayload.fields, assignee: null } }))
    expect((await jiraGetIssue(cred, 'GRAV-412', 10)).assignee).toBeNull()
  })

  it('la segunda llamada dentro del TTL no vuelve a la red', async () => {
    const fetchMock = stubFetch(() => issuePayload)
    await jiraGetIssue(cred, 'GRAV-412', 10)
    await jiraGetIssue(cred, 'GRAV-412', 10)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('un 404 lanza un error con la clave, para que el refresco lo registre', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) } as unknown as Response)))
    await expect(jiraGetIssue(cred, 'GRAV-999', 10)).rejects.toThrow(/GRAV-999/)
  })
})
