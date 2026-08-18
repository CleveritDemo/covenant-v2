import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { IPC } from '../../src/shared/ipcChannels'
import { mapRestRepo } from '../githubApi'

const { listGithubReposFor, resetGithubRepoListCache } = await import('../githubRepoOps')

const TOKEN = 'ghp_test'

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: { get: () => null },
  } as unknown as Response
}

function restRepo(over: Record<string, unknown> = {}) {
  return {
    full_name: 'acme/app',
    clone_url: 'https://github.com/acme/app.git',
    private: false,
    archived: false,
    pushed_at: '2026-08-01T00:00:00Z',
    description: 'App',
    ...over,
  }
}

beforeEach(() => {
  resetGithubRepoListCache()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('mapRestRepo', () => {
  it('descarta sin full_name o clone_url', () => {
    expect(mapRestRepo(restRepo({ full_name: '' }))).toBeNull()
    expect(mapRestRepo(restRepo({ clone_url: null }))).toBeNull()
    expect(mapRestRepo({})).toBeNull()
  })

  it('normaliza nulls a vacío/false y cae a updated_at', () => {
    expect(mapRestRepo(restRepo({
      private: null,
      archived: null,
      pushed_at: null,
      updated_at: '2026-07-01T00:00:00Z',
      description: null,
    }))).toEqual({
      fullName: 'acme/app',
      cloneUrl: 'https://github.com/acme/app.git',
      isPrivate: false,
      archived: false,
      pushedAt: '2026-07-01T00:00:00Z',
      description: '',
    })
  })
})

describe('listGithubReposFor', () => {
  it('token vacío devuelve error y no lanza ni sale a la red', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const out = await listGithubReposFor(null, '')
    expect(out).toEqual({
      repos: [],
      truncated: false,
      error: 'No hay token de GitHub para esta cuenta.',
    })
    expect(fetchMock).not.toHaveBeenCalled()
    await expect(listGithubReposFor('', 'ab')).resolves.toMatchObject({ repos: [] })
  })

  it('query de menos de 2 caracteres lista /user/repos; ≥2 busca', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const href = String(url)
      if (href.includes('/user/repos')) return jsonResponse([restRepo()])
      if (href.includes('/search/repositories')) {
        return jsonResponse({ total_count: 1, items: [restRepo({ full_name: 'acme/search' })] })
      }
      return jsonResponse({ message: 'nf' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    const listed = await listGithubReposFor(TOKEN, 'x')
    expect(listed.repos.map(repo => repo.fullName)).toEqual(['acme/app'])
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/user/repos?')
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('affiliation=owner,collaborator,organization_member')

    fetchMock.mockClear()
    const searched = await listGithubReposFor(TOKEN, '  xy ')
    expect(searched.repos.map(repo => repo.fullName)).toEqual(['acme/search'])
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://api.github.com/search/repositories?q=xy+fork:true&per_page=50&sort=updated',
    )
  })

  it('deduplica por fullName en minúsculas y ordena por pushedAt descendente', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([
      restRepo({
        full_name: 'Acme/App',
        clone_url: 'https://github.com/Acme/App.git',
        pushed_at: '2026-08-01T00:00:00Z',
      }),
      restRepo({
        full_name: 'acme/zeta',
        clone_url: 'https://github.com/acme/zeta.git',
        pushed_at: '2026-08-03T00:00:00Z',
      }),
      restRepo({
        full_name: 'acme/app',
        clone_url: 'https://github.com/acme/app.git',
        pushed_at: '2026-08-02T00:00:00Z',
      }),
    ])))
    const out = await listGithubReposFor(TOKEN, '')
    expect(out.repos.map(repo => repo.fullName)).toEqual(['acme/zeta', 'acme/app'])
    expect(out.error).toBeUndefined()
  })
})

describe('canal github:reposList', () => {
  it('está declarado, el preload lo expone y main registra el handler', () => {
    expect(IPC.GITHUB_REPOS_LIST).toBe('github:reposList')
    const preload = readFileSync(join(__dirname, '..', 'preload.ts'), 'utf8')
    expect(preload).toMatch(/githubReposList\s*[:(]/)
    const main = readFileSync(join(__dirname, '..', 'main.ts'), 'utf8')
    expect(main).toContain('IPC.GITHUB_REPOS_LIST')
  })
})
