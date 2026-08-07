import type {
  CovenantDefault,
  CovenantMember,
  CovenantOrg,
  CovenantProject,
  CovenantStatus,
} from '../src/shared/covenantTypes'

const BASE_URL = process.env.COVENANT_BACKEND_URL || 'https://forge.covenant.uno'

export class CovenantApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'CovenantApiError'
    this.status = status
  }
}

interface ExchangeResponse {
  jwt: string
  login: string
  avatar_url: string
  github_id: string | number
}

let cachedJwt: string | null = null
let cachedLogin: string | undefined
let cachedAvatarUrl: string | undefined
let cachedGithubId: string | number | undefined
let lastGithubToken: string | null = null

async function parseCovenantError(response: Response): Promise<CovenantApiError> {
  let message = `Covenant respondió con ${response.status}.`
  try {
    const body = (await response.json()) as { message?: string; error?: string }
    if (body.message) message = body.message
    else if (typeof body.error === 'string' && body.error) message = body.error
  } catch {
    /* ignore */
  }
  return new CovenantApiError(message, response.status)
}

export async function exchange(githubToken: string): Promise<ExchangeResponse> {
  const response = await fetch(`${BASE_URL}/auth/exchange`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'covenant-client',
    },
    body: JSON.stringify({ github_access_token: githubToken }),
  })

  if (!response.ok) {
    throw await parseCovenantError(response)
  }

  const data = (await response.json()) as ExchangeResponse
  lastGithubToken = githubToken
  cachedJwt = data.jwt
  cachedLogin = data.login
  cachedAvatarUrl = data.avatar_url
  cachedGithubId = data.github_id
  return data
}

async function authedFetch(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<Response> {
  const doFetch = async (jwt: string): Promise<Response> => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/json',
      'User-Agent': 'covenant-client',
    }
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json'
    }
    return fetch(`${BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
  }

  if (!cachedJwt) {
    throw new CovenantApiError('Not signed in', 401)
  }

  let response = await doFetch(cachedJwt)
  if (response.status === 401) {
    if (!lastGithubToken) {
      throw await parseCovenantError(response)
    }
    await exchange(lastGithubToken)
    if (!cachedJwt) {
      throw new CovenantApiError('Not signed in', 401)
    }
    response = await doFetch(cachedJwt)
  }

  if (!response.ok) {
    throw await parseCovenantError(response)
  }

  return response
}

export function status(): CovenantStatus {
  if (!cachedJwt) {
    return { signedIn: false }
  }
  return {
    signedIn: true,
    login: cachedLogin,
    avatarUrl: cachedAvatarUrl,
    githubId: cachedGithubId,
  }
}

export function signOut(): void {
  cachedJwt = null
  cachedLogin = undefined
  cachedAvatarUrl = undefined
  cachedGithubId = undefined
  lastGithubToken = null
}

export async function listOrgs(): Promise<CovenantOrg[]> {
  const response = await authedFetch('/orgs')
  return (await response.json()) as CovenantOrg[]
}

export async function createOrg(slug: string, name: string): Promise<CovenantOrg> {
  const response = await authedFetch('/orgs', {
    method: 'POST',
    body: { slug, name },
  })
  return (await response.json()) as CovenantOrg
}

export async function listMembers(slug: string): Promise<CovenantMember[]> {
  const response = await authedFetch(`/orgs/${encodeURIComponent(slug)}/members`)
  return (await response.json()) as CovenantMember[]
}

export async function listMemberLogins(slug: string): Promise<string[]> {
  const response = await authedFetch(`/orgs/${encodeURIComponent(slug)}/member-logins`)
  const body = (await response.json()) as unknown
  if (!Array.isArray(body)) return []
  return body.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

export async function addMember(slug: string, login: string): Promise<void> {
  await authedFetch(`/orgs/${encodeURIComponent(slug)}/members`, {
    method: 'POST',
    body: { login },
  })
}

export async function removeMember(slug: string, login: string): Promise<void> {
  await authedFetch(
    `/orgs/${encodeURIComponent(slug)}/members/${encodeURIComponent(login)}`,
    { method: 'DELETE' },
  )
}

export async function listDefaults(slug: string): Promise<CovenantDefault[]> {
  const response = await authedFetch(`/orgs/${encodeURIComponent(slug)}/defaults`)
  return (await response.json()) as CovenantDefault[]
}

export async function setDefault(slug: string, kind: string, name: string): Promise<void> {
  await authedFetch(
    `/orgs/${encodeURIComponent(slug)}/defaults/${encodeURIComponent(kind)}/${encodeURIComponent(name)}`,
    { method: 'PUT' },
  )
}

export async function unsetDefault(slug: string, kind: string, name: string): Promise<void> {
  await authedFetch(
    `/orgs/${encodeURIComponent(slug)}/defaults/${encodeURIComponent(kind)}/${encodeURIComponent(name)}`,
    { method: 'DELETE' },
  )
}

export async function listProjects(slug: string): Promise<CovenantProject[]> {
  const response = await authedFetch(`/orgs/${encodeURIComponent(slug)}/projects`)
  return (await response.json()) as CovenantProject[]
}

export async function createProject(slug: string, name: string): Promise<CovenantProject> {
  const response = await authedFetch(`/orgs/${encodeURIComponent(slug)}/projects`, {
    method: 'POST',
    body: { name },
  })
  return (await response.json()) as CovenantProject
}

export async function renameProject(
  slug: string,
  projectId: string,
  name: string,
): Promise<CovenantProject> {
  const response = await authedFetch(
    `/orgs/${encodeURIComponent(slug)}/projects/${encodeURIComponent(projectId)}`,
    { method: 'PATCH', body: { name } },
  )
  return (await response.json()) as CovenantProject
}

export async function deleteProject(slug: string, projectId: string): Promise<void> {
  await authedFetch(
    `/orgs/${encodeURIComponent(slug)}/projects/${encodeURIComponent(projectId)}`,
    { method: 'DELETE' },
  )
}

export async function addAssignee(slug: string, projectId: string, login: string): Promise<void> {
  await authedFetch(
    `/orgs/${encodeURIComponent(slug)}/projects/${encodeURIComponent(projectId)}/assignees`,
    { method: 'POST', body: { login } },
  )
}

export async function removeAssignee(
  slug: string,
  projectId: string,
  login: string,
): Promise<void> {
  await authedFetch(
    `/orgs/${encodeURIComponent(slug)}/projects/${encodeURIComponent(projectId)}/assignees/${encodeURIComponent(login)}`,
    { method: 'DELETE' },
  )
}

export async function addProjectAdmin(
  slug: string,
  projectId: string,
  login: string,
): Promise<void> {
  await authedFetch(
    `/orgs/${encodeURIComponent(slug)}/projects/${encodeURIComponent(projectId)}/admins`,
    { method: 'POST', body: { login } },
  )
}

export async function removeProjectAdmin(
  slug: string,
  projectId: string,
  login: string,
): Promise<void> {
  await authedFetch(
    `/orgs/${encodeURIComponent(slug)}/projects/${encodeURIComponent(projectId)}/admins/${encodeURIComponent(login)}`,
    { method: 'DELETE' },
  )
}

export async function listOrgAdmins(slug: string): Promise<string[]> {
  const response = await authedFetch(`/orgs/${encodeURIComponent(slug)}/admins`)
  const body = (await response.json()) as unknown
  if (!Array.isArray(body)) return []
  return body
    .map(item => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object' && 'login' in item) {
        const login = (item as { login: unknown }).login
        return typeof login === 'string' ? login : null
      }
      return null
    })
    .filter((login): login is string => !!login)
}

export async function addOrgAdmin(slug: string, login: string): Promise<void> {
  await authedFetch(`/orgs/${encodeURIComponent(slug)}/admins`, {
    method: 'POST',
    body: { login },
  })
}

export async function removeOrgAdmin(slug: string, login: string): Promise<void> {
  await authedFetch(
    `/orgs/${encodeURIComponent(slug)}/admins/${encodeURIComponent(login)}`,
    { method: 'DELETE' },
  )
}
