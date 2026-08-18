import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const gitMocks = vi.hoisted(() => ({
  getRepoRoot: vi.fn(),
  resolveGitHubRepo: vi.fn(),
}))

vi.mock('../githubActionsOps', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../githubActionsOps')>()
  return {
    ...actual,
    getRepoRoot: gitMocks.getRepoRoot,
    resolveGitHubRepo: gitMocks.resolveGitHubRepo,
  }
})

const {
  githubIssueStatusFor,
  searchGithubIssuesQuick,
  previewGithubIssue,
  resetGithubIssueStatusCache,
} = await import('../githubIssueOps')

const TOKEN = 'ghp_test'
const REPO = { owner: 'acme', repo: 'app', fullName: 'acme/app' }

const issueJson = {
  number: 12,
  title: 'Login roto',
  state: 'open',
  updated_at: '2026-08-12T09:40:00.000Z',
  html_url: 'https://github.com/acme/app/issues/12',
  body: 'El botón no hace nada.',
  user: { login: 'ana' },
  labels: [{ name: 'bug' }],
  assignees: [{ login: 'luis' }],
  milestone: { title: 'v1' },
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: { get: () => null },
  } as unknown as Response
}

beforeEach(() => {
  resetGithubIssueStatusCache()
  gitMocks.getRepoRoot.mockReset().mockResolvedValue('/repo')
  gitMocks.resolveGitHubRepo.mockReset().mockResolvedValue(REPO)
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const href = String(url)
    if (href.includes('/search/issues')) {
      return jsonResponse({ items: [{ ...issueJson, pull_request: undefined }] })
    }
    if (href.includes('/comments')) return jsonResponse([])
    if (href.includes('/issues/')) return jsonResponse(issueJson)
    if (/\/repos\/[^/]+\/[^/?]+$/.test(href)) return jsonResponse({ full_name: 'acme/app' })
    return jsonResponse({ message: 'not found' }, 404)
  }))
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('githubIssueStatusFor', () => {
  it('sin repo git: connected false y el error dice que falta git', async () => {
    gitMocks.getRepoRoot.mockResolvedValue(null)
    const out = await githubIssueStatusFor('/tmp/no-git', TOKEN)
    expect(out.connected).toBe(false)
    expect(out.error).toMatch(/git/i)
  })

  it('origin que no es GitHub: el error dice GitHub', async () => {
    gitMocks.resolveGitHubRepo.mockResolvedValue(null)
    const out = await githubIssueStatusFor('/repo', TOKEN)
    expect(out.connected).toBe(false)
    expect(out.error).toMatch(/GitHub/i)
  })

  it('sin token: el error dice token', async () => {
    const out = await githubIssueStatusFor('/repo', '')
    expect(out.connected).toBe(false)
    expect(out.repoFullName).toBe('acme/app')
    expect(out.error).toMatch(/token/i)
  })

  it('con repo y token: connected true', async () => {
    const out = await githubIssueStatusFor('/repo', TOKEN)
    expect(out).toEqual({ connected: true, repoFullName: 'acme/app' })
  })

  it('GET /repos 200: connected true', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ full_name: 'acme/app' }))
    vi.stubGlobal('fetch', fetchMock)
    const out = await githubIssueStatusFor('/repo', TOKEN)
    expect(out).toEqual({ connected: true, repoFullName: 'acme/app' })
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://api.github.com/repos/acme/app')
  })

  it('GET /repos 401: connected false y el mensaje de token inválido', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ message: 'Bad credentials' }, 401)))
    const out = await githubIssueStatusFor('/repo', TOKEN)
    expect(out.connected).toBe(false)
    expect(out.repoFullName).toBe('acme/app')
    expect(out.error).toBe('Token de GitHub inválido o revocado.')
  })

  it('GET /repos 403: connected false y el mensaje de GitHub', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ message: 'Resource not accessible by integration' }, 403)))
    const out = await githubIssueStatusFor('/repo', TOKEN)
    expect(out.connected).toBe(false)
    expect(out.repoFullName).toBe('acme/app')
    expect(out.error).toBe('Resource not accessible by integration')
  })

  it('GET /repos 404: connected false y el mensaje de acceso al repo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ message: 'Not Found' }, 404)))
    const out = await githubIssueStatusFor('/repo', TOKEN)
    expect(out.connected).toBe(false)
    expect(out.repoFullName).toBe('acme/app')
    expect(out.error).toBe('La cuenta de GitHub del workspace no tiene acceso a este repositorio.')
  })

  it('dos llamadas seguidas al status con el mismo repo y token hacen una sola petición HTTP', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ full_name: 'acme/app' }))
    vi.stubGlobal('fetch', fetchMock)
    await githubIssueStatusFor('/repo', TOKEN)
    await githubIssueStatusFor('/repo', TOKEN)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('searchGithubIssuesQuick', () => {
  it('nunca lanza: un fallo de red vuelve como error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('timeout') }))
    const out = await searchGithubIssuesQuick('/repo', TOKEN, 'login')
    expect(out.issues).toEqual([])
    expect(out.error).toContain('timeout')
  })

  function searchWouldReturnUnrelated(url: string) {
    if (String(url).includes('/search/issues')) {
      return jsonResponse({
        items: [
          { ...issueJson, number: 299982, title: 'no es esta' },
          { ...issueJson, number: 303481, title: 'tampoco' },
        ],
      })
    }
    return null
  }

  it('dígitos con issue existente devuelve solo esa y no llama a Search', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const search = searchWouldReturnUnrelated(url)
      if (search) return search
      if (String(url).includes('/comments')) return jsonResponse([])
      if (String(url).includes('/issues/12')) return jsonResponse(issueJson)
      return jsonResponse({ message: 'nf' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    const out = await searchGithubIssuesQuick('/repo', TOKEN, '12')
    expect(out.issues.map(issue => issue.number)).toEqual([12])
    expect(out.issues[0]?.title).toBe('Login roto')
    expect(out.error).toBeUndefined()
    const urls = fetchMock.mock.calls.map(call => String(call[0]))
    expect(urls.some(url => url.includes('/search/issues'))).toBe(false)
    expect(urls.some(url => url.includes('/repos/acme/app/issues/12'))).toBe(true)
  })

  it('dígitos con 404 devuelve issues vacío y sin error; no llama a Search', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const search = searchWouldReturnUnrelated(url)
      if (search) return search
      return jsonResponse({ message: 'Not Found' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    const out = await searchGithubIssuesQuick('/repo', TOKEN, '999999999')
    expect(out.issues).toEqual([])
    expect(out.error).toBeUndefined()
    const urls = fetchMock.mock.calls.map(call => String(call[0]))
    expect(urls.some(url => url.includes('/search/issues'))).toBe(false)
  })

  it('dígitos con 500 devuelve error y no llama a Search', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const search = searchWouldReturnUnrelated(url)
      if (search) return search
      return jsonResponse({ message: 'Server Error' }, 500)
    })
    vi.stubGlobal('fetch', fetchMock)

    const out = await searchGithubIssuesQuick('/repo', TOKEN, '12')
    expect(out.issues).toEqual([])
    expect(out.error).toBeTruthy()
    const urls = fetchMock.mock.calls.map(call => String(call[0]))
    expect(urls.some(url => url.includes('/search/issues'))).toBe(false)
  })

  it('descarta pull requests de la búsqueda', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('/search/issues')) {
        return jsonResponse({
          items: [
            { ...issueJson, number: 1, pull_request: { url: 'https://api.github.com/repos/acme/app/pulls/1' } },
            { ...issueJson, number: 2, title: 'Issue real' },
          ],
        })
      }
      return jsonResponse([])
    }))
    const out = await searchGithubIssuesQuick('/repo', TOKEN, 'x')
    expect(out.issues.map(issue => issue.number)).toEqual([2])
  })
})

describe('previewGithubIssue', () => {
  it('devuelve el mismo markdown que escribe el refresher y no escribe disco', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-gh-preview-'))
    mkdirSync(join(dir, '.gravity'), { recursive: true })
    const result = await previewGithubIssue(dir, TOKEN, 12)
    expect(result.ok).toBe(true)
    expect(result.content).toContain('## Resumen')
    expect(result.content).toContain('acme/app#12 · Login roto')
    expect(result.content).toContain('El botón no hace nada.')
  })

  it('un número inválido ni sale a la red', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect((await previewGithubIssue('/repo', TOKEN, 0)).ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
