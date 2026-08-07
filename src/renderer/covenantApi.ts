/** Contrato renderer de window.api.covenant (implementado en main/preload). */

import type { CovenantProject } from '../shared/covenantTypes'

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
  signIn(): Promise<CovenantResult<CovenantAuthStatus>>
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
  projectsList(slug: string): Promise<CovenantResult<CovenantProject[]>>
  projectCreate(slug: string, name: string): Promise<CovenantResult<CovenantProject>>
  projectRename(
    slug: string,
    projectId: string,
    name: string,
  ): Promise<CovenantResult<CovenantProject>>
  projectDelete(slug: string, projectId: string): Promise<CovenantResult<null>>
  projectAssigneeAdd(
    slug: string,
    projectId: string,
    login: string,
  ): Promise<CovenantResult<null>>
  projectAssigneeRemove(
    slug: string,
    projectId: string,
    login: string,
  ): Promise<CovenantResult<null>>
  projectAdminAdd(
    slug: string,
    projectId: string,
    login: string,
  ): Promise<CovenantResult<null>>
  projectAdminRemove(
    slug: string,
    projectId: string,
    login: string,
  ): Promise<CovenantResult<null>>
  orgAdminsList(slug: string): Promise<CovenantResult<string[]>>
  orgAdminAdd(slug: string, login: string): Promise<CovenantResult<null>>
  orgAdminRemove(slug: string, login: string): Promise<CovenantResult<null>>
}

export function getCovenantApi(): CovenantApi | undefined {
  return window.api.covenant
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

/** True si el preload expone la API local de proyectos. */
export function hasCovenantProjectsApi(api: CovenantApi | undefined): boolean {
  return (
    !!api &&
    typeof api.projectsList === 'function' &&
    typeof api.projectCreate === 'function' &&
    typeof api.projectRename === 'function' &&
    typeof api.projectDelete === 'function' &&
    typeof api.projectAssigneeAdd === 'function' &&
    typeof api.projectAssigneeRemove === 'function' &&
    typeof api.projectAdminAdd === 'function' &&
    typeof api.projectAdminRemove === 'function'
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
