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

export interface CovenantProject {
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
