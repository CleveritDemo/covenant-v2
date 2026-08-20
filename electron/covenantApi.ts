import type {
  CovenantDefault,
  CovenantMember,
  CovenantOrg,
  CovenantWikiLogEntryRecord,
  CovenantWikiPagePayload,
  CovenantWikiPageRecord,
  CovenantWorkspace,
  CovenantWorkspaceAgentRecord,
  CovenantWorkspaceContextPayload,
  CovenantWorkspaceContextRecord,
  CovenantWorkspaceRepoPayload,
  CovenantWorkspaceRepoRecord,
  CovenantWorkspaceRepoUpdatePayload,
  CovenantStatus,
} from '../src/shared/covenantTypes'
import type { ProjectAgentDefinition } from '../src/shared/projectAgentCatalog'
import { renameWorkspaceContext as renameWorkspaceContextHelper } from '../src/shared/orgWorkspaceContent'
import { clearCovenantSession, loadCovenantSessions, persistCovenantSession } from './covenantSession'
import { describeFetchError, httpFetch } from './httpFetch'

const BASE_URL = process.env.COVENANT_BACKEND_URL || 'https://forge.covenant.uno'

const MAX_CONCURRENT_REQUESTS = 4
const REQUEST_TIMEOUT_MS = 30_000

let activeRequests = 0
const requestWaiters: Array<() => void> = []

async function acquireRequestSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT_REQUESTS) {
    activeRequests += 1
    return
  }
  return new Promise((resolve) => {
    requestWaiters.push(resolve)
  })
}

function releaseRequestSlot(): void {
  const next = requestWaiters.shift()
  if (next) {
    // El slot se traspasa al waiter: no decrementar activeRequests.
    next()
    return
  }
  activeRequests -= 1
}

/**
 * Fetch acotado para Covenant: concurrencia ≤4 y timeout 30s.
 * No confía en que AbortSignal rechace httpFetch: Promise.race fuerza el rechazo.
 * El slot cubre headers (request en vuelo), no la lectura del body; se libera siempre.
 */
export async function covenantFetch(url: string, init: RequestInit = {}): Promise<Response> {
  await acquireRequestSlot()
  const controller = new AbortController()
  const method = init.method ?? 'GET'
  const started = Date.now()
  let timedOut = false
  let rejectTimeout: ((error: Error) => void) | undefined
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
    rejectTimeout?.(new Error('Covenant no respondió en 30s'))
  }, REQUEST_TIMEOUT_MS)
  if (typeof (timer as NodeJS.Timeout).unref === 'function') {
    ;(timer as NodeJS.Timeout).unref()
  }
  try {
    const response = await Promise.race([
      httpFetch(url, { ...init, signal: controller.signal }),
      new Promise<never>((_, reject) => {
        rejectTimeout = reject
      }),
    ])
    const ms = Date.now() - started
    console.log('[covenant]', method, url, `${ms}ms`, response.status)
    if (ms > 5000) {
      console.warn('[covenant] lenta/timeout')
    }
    return response
  } catch (error) {
    if (timedOut) {
      console.warn('[covenant] lenta/timeout')
      throw new Error('Covenant no respondió en 30s')
    }
    throw error
  } finally {
    clearTimeout(timer)
    releaseRequestSlot()
  }
}

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

type CovenantLiveSession = {
  jwt: string
  login?: string
  avatarUrl?: string
  githubId?: string | number
  githubToken: string | null
}

const sessions = new Map<string, CovenantLiveSession>()

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

export async function exchange(accountId: string, githubToken: string): Promise<ExchangeResponse> {
  let response: Response
  try {
    response = await covenantFetch(`${BASE_URL}/auth/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'covenant-client',
      },
      body: JSON.stringify({ github_access_token: githubToken }),
    })
  } catch (error) {
    // Status 0: no hubo respuesta HTTP. El mensaje trae el `cause` (proxy, CA, DNS).
    throw new CovenantApiError(describeFetchError(error), 0)
  }

  if (!response.ok) {
    throw await parseCovenantError(response)
  }

  const data = (await response.json()) as ExchangeResponse
  sessions.set(accountId, {
    jwt: data.jwt,
    login: data.login,
    avatarUrl: data.avatar_url,
    githubId: data.github_id,
    githubToken,
  })
  persistCovenantSession(accountId, {
    jwt: data.jwt,
    login: data.login,
    avatarUrl: data.avatar_url,
    githubId: data.github_id,
    githubToken,
  })
  return data
}

async function authedFetch(
  accountId: string,
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
    try {
      return await covenantFetch(`${BASE_URL}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      })
    } catch (error) {
      throw new CovenantApiError(describeFetchError(error), 0)
    }
  }

  const session = sessions.get(accountId)
  if (!session?.jwt) {
    throw new CovenantApiError('Not signed in', 401)
  }

  const method = (options.method ?? 'GET').toUpperCase()
  const maxAttempts = method === 'GET' ? 3 : 1
  const retryDelaysMs = [400, 1200]
  const retryableStatuses = new Set([502, 503, 504])

  let response!: Response
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, retryDelaysMs[attempt - 1]!))
    }
    const live = sessions.get(accountId)
    if (!live?.jwt) {
      throw new CovenantApiError('Not signed in', 401)
    }
    try {
      response = await doFetch(live.jwt)
    } catch (error) {
      if (attempt >= maxAttempts - 1) throw error
      continue
    }
    if (retryableStatuses.has(response.status) && attempt < maxAttempts - 1) {
      try {
        await response.body?.cancel()
      } catch {
        /* ignore */
      }
      continue
    }
    break
  }

  if (response.status === 401) {
    const live = sessions.get(accountId)
    if (!live?.githubToken) {
      throw await parseCovenantError(response)
    }
    try {
      await response.body?.cancel()
    } catch {
      /* ignore */
    }
    await exchange(accountId, live.githubToken)
    const refreshed = sessions.get(accountId)
    if (!refreshed?.jwt) {
      throw new CovenantApiError('Not signed in', 401)
    }
    response = await doFetch(refreshed.jwt)
  }

  if (!response.ok) {
    throw await parseCovenantError(response)
  }

  return response
}

function statusOf(session: CovenantLiveSession | undefined): CovenantStatus {
  if (!session?.jwt) return { signedIn: false }
  return {
    signedIn: true,
    login: session.login,
    avatarUrl: session.avatarUrl,
    githubId: session.githubId,
  }
}

export function status(accountId: string): CovenantStatus {
  return statusOf(sessions.get(accountId))
}

export function statusAll(): Record<string, CovenantStatus> {
  const out: Record<string, CovenantStatus> = {}
  for (const [id, session] of sessions) {
    const row = statusOf(session)
    if (row.signedIn) out[id] = row
  }
  return out
}

export function signOut(accountId: string): void {
  sessions.delete(accountId)
  clearCovenantSession(accountId)
}

/**
 * Rehidrata las sesiones Covenant keyed desde disco.
 * Debe llamarse al arrancar main.ts, antes de registrar los handlers IPC.
 */
export function initCovenantSessions(legacyAccountId?: string): void {
  sessions.clear()
  const saved = loadCovenantSessions(legacyAccountId)
  for (const [id, data] of Object.entries(saved)) {
    sessions.set(id, {
      jwt: data.jwt,
      login: data.login,
      avatarUrl: data.avatarUrl,
      githubId: data.githubId,
      githubToken: data.githubToken,
    })
  }
}

export async function listOrgs(accountId: string): Promise<CovenantOrg[]> {
  const response = await authedFetch(accountId, '/orgs')
  return (await response.json()) as CovenantOrg[]
}

export async function createOrg(accountId: string, slug: string, name: string): Promise<CovenantOrg> {
  const response = await authedFetch(accountId, '/orgs', {
    method: 'POST',
    body: { slug, name },
  })
  return (await response.json()) as CovenantOrg
}

export async function deleteOrg(accountId: string, slug: string): Promise<void> {
  await authedFetch(accountId, `/orgs/${encodeURIComponent(slug)}`, { method: 'DELETE' })
}

export async function listMembers(accountId: string, slug: string): Promise<CovenantMember[]> {
  const response = await authedFetch(accountId, `/orgs/${encodeURIComponent(slug)}/members`)
  return (await response.json()) as CovenantMember[]
}

export async function listMemberLogins(accountId: string, slug: string): Promise<string[]> {
  const response = await authedFetch(accountId, `/orgs/${encodeURIComponent(slug)}/member-logins`)
  const body = (await response.json()) as unknown
  if (!Array.isArray(body)) return []
  return body.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

export async function addMember(accountId: string, slug: string, login: string): Promise<void> {
  await authedFetch(accountId, `/orgs/${encodeURIComponent(slug)}/members`, {
    method: 'POST',
    body: { login },
  })
}

export async function removeMember(accountId: string, slug: string, login: string): Promise<void> {
  await authedFetch(accountId, 
    `/orgs/${encodeURIComponent(slug)}/members/${encodeURIComponent(login)}`,
    { method: 'DELETE' },
  )
}

export async function listDefaults(accountId: string, slug: string): Promise<CovenantDefault[]> {
  const response = await authedFetch(accountId, `/orgs/${encodeURIComponent(slug)}/defaults`)
  return (await response.json()) as CovenantDefault[]
}

export async function setDefault(accountId: string, slug: string, kind: string, name: string): Promise<void> {
  await authedFetch(accountId, 
    `/orgs/${encodeURIComponent(slug)}/defaults/${encodeURIComponent(kind)}/${encodeURIComponent(name)}`,
    { method: 'PUT' },
  )
}

export async function unsetDefault(accountId: string, slug: string, kind: string, name: string): Promise<void> {
  await authedFetch(accountId, 
    `/orgs/${encodeURIComponent(slug)}/defaults/${encodeURIComponent(kind)}/${encodeURIComponent(name)}`,
    { method: 'DELETE' },
  )
}

export async function listWorkspaces(accountId: string, slug: string): Promise<CovenantWorkspace[]> {
  const response = await authedFetch(accountId, `/orgs/${encodeURIComponent(slug)}/workspaces`)
  return (await response.json()) as CovenantWorkspace[]
}

export async function createWorkspace(accountId: string, slug: string, name: string): Promise<CovenantWorkspace> {
  const response = await authedFetch(accountId, `/orgs/${encodeURIComponent(slug)}/workspaces`, {
    method: 'POST',
    body: { name },
  })
  return (await response.json()) as CovenantWorkspace
}

export async function renameWorkspace(
  accountId: string,
  slug: string,
  workspaceId: string,
  name: string,
): Promise<CovenantWorkspace> {
  const response = await authedFetch(accountId, 
    `/orgs/${encodeURIComponent(slug)}/workspaces/${encodeURIComponent(workspaceId)}`,
    { method: 'PATCH', body: { name } },
  )
  return (await response.json()) as CovenantWorkspace
}

export async function deleteWorkspace(accountId: string, slug: string, workspaceId: string): Promise<void> {
  await authedFetch(accountId, 
    `/orgs/${encodeURIComponent(slug)}/workspaces/${encodeURIComponent(workspaceId)}`,
    { method: 'DELETE' },
  )
}

export async function addAssignee(accountId: string, slug: string, workspaceId: string, login: string): Promise<void> {
  await authedFetch(accountId, 
    `/orgs/${encodeURIComponent(slug)}/workspaces/${encodeURIComponent(workspaceId)}/assignees`,
    { method: 'POST', body: { login } },
  )
}

export async function removeAssignee(
  accountId: string,
  slug: string,
  workspaceId: string,
  login: string,
): Promise<void> {
  await authedFetch(accountId, 
    `/orgs/${encodeURIComponent(slug)}/workspaces/${encodeURIComponent(workspaceId)}/assignees/${encodeURIComponent(login)}`,
    { method: 'DELETE' },
  )
}

export async function addWorkspaceAdmin(
  accountId: string,
  slug: string,
  workspaceId: string,
  login: string,
): Promise<void> {
  await authedFetch(accountId, 
    `/orgs/${encodeURIComponent(slug)}/workspaces/${encodeURIComponent(workspaceId)}/admins`,
    { method: 'POST', body: { login } },
  )
}

export async function removeWorkspaceAdmin(
  accountId: string,
  slug: string,
  workspaceId: string,
  login: string,
): Promise<void> {
  await authedFetch(accountId, 
    `/orgs/${encodeURIComponent(slug)}/workspaces/${encodeURIComponent(workspaceId)}/admins/${encodeURIComponent(login)}`,
    { method: 'DELETE' },
  )
}

export async function listWorkspaceAgents(
  accountId: string,
  slug: string,
  workspaceId: string,
): Promise<CovenantWorkspaceAgentRecord[]> {
  const response = await authedFetch(accountId, 
    `/orgs/${encodeURIComponent(slug)}/workspaces/${encodeURIComponent(workspaceId)}/agents`,
  )
  return (await response.json()) as CovenantWorkspaceAgentRecord[]
}

export async function upsertWorkspaceAgent(
  accountId: string,
  slug: string,
  workspaceId: string,
  agentId: string,
  definition: ProjectAgentDefinition,
): Promise<CovenantWorkspaceAgentRecord> {
  const response = await authedFetch(accountId, 
    `/orgs/${encodeURIComponent(slug)}/workspaces/${encodeURIComponent(workspaceId)}/agents/${encodeURIComponent(agentId)}`,
    { method: 'PUT', body: { definition } },
  )
  return (await response.json()) as CovenantWorkspaceAgentRecord
}

export async function deleteWorkspaceAgent(
  accountId: string,
  slug: string,
  workspaceId: string,
  agentId: string,
): Promise<void> {
  await authedFetch(accountId, 
    `/orgs/${encodeURIComponent(slug)}/workspaces/${encodeURIComponent(workspaceId)}/agents/${encodeURIComponent(agentId)}`,
    { method: 'DELETE' },
  )
}

export async function listWorkspaceContexts(
  accountId: string,
  slug: string,
  workspaceId: string,
): Promise<CovenantWorkspaceContextRecord[]> {
  const response = await authedFetch(accountId, 
    `/orgs/${encodeURIComponent(slug)}/workspaces/${encodeURIComponent(workspaceId)}/contexts`,
  )
  return (await response.json()) as CovenantWorkspaceContextRecord[]
}

export async function upsertWorkspaceContext(
  accountId: string,
  slug: string,
  workspaceId: string,
  contextId: string,
  payload: CovenantWorkspaceContextPayload,
): Promise<CovenantWorkspaceContextRecord> {
  const response = await authedFetch(accountId, 
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
  accountId: string,
  slug: string,
  workspaceId: string,
  contextId: string,
): Promise<void> {
  await authedFetch(accountId, 
    `/orgs/${encodeURIComponent(slug)}/workspaces/${encodeURIComponent(workspaceId)}/contexts/${encodeURIComponent(contextId)}`,
    { method: 'DELETE' },
  )
}

/**
 * Rename org context: PUT nextId, then DELETE previousId si difiere.
 * La API no expone PATCH rename-in-place; ver contrato en covenantTypes.
 */
export async function renameWorkspaceContext(
  accountId: string,
  slug: string,
  workspaceId: string,
  previousId: string,
  nextId: string,
  payload: CovenantWorkspaceContextPayload,
): Promise<{ record: CovenantWorkspaceContextRecord; deletedPrevious: boolean }> {
  return renameWorkspaceContextHelper(previousId, nextId, payload, {
    upsert: (contextId, body) => upsertWorkspaceContext(accountId, slug, workspaceId, contextId, body),
    delete: contextId => deleteWorkspaceContext(accountId, slug, workspaceId, contextId),
  })
}

export async function listWikiPages(
  accountId: string,
  slug: string,
  workspaceId: string,
): Promise<CovenantWikiPageRecord[]> {
  const response = await authedFetch(accountId, 
    `/orgs/${encodeURIComponent(slug)}/workspaces/${encodeURIComponent(workspaceId)}/wiki/pages`,
  )
  return (await response.json()) as CovenantWikiPageRecord[]
}

export async function upsertWikiPage(
  accountId: string,
  slug: string,
  workspaceId: string,
  pageSlug: string,
  payload: CovenantWikiPagePayload,
): Promise<CovenantWikiPageRecord> {
  const response = await authedFetch(accountId, 
    `/orgs/${encodeURIComponent(slug)}/workspaces/${encodeURIComponent(workspaceId)}/wiki/pages/${encodeURIComponent(pageSlug)}`,
    {
      method: 'PUT',
      body: {
        title: payload.title,
        pageType: payload.pageType,
        body: payload.body,
      },
    },
  )
  return (await response.json()) as CovenantWikiPageRecord
}

export async function deleteWikiPage(
  accountId: string,
  slug: string,
  workspaceId: string,
  pageSlug: string,
): Promise<void> {
  await authedFetch(accountId, 
    `/orgs/${encodeURIComponent(slug)}/workspaces/${encodeURIComponent(workspaceId)}/wiki/pages/${encodeURIComponent(pageSlug)}`,
    { method: 'DELETE' },
  )
}

export async function appendWikiLog(
  accountId: string,
  slug: string,
  workspaceId: string,
  entry: string,
): Promise<CovenantWikiLogEntryRecord> {
  const response = await authedFetch(accountId, 
    `/orgs/${encodeURIComponent(slug)}/workspaces/${encodeURIComponent(workspaceId)}/wiki/log`,
    { method: 'POST', body: { entry } },
  )
  return (await response.json()) as CovenantWikiLogEntryRecord
}

export async function listWikiLog(
  accountId: string,
  slug: string,
  workspaceId: string,
): Promise<CovenantWikiLogEntryRecord[]> {
  const response = await authedFetch(accountId, 
    `/orgs/${encodeURIComponent(slug)}/workspaces/${encodeURIComponent(workspaceId)}/wiki/log?limit=50`,
  )
  return (await response.json()) as CovenantWikiLogEntryRecord[]
}

function pickString(raw: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = raw[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function pickNumber(raw: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = raw[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      return Number(value)
    }
  }
  return 0
}

/** Normaliza JSON snake_case o camelCase del backend a CovenantWorkspaceRepoRecord. */
export function mapWorkspaceRepoRecord(raw: unknown): CovenantWorkspaceRepoRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const id = pickString(row, 'id')
  const repoFullName = pickString(row, 'repoFullName', 'repo_full_name')
  const cloneUrl = pickString(row, 'cloneUrl', 'clone_url')
  if (!id || !repoFullName || !cloneUrl) return null
  const createdBy = pickString(row, 'createdBy', 'created_by') || undefined
  const folderName = pickString(row, 'folderName', 'folder_name') || undefined
  return {
    id,
    repoFullName,
    cloneUrl,
    ...(folderName ? { folderName } : {}),
    position: pickNumber(row, 'position'),
    ...(createdBy ? { createdBy } : {}),
    createdAt: pickNumber(row, 'createdAt', 'created_at'),
    updatedAt: pickNumber(row, 'updatedAt', 'updated_at'),
  }
}

export async function listWorkspaceRepos(
  accountId: string,
  slug: string,
  workspaceId: string,
): Promise<CovenantWorkspaceRepoRecord[]> {
  const response = await authedFetch(accountId, 
    `/orgs/${encodeURIComponent(slug)}/workspaces/${encodeURIComponent(workspaceId)}/repos`,
  )
  const body = (await response.json()) as unknown
  if (!Array.isArray(body)) return []
  return body
    .map(mapWorkspaceRepoRecord)
    .filter((repo): repo is CovenantWorkspaceRepoRecord => repo != null)
}

export async function addWorkspaceRepo(
  accountId: string,
  slug: string,
  workspaceId: string,
  payload: CovenantWorkspaceRepoPayload,
): Promise<CovenantWorkspaceRepoRecord> {
  const response = await authedFetch(accountId, 
    `/orgs/${encodeURIComponent(slug)}/workspaces/${encodeURIComponent(workspaceId)}/repos`,
    {
      method: 'POST',
      body: {
        // Wire snake_case (contrato) + camelCase (serde del backend).
        repo_full_name: payload.repoFullName,
        clone_url: payload.cloneUrl,
        repoFullName: payload.repoFullName,
        cloneUrl: payload.cloneUrl,
        ...(payload.folderName?.trim()
          ? {
              folder_name: payload.folderName.trim(),
              folderName: payload.folderName.trim(),
            }
          : {}),
        ...(payload.position != null ? { position: payload.position } : {}),
      },
    },
  )
  const mapped = mapWorkspaceRepoRecord(await response.json())
  if (!mapped) throw new CovenantApiError('Invalid workspace repo response', 500)
  return mapped
}

export async function deleteWorkspaceRepo(
  accountId: string,
  slug: string,
  workspaceId: string,
  repoId: string,
): Promise<void> {
  await authedFetch(accountId, 
    `/orgs/${encodeURIComponent(slug)}/workspaces/${encodeURIComponent(workspaceId)}/repos/${encodeURIComponent(repoId)}`,
    { method: 'DELETE' },
  )
}

export async function updateWorkspaceRepo(
  accountId: string,
  slug: string,
  workspaceId: string,
  repoId: string,
  payload: CovenantWorkspaceRepoUpdatePayload,
): Promise<CovenantWorkspaceRepoRecord> {
  // Vacío limpia folderName custom en el backend.
  const folderName = typeof payload.folderName === 'string' ? payload.folderName.trim() : ''
  const response = await authedFetch(accountId, 
    `/orgs/${encodeURIComponent(slug)}/workspaces/${encodeURIComponent(workspaceId)}/repos/${encodeURIComponent(repoId)}`,
    {
      method: 'PATCH',
      body: {
        folder_name: folderName,
        folderName,
      },
    },
  )
  const mapped = mapWorkspaceRepoRecord(await response.json())
  if (!mapped) throw new CovenantApiError('Invalid workspace repo response', 500)
  return mapped
}

export async function listOrgAdmins(accountId: string, slug: string): Promise<string[]> {
  const response = await authedFetch(accountId, `/orgs/${encodeURIComponent(slug)}/admins`)
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

export async function addOrgAdmin(accountId: string, slug: string, login: string): Promise<void> {
  await authedFetch(accountId, `/orgs/${encodeURIComponent(slug)}/admins`, {
    method: 'POST',
    body: { login },
  })
}

export async function removeOrgAdmin(accountId: string, slug: string, login: string): Promise<void> {
  await authedFetch(accountId, 
    `/orgs/${encodeURIComponent(slug)}/admins/${encodeURIComponent(login)}`,
    { method: 'DELETE' },
  )
}
