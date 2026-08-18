import { describeFetchError, httpFetch } from './httpFetch'
import type { GitHubActionsRun, GitHubJob } from '../src/shared/githubActionsTypes'
import type { GithubIssueRef, GithubIssueSnapshot } from '../src/shared/githubIssue'
import type { GithubRepoOption } from '../src/shared/githubRepoPicker'

export class GitHubApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'GitHubApiError'
    this.status = status
  }
}

interface RestWorkflowRun {
  id: number
  name?: string
  status?: string
  conclusion?: string | null
  html_url?: string
  updated_at?: string
  created_at?: string
  head_branch?: string | null
  event?: string
  display_title?: string
}

async function parseGitHubError(response: Response): Promise<GitHubApiError> {
  let message = `GitHub respondió con ${response.status}.`
  try {
    const body = (await response.json()) as { message?: string }
    if (body.message) message = body.message
  } catch {
    /* ignore */
  }
  return new GitHubApiError(message, response.status)
}

export async function githubFetch(
  token: string,
  url: string,
): Promise<Response> {
  let response: Response
  try {
    response = await httpFetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
  } catch (error) {
    // Status 0: no hubo respuesta HTTP. El mensaje trae el `cause` (proxy, CA, DNS).
    throw new GitHubApiError(describeFetchError(error), 0)
  }

  if (!response.ok) {
    throw await parseGitHubError(response)
  }

  return response
}

interface RestJobStep {
  number?: number
  name?: string
  status?: string
  conclusion?: string | null
  started_at?: string | null
  completed_at?: string | null
}

interface RestJob {
  id?: number
  name?: string
  status?: string
  conclusion?: string | null
  started_at?: string | null
  completed_at?: string | null
  html_url?: string
  steps?: RestJobStep[]
}

/** Jobs de un run con sus steps. Se pide sólo al desplegar, no por cada run listado. */
export async function fetchRunJobs(
  token: string,
  fullName: string,
  runId: number,
): Promise<GitHubJob[]> {
  const [owner, name] = fullName.split('/')
  if (!owner || !name) return []

  const url = new URL(
    `https://api.github.com/repos/${owner}/${name}/actions/runs/${runId}/jobs`,
  )
  // 100 es el máximo de la API; ningún workflow razonable pasa de ahí.
  url.searchParams.set('per_page', '100')

  const response = await githubFetch(token, url.toString())
  const body = (await response.json()) as { jobs?: RestJob[] }

  return (body.jobs ?? []).map(job => ({
    id: job.id ?? 0,
    name: job.name ?? '',
    status: job.status ?? '',
    conclusion: job.conclusion ?? null,
    startedAt: job.started_at ?? null,
    completedAt: job.completed_at ?? null,
    url: job.html_url ?? '',
    steps: (job.steps ?? []).map(step => ({
      number: step.number ?? 0,
      name: step.name ?? '',
      status: step.status ?? '',
      conclusion: step.conclusion ?? null,
      startedAt: step.started_at ?? null,
      completedAt: step.completed_at ?? null,
    })),
  }))
}

/**
 * Identidad del token: sirve para decir «conectado como @x» en Ajustes en vez
 * de dejar un campo de contraseña que no se sabe si sigue siendo válido.
 */
export async function fetchGitHubIdentity(
  token: string,
): Promise<{ login: string; scopes: string[] }> {
  const response = await githubFetch(token, 'https://api.github.com/user')
  const body = (await response.json()) as { login?: string }
  // Sólo los PAT clásicos declaran scopes en la cabecera; los fine-grained no la envían.
  const scopes = (response.headers.get('x-oauth-scopes') ?? '')
    .split(',')
    .map(scope => scope.trim())
    .filter(Boolean)
  return { login: body.login ?? '', scopes }
}

export function mapRestWorkflowRun(raw: RestWorkflowRun): GitHubActionsRun | null {
  const id = raw.id
  if (!Number.isFinite(id)) return null
  return {
    id,
    title: String(raw.display_title ?? raw.name ?? 'Workflow run'),
    status: String(raw.status ?? 'unknown'),
    conclusion: raw.conclusion != null ? String(raw.conclusion) : null,
    headBranch: String(raw.head_branch ?? ''),
    event: String(raw.event ?? ''),
    createdAt: String(raw.created_at ?? ''),
    updatedAt: String(raw.updated_at ?? ''),
    url: String(raw.html_url ?? ''),
  }
}

export async function fetchWorkflowRuns(
  token: string,
  fullName: string,
  limit: number,
): Promise<GitHubActionsRun[]> {
  const [owner, name] = fullName.split('/')
  if (!owner || !name) return []

  const url = new URL(`https://api.github.com/repos/${owner}/${name}/actions/runs`)
  url.searchParams.set('per_page', String(limit))

  const response = await githubFetch(token, url.toString())
  const body = (await response.json()) as { workflow_runs?: RestWorkflowRun[] }
  const runs: GitHubActionsRun[] = []

  for (const item of body.workflow_runs ?? []) {
    const mapped = mapRestWorkflowRun(item)
    if (mapped) runs.push(mapped)
  }

  return runs
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function stringField(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function mapGithubIssueState(raw: unknown): 'open' | 'closed' {
  return raw === 'closed' ? 'closed' : 'open'
}

function mapLabelNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map(entry => typeof entry === 'string' ? entry : stringField(asRecord(entry).name))
    .filter(Boolean)
}

function mapIssueRef(raw: unknown, repoFullName: string): GithubIssueRef | null {
  const item = asRecord(raw)
  const number = Number(item.number)
  if (!Number.isInteger(number) || number <= 0) return null
  if (item.pull_request) return null
  return {
    number,
    title: stringField(item.title),
    state: mapGithubIssueState(item.state),
    repoFullName,
    updated: stringField(item.updated_at),
    author: stringField(asRecord(item.user).login),
    labels: mapLabelNames(item.labels),
  }
}

/**
 * Busca issues (nunca PRs) en un repo. `q = repo:<fullName> is:issue <query>`.
 */
export async function searchGithubIssues(
  token: string,
  fullName: string,
  query: string,
  limit = 8,
): Promise<GithubIssueRef[]> {
  const [owner, name] = fullName.split('/')
  if (!owner || !name) return []
  const perPage = Math.min(Math.max(limit, 1), 100)
  const q = [`repo:${fullName}`, 'is:issue', query.trim()].filter(Boolean).join(' ')
  const url = new URL('https://api.github.com/search/issues')
  url.searchParams.set('q', q)
  url.searchParams.set('sort', 'updated')
  url.searchParams.set('order', 'desc')
  url.searchParams.set('per_page', String(perPage))

  const response = await githubFetch(token, url.toString())
  const body = asRecord(await response.json())
  const items = Array.isArray(body.items) ? body.items : []
  const issues: GithubIssueRef[] = []
  for (const item of items) {
    const mapped = mapIssueRef(item, fullName)
    if (mapped) issues.push(mapped)
  }
  return issues
}

function mapComment(raw: unknown): { author: string; created: string; body: string } {
  const comment = asRecord(raw)
  return {
    author: stringField(asRecord(comment.user).login),
    created: stringField(comment.created_at),
    body: stringField(comment.body),
  }
}

/**
 * Issue + comentarios. `maxComments` 0 es cero comentarios, no «todos».
 */
export async function githubGetIssue(
  token: string,
  fullName: string,
  number: number,
  maxComments = 20,
): Promise<GithubIssueSnapshot> {
  const [owner, name] = fullName.split('/')
  if (!owner || !name) {
    throw new GitHubApiError('Repositorio de GitHub no válido.', 0)
  }
  const issueResponse = await githubFetch(
    token,
    `https://api.github.com/repos/${owner}/${name}/issues/${number}`,
  )
  const raw = asRecord(await issueResponse.json())
  const ref = mapIssueRef({ ...raw, pull_request: undefined }, fullName)
  if (!ref) {
    throw new GitHubApiError(`Issue #${number} no encontrada.`, 404)
  }

  let comments: GithubIssueSnapshot['comments'] = []
  if (maxComments > 0) {
    const commentsUrl = new URL(
      `https://api.github.com/repos/${owner}/${name}/issues/${number}/comments`,
    )
    commentsUrl.searchParams.set('per_page', '100')
    const commentsResponse = await githubFetch(token, commentsUrl.toString())
    const page = await commentsResponse.json()
    const list = Array.isArray(page) ? page.map(mapComment) : []
    comments = list.slice(-maxComments)
  }

  return {
    ...ref,
    url: stringField(raw.html_url) || `https://github.com/${fullName}/issues/${number}`,
    body: stringField(raw.body),
    assignees: Array.isArray(raw.assignees)
      ? raw.assignees.map(entry => stringField(asRecord(entry).login)).filter(Boolean)
      : [],
    milestone: raw.milestone ? (stringField(asRecord(raw.milestone).title) || null) : null,
    comments,
  }
}

export function mapRestRepo(raw: unknown): GithubRepoOption | null {
  const item = asRecord(raw)
  const fullName = stringField(item.full_name)
  const cloneUrl = stringField(item.clone_url)
  if (!fullName || !cloneUrl) return null
  return {
    fullName,
    cloneUrl,
    isPrivate: Boolean(item.private),
    archived: Boolean(item.archived),
    pushedAt: stringField(item.pushed_at) || stringField(item.updated_at),
    description: stringField(item.description),
  }
}

/**
 * Repos visibles para el token: owner + collaborator + org member.
 * Para en cuanto una página traiga <100 o al llegar a `maxPages`.
 */
export async function fetchGithubUserRepos(
  token: string,
  maxPages = 5,
): Promise<{ repos: GithubRepoOption[]; truncated: boolean }> {
  const repos: GithubRepoOption[] = []
  let truncated = false
  const pages = Math.max(1, maxPages)
  for (let page = 1; page <= pages; page++) {
    const url =
      `https://api.github.com/user/repos?per_page=100&sort=pushed` +
      `&affiliation=owner,collaborator,organization_member&page=${page}`
    const response = await githubFetch(token, url)
    const body = await response.json()
    const items = Array.isArray(body) ? body : []
    for (const item of items) {
      const mapped = mapRestRepo(item)
      if (mapped) repos.push(mapped)
    }
    if (items.length < 100) {
      truncated = false
      break
    }
    truncated = true
  }
  return { repos, truncated }
}

export async function searchGithubRepos(
  token: string,
  query: string,
): Promise<{ repos: GithubRepoOption[]; truncated: boolean }> {
  const url =
    `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}+fork:true` +
    `&per_page=50&sort=updated`
  const response = await githubFetch(token, url)
  const body = asRecord(await response.json())
  const items = Array.isArray(body.items) ? body.items : []
  const repos: GithubRepoOption[] = []
  for (const item of items) {
    const mapped = mapRestRepo(item)
    if (mapped) repos.push(mapped)
  }
  const totalCount = typeof body.total_count === 'number' ? body.total_count : 0
  return { repos, truncated: totalCount > items.length }
}
