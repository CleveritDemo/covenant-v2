import type { AppConfig } from './configSchema'

/** Snapshot local de workspaces org (Cmd+T sin red). */

export type OrgWorkspaceCatalogEntry = {
  slug: string
  orgName: string
  workspaceId: string
  name: string
  /**
   * Si el usuario actual puede renombrar este workspace (y por tanto la tab).
   * Ausente en snapshots antiguos → tratar como desconocido.
   */
  canRename?: boolean
}

export type OrgWorkspaceCatalog = {
  login: string
  entries: OrgWorkspaceCatalogEntry[]
  fetchedAt: number
}

/** Catálogos org indexados por accountId Covenant; `''` = cuenta por defecto. */
export type OrgWorkspaceCatalogMap = { byAccount: Record<string, OrgWorkspaceCatalog> }

/** Input al construir el catálogo (permisos ya resueltos por el caller). */
export type OrgWorkspaceCatalogWorkspaceInput = {
  id: string
  name: string
  canRename?: boolean
  canAccess?: boolean
}

/**
 * Pre-chequeo del renderer al crear un tab de workspace org.
 * El slot global `githubToken` está vacío tras migrar al llavero:
 * una cuenta en `githubAccounts` también cuenta.
 */
export function orgWorkspaceTokenMissing(
  cfg: Pick<AppConfig, 'githubToken' | 'githubAccounts'>,
): boolean {
  return !cfg.githubToken?.trim() && !cfg.githubAccounts?.length
}

/** GitHub logins: trim + case-insensitive. */
export function normalizeGithubLogin(login: string): string {
  return login.trim().toLowerCase()
}

export function sameGithubLogin(a: string, b: string): boolean {
  const left = normalizeGithubLogin(a)
  if (!left) return false
  return left === normalizeGithubLogin(b)
}

export function catalogHasWorkspaces(cat?: OrgWorkspaceCatalog | null): boolean {
  return Boolean(cat && cat.entries.length > 0)
}

/** Null si el snapshot es de otro usuario o login vacío. */
export function catalogForLogin(
  cat: OrgWorkspaceCatalog | null | undefined,
  login: string,
): OrgWorkspaceCatalog | null {
  const normalized = normalizeGithubLogin(login)
  if (!cat || !normalized) return null
  if (normalizeGithubLogin(cat.login) !== normalized) return null
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

/**
 * Owner de org, org-admin, creador del workspace o workspace-admin.
 * Alineado con `require_workspace_manager(..., manage_admins=false)` del server.
 */
export function canRenameOrgWorkspace(opts: {
  login: string
  orgRole: string
  isOrgAdmin: boolean
  createdBy?: string
  admins?: readonly string[]
}): boolean {
  const login = normalizeGithubLogin(opts.login)
  if (!login) return false
  const orgRole = opts.orgRole.trim()
  if (orgRole === 'owner' || orgRole === 'admin' || opts.isOrgAdmin) return true
  if (sameGithubLogin(opts.createdBy ?? '', login)) return true
  return (opts.admins ?? []).some(a => sameGithubLogin(a, login))
}

/**
 * Visibilidad del workspace para el usuario actual.
 * Managers de org ven todos; miembros normales solo si participan en ese workspace.
 */
export function canAccessOrgWorkspace(opts: {
  login: string
  orgRole: string
  isOrgAdmin: boolean
  createdBy?: string
  admins?: readonly string[]
  assignees?: readonly string[]
}): boolean {
  const login = normalizeGithubLogin(opts.login)
  if (!login) return false
  const orgRole = opts.orgRole.trim()
  if (orgRole === 'owner' || orgRole === 'admin' || opts.isOrgAdmin) {
    return true
  }
  if (sameGithubLogin(opts.createdBy ?? '', login)) return true
  if ((opts.admins ?? []).some(a => sameGithubLogin(a, login))) return true
  return (opts.assignees ?? []).some(a => sameGithubLogin(a, login))
}

/** Filtro del picker Cmd+T: case-insensitive sobre org, slug y nombre. */
export function matchesWorkspaceQuery(
  entry: { orgName?: string; slug?: string; name?: string },
  query: string,
): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return [entry.orgName, entry.slug, entry.name]
    .some(field => (field ?? '').toLowerCase().includes(needle))
}

export function buildOrgWorkspaceCatalog(
  login: string,
  orgs: Array<{ slug: string; name: string }>,
  workspacesByOrg: Record<string, OrgWorkspaceCatalogWorkspaceInput[]>,
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
      if (workspace.canAccess === false) continue
      entries.push({
        slug,
        orgName,
        workspaceId,
        name,
        canRename: workspace.canRename === true,
      })
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
    const entry: OrgWorkspaceCatalogEntry = {
      slug,
      orgName: orgName || slug,
      workspaceId,
      name,
    }
    if (typeof e.canRename === 'boolean') entry.canRename = e.canRename
    entries.push(entry)
  }
  return { login: obj.login.trim(), entries, fetchedAt: obj.fetchedAt }
}

export function catalogForAccount(
  map: OrgWorkspaceCatalogMap | null | undefined,
  accountId: string,
): OrgWorkspaceCatalog | null {
  if (!map) return null
  return map.byAccount[accountId.trim()] ?? null
}

export function upsertAccountCatalog(
  map: OrgWorkspaceCatalogMap | null | undefined,
  accountId: string,
  cat: OrgWorkspaceCatalog,
): OrgWorkspaceCatalogMap {
  const key = accountId.trim()
  return {
    byAccount: {
      ...(map?.byAccount ?? {}),
      [key]: cat,
    },
  }
}

export function accountIdsInCatalogMap(
  map: OrgWorkspaceCatalogMap | null | undefined,
): string[] {
  if (!map) return []
  return Object.keys(map.byAccount).sort()
}

/**
 * Acepta `{ byAccount }` o un catálogo legacy suelto (`login`/`entries`).
 * Entradas inválidas en `byAccount` se descartan; null si no queda nada válido.
 */
export function parseOrgWorkspaceCatalogMap(raw: unknown): OrgWorkspaceCatalogMap | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const byAccountRaw = obj.byAccount
  if (byAccountRaw != null && typeof byAccountRaw === 'object' && !Array.isArray(byAccountRaw)) {
    const byAccount: Record<string, OrgWorkspaceCatalog> = {}
    for (const [key, value] of Object.entries(byAccountRaw as Record<string, unknown>)) {
      const cat = parseOrgWorkspaceCatalog(value)
      if (cat) byAccount[key] = cat
    }
    if (Object.keys(byAccount).length === 0) return null
    return { byAccount }
  }
  const legacy = parseOrgWorkspaceCatalog(raw)
  if (legacy) return { byAccount: { '': legacy } }
  return null
}

export function findOrgWorkspaceCatalogEntry(
  catalog: OrgWorkspaceCatalog | null | undefined,
  slug: string,
  workspaceId: string,
): OrgWorkspaceCatalogEntry | undefined {
  const s = slug.trim()
  const id = workspaceId.trim()
  if (!catalog || !s || !id) return undefined
  return catalog.entries.find(e => e.slug === s && e.workspaceId === id)
}

/** Busca una entrada en cualquier catálogo del mapa (p. ej. labels de Pulse). */
export function findOrgWorkspaceCatalogEntryInMap(
  map: OrgWorkspaceCatalogMap | null | undefined,
  slug: string,
  workspaceId: string,
): OrgWorkspaceCatalogEntry | undefined {
  if (!map) return undefined
  for (const catalog of Object.values(map.byAccount)) {
    const entry = findOrgWorkspaceCatalogEntry(catalog, slug, workspaceId)
    if (entry) return entry
  }
  return undefined
}

/** Sin catálogo → false; con entrada → `canRename`; sin entrada → true (el server decide). */
export function canUploadOrgWorkspaceFromCatalog(
  catalog: OrgWorkspaceCatalog | null | undefined,
  slug: string,
  workspaceId: string,
): boolean {
  if (catalog == null) return false
  const entry = findOrgWorkspaceCatalogEntry(catalog, slug, workspaceId)
  if (entry) return entry.canRename === true
  return true
}

/**
 * Alinea títulos de tabs org con el nombre canónico del catálogo.
 * Devuelve `null` si no hay cambios.
 */
export function syncTabTitlesFromOrgWorkspaceCatalog<T extends {
  title: string
  titleLocked?: boolean
  orgWorkspace?: { slug: string; workspaceId: string }
}>(tabs: readonly T[], catalog: OrgWorkspaceCatalog | null | undefined): T[] | null {
  if (!catalog) return null
  let changed = false
  const next = tabs.map(tab => {
    const org = tab.orgWorkspace
    const slug = org?.slug?.trim() ?? ''
    const workspaceId = org?.workspaceId?.trim() ?? ''
    if (!slug || !workspaceId) return tab
    const entry = findOrgWorkspaceCatalogEntry(catalog, slug, workspaceId)
    if (!entry) return tab
    const name = entry.name.trim()
    if (!name) return tab
    if (tab.title === name && tab.titleLocked) return tab
    changed = true
    return { ...tab, title: name, titleLocked: true }
  })
  return changed ? next : null
}

/** Parchea el nombre (y opcionalmente canRename) de una entrada del catálogo. */
export function patchOrgWorkspaceCatalogName(
  catalog: OrgWorkspaceCatalog | null | undefined,
  slug: string,
  workspaceId: string,
  name: string,
  canRename?: boolean,
): OrgWorkspaceCatalog | null {
  if (!catalog) return null
  const s = slug.trim()
  const id = workspaceId.trim()
  const nextName = name.trim()
  if (!s || !id || !nextName) return catalog
  let changed = false
  const entries = catalog.entries.map(entry => {
    if (entry.slug !== s || entry.workspaceId !== id) return entry
    const nextCan = canRename === undefined ? entry.canRename : canRename
    if (entry.name === nextName && entry.canRename === nextCan) return entry
    changed = true
    return { ...entry, name: nextName, canRename: nextCan }
  })
  return changed ? { ...catalog, entries } : catalog
}
