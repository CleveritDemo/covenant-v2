import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, utimesSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { TabContext } from '../../src/shared/tabContext'
import type { GithubIssueSnapshot } from '../../src/shared/githubIssue'

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

const { refreshStaleGithubIssueContexts, clearGithubIssueRefreshFailures } =
  await import('../githubIssueContextRefresh')
const { materializeTabContext } = await import('../tabContextBuild')

const snapshot: GithubIssueSnapshot = {
  number: 86,
  title: 'nuevo título',
  state: 'open',
  repoFullName: 'acme/app',
  updated: '2026-08-12T09:40:00.000Z',
  author: 'ana',
  labels: [],
  url: 'https://github.com/acme/app/issues/86',
  body: 'cuerpo nuevo',
  assignees: [],
  milestone: null,
  comments: [],
}

const context: TabContext = {
  id: 'iaterminal:githubissue:acme-app-86',
  name: 'acme/app#86',
  fileName: 'github/acme-app-86.md',
  kind: 'githubIssue',
  issueNumber: 86,
  repoFullName: 'acme/app',
}

function project(): string {
  const dir = mkdtempSync(join(tmpdir(), 'gravity-gh-refresh-'))
  mkdirSync(join(dir, '.gravity', 'github'), { recursive: true })
  gitMocks.getRepoRoot.mockResolvedValue(dir)
  gitMocks.resolveGitHubRepo.mockResolvedValue({ owner: 'acme', repo: 'app', fullName: 'acme/app' })
  return dir
}

const issuePath = (dir: string): string => join(dir, '.gravity', 'github', 'acme-app-86.md')

beforeEach(() => {
  clearGithubIssueRefreshFailures()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('refreshStaleGithubIssueContexts', () => {
  it('sin snapshot previo lo crea', async () => {
    const dir = project()
    await refreshStaleGithubIssueContexts([context], dir, 'tok', { fetchIssue: async () => snapshot })
    expect(readFileSync(issuePath(dir), 'utf8')).toContain('nuevo título')
  })

  it('un snapshot fresco no se vuelve a pedir', async () => {
    const dir = project()
    writeFileSync(issuePath(dir), '<!-- iaterminal:auto -->\n## Resumen\nviejo\n<!-- /iaterminal:auto -->', 'utf8')
    const fetchIssue = vi.fn(async () => snapshot)
    await refreshStaleGithubIssueContexts([context], dir, 'tok', { fetchIssue })
    expect(fetchIssue).not.toHaveBeenCalled()
  })

  it('un snapshot vencido se refresca y conserva las notas', async () => {
    const dir = project()
    writeFileSync(
      issuePath(dir),
      [
        '<!-- iaterminal:auto -->',
        '## Resumen',
        'viejo',
        '<!-- /iaterminal:auto -->',
        '',
        '<!-- iaterminal:notes -->',
        'la carrera está en loopChainFifo',
        '<!-- /iaterminal:notes -->',
      ].join('\n'),
      'utf8',
    )
    const old = new Date(Date.now() - 3_600_000)
    utimesSync(issuePath(dir), old, old)
    await refreshStaleGithubIssueContexts([context], dir, 'tok', { fetchIssue: async () => snapshot })
    const body = readFileSync(issuePath(dir), 'utf8')
    expect(body).toContain('nuevo título')
    expect(body).toContain('la carrera está en loopChainFifo')
  })

  it('si GitHub falla, el snapshot anterior queda intacto y no se lanza', async () => {
    const dir = project()
    writeFileSync(issuePath(dir), '<!-- iaterminal:auto -->\n## Resumen\nviejo\n<!-- /iaterminal:auto -->', 'utf8')
    const old = new Date(Date.now() - 3_600_000)
    utimesSync(issuePath(dir), old, old)
    await refreshStaleGithubIssueContexts([context], dir, 'tok', {
      fetchIssue: async () => { throw new Error('502') },
    })
    expect(readFileSync(issuePath(dir), 'utf8')).toContain('viejo')
  })

  it('sin token no hace nada', async () => {
    const dir = project()
    const fetchIssue = vi.fn(async () => snapshot)
    await refreshStaleGithubIssueContexts([context], dir, '', { fetchIssue })
    expect(fetchIssue).not.toHaveBeenCalled()
  })

  it('ignora los contextos que no son githubIssue', async () => {
    const dir = project()
    const fetchIssue = vi.fn(async () => snapshot)
    await refreshStaleGithubIssueContexts(
      [{ id: 'x', name: 'Git', fileName: 'git.md', kind: 'git' }],
      dir,
      'tok',
      { fetchIssue },
    )
    expect(fetchIssue).not.toHaveBeenCalled()
  })

  it('una issue que falló no se reintenta dentro del cooldown', async () => {
    const dir = project()
    const fetchIssue = vi.fn(async () => { throw new Error('404') })
    await refreshStaleGithubIssueContexts([context], dir, 'tok', { fetchIssue })
    await refreshStaleGithubIssueContexts([context], dir, 'tok', { fetchIssue })
    expect(fetchIssue).toHaveBeenCalledTimes(1)
  })

  it('el presupuesto total corta la espera aunque el fetch nunca resuelva', async () => {
    const dir = project()
    await expect(refreshStaleGithubIssueContexts([context], dir, 'tok', {
      fetchIssue: () => new Promise<GithubIssueSnapshot>(() => {}),
      budgetMs: 5,
    })).resolves.toBeUndefined()
  })

  it('materialize lee el archivo que acaba de escribir el refresher', async () => {
    const dir = project()
    await refreshStaleGithubIssueContexts([context], dir, 'tok', { fetchIssue: async () => snapshot })
    const materialized = materializeTabContext(context, dir)
    expect(materialized.ok).toBe(true)
    expect(materialized.content).toContain('nuevo título')
  })
})
