import type { GitHubActionsRun } from '../src/shared/githubActionsTypes'

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
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!response.ok) {
    throw await parseGitHubError(response)
  }

  return response
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
