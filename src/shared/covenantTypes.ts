export interface CovenantOrg {
  id: string
  slug: string
  name: string
  role: string
  personal: boolean
}

export interface CovenantMember {
  login: string
  role: string
}

export interface CovenantDefault {
  kind: string
  name: string
  /** Login del creador (preferido; JOIN users en backend). */
  createdBy?: string
  /** Fallback si el backend aún envía github_id numérico. */
  createdById?: string | number
}

export interface CovenantWorkspace {
  id: string
  name: string
  createdAt: number
  admins: string[]
  assignees: string[]
  /** Login del creador (preferido; JOIN users en backend). */
  createdBy?: string
  /** Fallback si el backend aún envía github_id numérico. */
  createdById?: string | number
}

/** @deprecated Alias temporal; usar CovenantWorkspace. */
export type CovenantProject = CovenantWorkspace

/** Cuerpo PUT de contexto de workspace org. */
export interface CovenantWorkspaceContextPayload {
  kind: string
  name: string
  body?: string
  meta?: Record<string, unknown>
}

/** Respuesta GET/PUT de contexto de workspace org. */
export interface CovenantWorkspaceContextRecord extends CovenantWorkspaceContextPayload {
  contextId: string
  createdBy?: string
  createdById?: string | number
  createdAt?: number
  updatedAt?: number
}

/** Respuesta GET/PUT de agente de workspace org. */
export interface CovenantWorkspaceAgentRecord {
  agentId: string
  /** ProjectAgentDefinition completo (JSON). */
  definition: Record<string, unknown>
  createdBy?: string
  createdById?: string | number
  createdAt?: number
  updatedAt?: number
}

/** Cuerpo POST de repo de workspace org. */
export interface CovenantWorkspaceRepoPayload {
  repoFullName: string
  cloneUrl: string
  position?: number
}

/** Respuesta GET/POST de repo de workspace org. */
export interface CovenantWorkspaceRepoRecord {
  id: string
  repoFullName: string
  cloneUrl: string
  position: number
  createdBy?: string
  createdAt: number
  updatedAt: number
}

export interface CovenantStatus {
  signedIn: boolean
  login?: string
  avatarUrl?: string
  /** github_id del exchange; usado para fallback createdById. */
  githubId?: string | number
}

export type CovenantResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

/** Clave de catálogo en memoria para un workspace org (no filesystem). */
export function covenantWorkspaceCatalogKey(slug: string, workspaceId: string): string {
  return `covenant://workspaces/${encodeURIComponent(slug)}/${encodeURIComponent(workspaceId)}`
}

/** Clave del catálogo de agentes de una pestaña (org-backed o projectFolder). */
export function tabAgentCatalogKey(tab: {
  projectFolder?: string
  orgWorkspace?: { slug: string; workspaceId: string }
}): string {
  const org = tab.orgWorkspace
  const slug = org?.slug?.trim() ?? ''
  const workspaceId = org?.workspaceId?.trim() ?? ''
  if (slug && workspaceId) return covenantWorkspaceCatalogKey(slug, workspaceId)
  return tab.projectFolder?.trim() ?? ''
}

/**
 * Boot/resync org: aplica list entrante salvo carrera que pisa un catálogo
 * no vacío con uno vacío.
 */
export function shouldReplaceOrgAgentCatalog(
  incoming: readonly unknown[],
  existing: readonly unknown[] | undefined,
): boolean {
  if (incoming.length > 0) return true
  return !existing || existing.length === 0
}
