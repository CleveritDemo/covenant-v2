import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { githubGetIssue, searchGithubIssues } from '../githubApi'

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: { get: () => null },
  } as unknown as Response
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('searchGithubIssues', () => {
  it('arma q=repo:full is:issue query, sort=updated y descarta PRs', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      items: [
        {
          number: 1,
          title: 'PR disfrazada',
          state: 'open',
          updated_at: '2026-08-01T00:00:00Z',
          user: { login: 'a' },
          labels: [],
          pull_request: { url: 'https://api.github.com/repos/acme/app/pulls/1' },
        },
        {
          number: 2,
          title: 'Issue real',
          state: 'closed',
          updated_at: '2026-08-02T00:00:00Z',
          user: { login: 'b' },
          labels: [{ name: 'bug' }],
        },
      ],
    }))
    vi.stubGlobal('fetch', fetchMock)

    const issues = await searchGithubIssues('tok', 'acme/app', 'login', 8)
    expect(issues).toEqual([
      {
        number: 2,
        title: 'Issue real',
        state: 'closed',
        repoFullName: 'acme/app',
        updated: '2026-08-02T00:00:00Z',
        author: 'b',
        labels: ['bug'],
      },
    ])
    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.pathname).toBe('/search/issues')
    expect(url.searchParams.get('q')).toBe('repo:acme/app is:issue login')
    expect(url.searchParams.get('sort')).toBe('updated')
    expect(url.searchParams.get('order')).toBe('desc')
  })
})

describe('githubGetIssue', () => {
  it('pide la issue y recorta comentarios a los más recientes', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/comments')) {
        return jsonResponse([
          { user: { login: 'a' }, created_at: '2026-08-01T00:00:00Z', body: 'viejo' },
          { user: { login: 'b' }, created_at: '2026-08-02T00:00:00Z', body: 'nuevo' },
        ])
      }
      return jsonResponse({
        number: 7,
        title: 'Fix',
        state: 'open',
        updated_at: '2026-08-03T00:00:00Z',
        html_url: 'https://github.com/acme/app/issues/7',
        body: 'cuerpo',
        user: { login: 'ana' },
        labels: ['bug'],
        assignees: [{ login: 'luis' }],
        milestone: { title: 'm1' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const snapshot = await githubGetIssue('tok', 'acme/app', 7, 1)
    expect(snapshot).toMatchObject({
      number: 7,
      title: 'Fix',
      state: 'open',
      repoFullName: 'acme/app',
      url: 'https://github.com/acme/app/issues/7',
      body: 'cuerpo',
      assignees: ['luis'],
      milestone: 'm1',
    })
    expect(snapshot.comments).toEqual([
      { author: 'b', created: '2026-08-02T00:00:00Z', body: 'nuevo' },
    ])
  })
})
