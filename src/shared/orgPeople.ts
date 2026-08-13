/**
 * Filas de personas para la UI de Organizations.
 *
 * La API mantiene members, orgAdmins, assignees y workspaceAdmins como listas
 * separadas; aquí se fusionan en una sola fila con rol para poder pintarlas como
 * una tabla (org) o una lista de chips (workspace).
 */

import { normalizeGithubLogin, sameGithubLogin } from './orgWorkspaceCatalog'

export type OrgPersonRole = 'owner' | 'admin' | 'member'
export type WorkspacePersonRole = 'admin' | 'assignee'

export interface OrgPersonRow {
  login: string
  role: OrgPersonRole
  avatarUrl?: string
}

export interface WorkspacePersonRow {
  login: string
  role: WorkspacePersonRole
}

const ORG_ROLE_ORDER: Record<OrgPersonRole, number> = { owner: 0, admin: 1, member: 2 }

/**
 * Owner viene del `role` que devuelve el backend por miembro; admin de la lista
 * `orgAdmins` (un owner nunca se degrada a admin aunque aparezca en ella).
 */
export function orgPeopleRows(
  members: readonly { login: string; role?: string; avatarUrl?: string }[],
  orgAdmins: readonly string[],
): OrgPersonRow[] {
  const rows: OrgPersonRow[] = []
  const seen = new Set<string>()

  for (const member of members) {
    const login = member.login.trim()
    const key = normalizeGithubLogin(login)
    if (!key || seen.has(key)) continue
    seen.add(key)
    const isOwner = member.role?.trim().toLowerCase() === 'owner'
    const isAdmin = !isOwner && orgAdmins.some(admin => sameGithubLogin(admin, login))
    rows.push({
      login,
      role: isOwner ? 'owner' : isAdmin ? 'admin' : 'member',
      ...(member.avatarUrl ? { avatarUrl: member.avatarUrl } : {}),
    })
  }

  return rows.sort((a, b) => {
    const byRole = ORG_ROLE_ORDER[a.role] - ORG_ROLE_ORDER[b.role]
    if (byRole !== 0) return byRole
    return a.login.localeCompare(b.login)
  })
}

/**
 * Una sola lista de personas del workspace. Quien esté en `admins` y en
 * `assignees` aparece una vez, como admin: es el rol que manda para gestionar.
 */
export function workspacePeopleRows(
  assignees: readonly string[],
  admins: readonly string[],
): WorkspacePersonRow[] {
  const rows: WorkspacePersonRow[] = []
  const seen = new Set<string>()

  for (const [list, role] of [[admins, 'admin'], [assignees, 'assignee']] as const) {
    for (const raw of list) {
      const login = raw.trim()
      const key = normalizeGithubLogin(login)
      if (!key || seen.has(key)) continue
      seen.add(key)
      rows.push({ login, role })
    }
  }

  return rows
}
