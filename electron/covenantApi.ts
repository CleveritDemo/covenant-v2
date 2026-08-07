import type {
  CovenantDefault,
  CovenantMember,
  CovenantOrg,
  CovenantWorkspace,
  CovenantWorkspaceAgentRecord,
  CovenantWorkspaceContextPayload,
  CovenantWorkspaceContextRecord,
  CovenantStatus,
} from '../src/shared/covenantTypes'
import type { ProjectAgentDefinition } from '../src/shared/projectAgentCatalog'
import { clearCovenantSession, loadCovenantSession, persistCovenantSession } from './covenantSession'

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
  persistCovenantSession({
    jwt: data.jwt,
    login: data.login,
    avatarUrl: data.avatar_url,
    githubId: data.github_id,
    githubToken,
  })
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
  clearCovenantSession()
}

/**
 * Rehidrata la sesión Covenant desde el archivo cifrado en disco.
 * Debe llamarse al arrancar main.ts, antes de registrar los handlers IPC.
 * Si la sesión persiste válida, status() devolverá signedIn:true sin re-login.
 */
export function initCovenantSession(): void {
  const saved = loadCovenantSession()
  if (!saved) return
  cachedJwt = saved.jwt
  cachedLogin = saved.login
  cachedAvatarUrl = saved.avatarUrl
  cachedGithubId = saved.githubId
  lastGithubToken = saved.githubToken
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

export async function listWorkspaces(slug: string): Promise<CovenantWorkspace[]> {
  const response = await authedFetch(`/orgs/${encodeURIComponent(slug)}/workspaces`)
  return (await response.json()) as CovenantWorkspace[]
}

export async function createWorkspace(slug: string, name: string): Promise<CovenantWorkspace> {
  const response = await authedFetch(`/orgs/${encodeURIComponent(slug)}/workspaces`, {
    method: 'POST',
    body: { name },
  })
  return (await response.json()) as CovenantWorkspace
}

export async function renameWorkspace(
  slug: string,
  workspaceId: string,
  name: string,
): Promise<CovenantWorkspace> {
  const response = await authedFetch(
    `/orgs/${encodeURIComponent(slug)}/workspaces/${encodeURIComponent(workspaceId)}`,
    { method: 'PATCH', body: { name } },
  )
  return (await response.json()) as CovenantWorkspace
}

export async function deleteWorkspace(slug: string, workspaceId: string): Promise<void> {
  await authedFetch(
    `/orgs/${encodeURIComponent(slug)}/workspaces/${encodeURIComponent(workspaceId)}`,
    { method: 'DELETE' },
  )
}

export async function addAssignee(slug: string, workspaceId: string, login: string): Promise<void> {
  await authedFetch(
    `/orgs/${encodeURIComponent(slug)}/workspaces/${encodeURIComponent(workspaceId)}/assignees`,
    { method: 'POST', body: { login } },
  )
}

export async function removeAssignee(
  slug: string,
  workspaceId: string,
  login: string,
): Promise<void> {
  await authedFetch(
    `/orgs/${encodeURIComponent(slug)}/workspaces/${encodeURIComponent(workspaceId)}/assignees/${encodeURIComponent(login)}`,
    { method: 'DELETE' },
  )
}

export async function addWorkspaceAdmin(
  slug: string,
  workspaceId: string,
  login: string,
): Promise<void> {
  await authedFetch(
    `/orgs/${encodeURIComponent(slug)}/workspaces/${encodeURIComponent(workspaceId)}/admins`,
    { method: 'POST', body: { login } },
  )
}

export async function removeWorkspaceAdmin(
  slug: string,
  workspaceId: string,
  login: string,
): Promise<void> {
  await authedFetch(
    `/orgs/${encodeURIComponent(slug)}/workspaces/${encodeURIComponent(workspaceId)}/admins/${encodeURIComponent(login)}`,
    { method: 'DELETE' },
  )
}

export async function listWorkspaceAgents(
  slug: string,
  workspaceId: string,
): Promise<CovenantWorkspaceAgentRecord[]> {
  const response = await authedFetch(
    `/orgs/${encodeURIComponent(slug)}/workspaces/${encodeURIComponent(workspaceId)}/agents`,
  )
  return (await response.json()) as CovenantWorkspaceAgentRecord[]
}

export async function upsertWorkspaceAgent(
  slug: string,
  workspaceId: string,
  agentId: string,
  definition: ProjectAgentDefinition,
): Promise<CovenantWorkspaceAgentRecord> {
  const response = await authedFetch(
    `/orgs/${encodeURIComponent(slug)}/workspaces/${encodeURIComponent(workspaceId)}/agents/${encodeURIComponent(agentId)}`,
    { method: 'PUT', body: { definition } },
  )
  return (await response.json()) as CovenantWorkspaceAgentRecord
}

export async function deleteWorkspaceAgent(
  slug: string,
  workspaceId: string,
  agentId: string,
): Promise<void> {
  await authedFetch(
    `/orgs/${encodeURIComponent(slug)}/workspaces/${encodeURIComponent(workspaceId)}/agents/${encodeURIComponent(agentId)}`,
    { method: 'DELETE' },
  )
}

export async function listWorkspaceContexts(
  slug: string,
  workspaceId: string,
): Promise<CovenantWorkspaceContextRecord[]> {
  const response = await authedFetch(
    `/orgs/${encodeURIComponent(slug)}/workspaces/${encodeURIComponent(workspaceId)}/contexts`,
  )
  return (await response.json()) as CovenantWorkspaceContextRecord[]
}

export async function upsertWorkspaceContext(
  slug: string,
  workspaceId: string,
  contextId: string,
  payload: CovenantWorkspaceContextPayload,
): Promise<CovenantWorkspaceContextRecord> {
  const response = await authedFetch(
    `/orgs/${encodeURIComponent(slug)}/workspaces/${encodeURIComponent(workspaceId)}/contexts/${encodeURIComponent(contextId)}`,
    {
      method: 'PUT',
      body: {
        kind: payload.kind,
        name: payload.name,
        body: payload.body ?? '',
        meta: payload.meta ?? null,
      },
    },
  )
  return (await response.json()) as CovenantWorkspaceContextRecord
}

export async function deleteWorkspaceContext(
  slug: string,
  workspaceId: string,
  contextId: string,
): Promise<void> {
  await authedFetch(
    `/orgs/${encodeURIComponent(slug)}/workspaces/${encodeURIComponent(workspaceId)}/contexts/${encodeURIComponent(contextId)}`,
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
