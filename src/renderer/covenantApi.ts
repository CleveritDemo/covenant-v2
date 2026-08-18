/** Contrato renderer de window.api.covenant (implementado en main/preload). */

import type {
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
} from '../shared/covenantTypes'
import type { ProjectAgentDefinition } from '../shared/projectAgentCatalog'
import type {
  OrgWorkspaceCloneRequest,
  OrgWorkspaceCloneResult,
} from '../shared/orgWorkspaceClone'

export type {
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
} from '../shared/covenantTypes'
/** @deprecated Alias temporal. */
export type { CovenantProject } from '../shared/covenantTypes'

export type CovenantResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export interface CovenantAuthStatus {
  signedIn: boolean
  login?: string
  name?: string
  avatarUrl?: string
  /** github_id del exchange; fallback vs createdById. */
  githubId?: string | number
}

export type CovenantSignInResult =
  | { ok: true; data: CovenantAuthStatus }
  | { ok: false; error: string; source?: 'settings' | 'env' | 'keychain' | 'none' }

export interface CovenantOrg {
  slug: string
  name: string
  role?: string
}

export interface CovenantMember {
  login: string
  role?: string
  avatarUrl?: string
}

export interface CovenantDefault {
  kind: string
  name: string
  createdBy?: string
  createdById?: string | number
}

export interface CovenantApi {
  status(): Promise<CovenantResult<CovenantAuthStatus>>
  signIn(): Promise<CovenantSignInResult>
  signOut(): Promise<CovenantResult<unknown>>
  orgsList(): Promise<CovenantResult<CovenantOrg[]>>
  orgCreate(slug: string, name: string): Promise<CovenantResult<CovenantOrg>>
  membersList(slug: string): Promise<CovenantResult<CovenantMember[]>>
  memberLoginsList(slug: string): Promise<CovenantResult<string[]>>
  memberAdd(slug: string, login: string): Promise<CovenantResult<unknown>>
  memberRemove(slug: string, login: string): Promise<CovenantResult<unknown>>
  defaultsList(slug: string): Promise<CovenantResult<CovenantDefault[]>>
  defaultSet(slug: string, kind: string, name: string): Promise<CovenantResult<CovenantDefault>>
  defaultUnset(slug: string, kind: string, name: string): Promise<CovenantResult<unknown>>
  workspacesList(slug: string): Promise<CovenantResult<CovenantWorkspace[]>>
  workspaceCreate(slug: string, name: string): Promise<CovenantResult<CovenantWorkspace>>
  workspaceRename(
    slug: string,
    workspaceId: string,
    name: string,
  ): Promise<CovenantResult<CovenantWorkspace>>
  workspaceDelete(slug: string, workspaceId: string): Promise<CovenantResult<null>>
  workspaceAssigneeAdd(
    slug: string,
    workspaceId: string,
    login: string,
  ): Promise<CovenantResult<null>>
  workspaceAssigneeRemove(
    slug: string,
    workspaceId: string,
    login: string,
  ): Promise<CovenantResult<null>>
  workspaceAdminAdd(
    slug: string,
    workspaceId: string,
    login: string,
  ): Promise<CovenantResult<null>>
  workspaceAdminRemove(
    slug: string,
    workspaceId: string,
    login: string,
  ): Promise<CovenantResult<null>>
  workspaceAgentsList(
    slug: string,
    workspaceId: string,
  ): Promise<CovenantResult<CovenantWorkspaceAgentRecord[]>>
  workspaceAgentUpsert(
    slug: string,
    workspaceId: string,
    agentId: string,
    definition: ProjectAgentDefinition,
  ): Promise<CovenantResult<CovenantWorkspaceAgentRecord>>
  workspaceAgentDelete(
    slug: string,
    workspaceId: string,
    agentId: string,
  ): Promise<CovenantResult<null>>
  workspaceContextsList(
    slug: string,
    workspaceId: string,
  ): Promise<CovenantResult<CovenantWorkspaceContextRecord[]>>
  workspaceContextUpsert(
    slug: string,
    workspaceId: string,
    contextId: string,
    payload: CovenantWorkspaceContextPayload,
  ): Promise<CovenantResult<CovenantWorkspaceContextRecord>>
  /** PUT nextId + DELETE previousId si difiere (sin PATCH rename-in-place en API). */
  workspaceContextRename(
    slug: string,
    workspaceId: string,
    previousId: string,
    nextId: string,
    payload: CovenantWorkspaceContextPayload,
  ): Promise<CovenantResult<{ record: CovenantWorkspaceContextRecord; deletedPrevious: boolean }>>
  workspaceContextDelete(
    slug: string,
    workspaceId: string,
    contextId: string,
  ): Promise<CovenantResult<null>>
  listWikiPages(
    slug: string,
    workspaceId: string,
  ): Promise<CovenantResult<CovenantWikiPageRecord[]>>
  upsertWikiPage(
    slug: string,
    workspaceId: string,
    pageSlug: string,
    payload: CovenantWikiPagePayload,
  ): Promise<CovenantResult<CovenantWikiPageRecord>>
  deleteWikiPage(
    slug: string,
    workspaceId: string,
    pageSlug: string,
  ): Promise<CovenantResult<null>>
  appendWikiLog(
    slug: string,
    workspaceId: string,
    entry: string,
  ): Promise<CovenantResult<CovenantWikiLogEntryRecord>>
  listWikiLog(
    slug: string,
    workspaceId: string,
  ): Promise<CovenantResult<CovenantWikiLogEntryRecord[]>>
  workspaceReposList(
    slug: string,
    workspaceId: string,
  ): Promise<CovenantResult<CovenantWorkspaceRepoRecord[]>>
  workspaceRepoAdd(
    slug: string,
    workspaceId: string,
    payload: CovenantWorkspaceRepoPayload,
  ): Promise<CovenantResult<CovenantWorkspaceRepoRecord>>
  workspaceRepoUpdate(
    slug: string,
    workspaceId: string,
    repoId: string,
    payload: CovenantWorkspaceRepoUpdatePayload,
  ): Promise<CovenantResult<CovenantWorkspaceRepoRecord>>
  workspaceRepoDelete(
    slug: string,
    workspaceId: string,
    repoId: string,
  ): Promise<CovenantResult<null>>
  cloneOrgWorkspace(params: OrgWorkspaceCloneRequest): Promise<OrgWorkspaceCloneResult>
  orgAdminsList(slug: string): Promise<CovenantResult<string[]>>
  orgAdminAdd(slug: string, login: string): Promise<CovenantResult<null>>
  orgAdminRemove(slug: string, login: string): Promise<CovenantResult<null>>
  statusAll(): Promise<CovenantResult<Record<string, CovenantAuthStatus>>>
}

type CovenantFacadeEntry = { raw: CovenantApi; api: CovenantApi }

const covenantFacades = new Map<string, CovenantFacadeEntry>()

/** Claves propias + prototipo (si no es Object.prototype) para no perder métodos. */
function covenantApiKeys(raw: object): Array<string | symbol> {
  const keys = new Set<string | symbol>()
  for (const key of Object.getOwnPropertyNames(raw)) keys.add(key)
  for (const key of Reflect.ownKeys(raw)) keys.add(key)
  const proto = Object.getPrototypeOf(raw) as object | null
  if (proto && proto !== Object.prototype) {
    for (const key of Reflect.ownKeys(proto)) {
      if (key === 'constructor') continue
      keys.add(key)
    }
  }
  return [...keys]
}

/**
 * Objeto plano con wrappers por método. NUNCA un Proxy sobre el target de
 * contextBridge: sus data properties no configurables violan el invariante
 * si el trap `get` no devuelve el valor real.
 */
function wrapCovenantApi(raw: CovenantApi, accountId: string): CovenantApi {
  const wrapped: Record<string | symbol, unknown> = {}
  for (const key of covenantApiKeys(raw)) {
    const value = Reflect.get(raw, key)
    if (typeof value === 'function') {
      wrapped[key] = (...args: unknown[]) => (
        (value as (...fnArgs: unknown[]) => unknown).call(raw, accountId, ...args)
      )
    } else {
      wrapped[key] = value
    }
  }
  return wrapped as unknown as CovenantApi
}

export function getCovenantApi(accountId = ''): CovenantApi | undefined {
  const raw = window.api?.covenant
  if (!raw) return undefined
  const hit = covenantFacades.get(accountId)
  if (hit && hit.raw === raw) return hit.api
  const api = wrapCovenantApi(raw, accountId)
  covenantFacades.set(accountId, { raw, api })
  return api
}

/** True si el preload expone statusAll (sesiones por cuenta). */
export function hasCovenantStatusAllApi(api: CovenantApi | undefined): boolean {
  return !!api && typeof api.statusAll === 'function'
}

/** True si el preload expone listado de logins de miembros. */
export function hasCovenantMemberLoginsApi(api: CovenantApi | undefined): boolean {
  return !!api && typeof api.memberLoginsList === 'function'
}

/** True si el preload expone admins de organización. */
export function hasCovenantOrgAdminsApi(api: CovenantApi | undefined): boolean {
  return (
    !!api &&
    typeof api.orgAdminsList === 'function' &&
    typeof api.orgAdminAdd === 'function' &&
    typeof api.orgAdminRemove === 'function'
  )
}

/** True si el preload expone la API de workspaces org. */
export function hasCovenantWorkspacesApi(api: CovenantApi | undefined): boolean {
  return (
    !!api &&
    typeof api.workspacesList === 'function' &&
    typeof api.workspaceCreate === 'function' &&
    typeof api.workspaceRename === 'function' &&
    typeof api.workspaceDelete === 'function' &&
    typeof api.workspaceAssigneeAdd === 'function' &&
    typeof api.workspaceAssigneeRemove === 'function' &&
    typeof api.workspaceAdminAdd === 'function' &&
    typeof api.workspaceAdminRemove === 'function'
  )
}

/** True si el preload expone CRUD de agentes/contextos de workspace. */
export function hasCovenantWorkspaceContentApi(api: CovenantApi | undefined): boolean {
  return (
    !!api &&
    typeof api.workspaceAgentsList === 'function' &&
    typeof api.workspaceAgentUpsert === 'function' &&
    typeof api.workspaceAgentDelete === 'function' &&
    typeof api.workspaceContextsList === 'function' &&
    typeof api.workspaceContextUpsert === 'function' &&
    typeof api.workspaceContextDelete === 'function'
  )
}

/** True si el preload expone la API de wiki de workspace org. */
export function hasCovenantWikiApi(api: CovenantApi | undefined): boolean {
  return (
    !!api &&
    typeof api.listWikiPages === 'function' &&
    typeof api.upsertWikiPage === 'function' &&
    typeof api.deleteWikiPage === 'function' &&
    typeof api.appendWikiLog === 'function' &&
    typeof api.listWikiLog === 'function'
  )
}

/** True si el preload expone CRUD de repos de workspace. */
export function hasCovenantWorkspaceReposApi(api: CovenantApi | undefined): boolean {
  return (
    !!api &&
    typeof api.workspaceReposList === 'function' &&
    typeof api.workspaceRepoAdd === 'function' &&
    typeof api.workspaceRepoUpdate === 'function' &&
    typeof api.workspaceRepoDelete === 'function'
  )
}

/** lowercase, [a-z0-9-], guiones colapsados, máx. 40. */
export function slugifyOrgName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}
