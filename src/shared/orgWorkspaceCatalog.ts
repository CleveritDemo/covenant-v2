/** Snapshot local de workspaces org (Cmd+T sin red). */

export type OrgWorkspaceCatalogEntry = {
  slug: string
  orgName: string
  workspaceId: string
  name: string
}

export type OrgWorkspaceCatalog = {
  login: string
  entries: OrgWorkspaceCatalogEntry[]
  fetchedAt: number
}

export function catalogHasWorkspaces(cat?: OrgWorkspaceCatalog | null): boolean {
  return Boolean(cat && cat.entries.length > 0)
}

/** Null si el snapshot es de otro usuario o login vacío. */
export function catalogForLogin(
  cat: OrgWorkspaceCatalog | null | undefined,
  login: string,
): OrgWorkspaceCatalog | null {
  const normalized = login.trim()
  if (!cat || !normalized) return null
  if (cat.login.trim() !== normalized) return null
  return cat
}

export function isCatalogFresh(
  cat: OrgWorkspaceCatalog | null | undefined,
  ttlMs: number,
  nowMs: number,
): boolean {
  if (!cat || ttlMs <= 0) return false
  return nowMs - cat.fetchedAt <= ttlMs
}

export function buildOrgWorkspaceCatalog(
  login: string,
  orgs: Array<{ slug: string; name: string }>,
  workspacesByOrg: Record<string, Array<{ id: string; name: string }>>,
  nowMs: number,
): OrgWorkspaceCatalog {
  const entries: OrgWorkspaceCatalogEntry[] = []
  for (const org of orgs) {
    const slug = org.slug?.trim() ?? ''
    const orgName = org.name?.trim() || slug
    if (!slug) continue
    const list = workspacesByOrg[slug] ?? []
    for (const workspace of list) {
      const workspaceId = workspace.id?.trim() ?? ''
      const name = workspace.name?.trim() ?? ''
      if (!workspaceId || !name) continue
      entries.push({ slug, orgName, workspaceId, name })
    }
  }
  return {
    login: login.trim(),
    entries,
    fetchedAt: nowMs,
  }
}

/** Parsea un blob de config; null si la forma no es válida. */
export function parseOrgWorkspaceCatalog(raw: unknown): OrgWorkspaceCatalog | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (typeof obj.login !== 'string' || !obj.login.trim()) return null
  if (typeof obj.fetchedAt !== 'number' || !Number.isFinite(obj.fetchedAt)) return null
  if (!Array.isArray(obj.entries)) return null
  const entries: OrgWorkspaceCatalogEntry[] = []
  for (const item of obj.entries) {
    if (!item || typeof item !== 'object') continue
    const e = item as Record<string, unknown>
    const slug = typeof e.slug === 'string' ? e.slug.trim() : ''
    const orgName = typeof e.orgName === 'string' ? e.orgName.trim() : ''
    const workspaceId = typeof e.workspaceId === 'string' ? e.workspaceId.trim() : ''
    const name = typeof e.name === 'string' ? e.name.trim() : ''
    if (!slug || !workspaceId || !name) continue
    entries.push({ slug, orgName: orgName || slug, workspaceId, name })
  }
  return { login: obj.login.trim(), entries, fetchedAt: obj.fetchedAt }
}
