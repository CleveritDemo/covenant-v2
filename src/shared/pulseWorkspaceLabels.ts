import {
  findOrgWorkspaceCatalogEntry,
  type OrgWorkspaceCatalog,
} from './orgWorkspaceCatalog'

/**
 * Label visible del selector WORKSPACE de Pulse.
 *
 * El value del filtro sigue siendo el tag crudo `<slug>/<workspaceId>` que
 * graba la bitácora; el label se resuelve aparte para no mezclar identidad
 * de filtro con lo que el usuario lee.
 */
export function pulseWorkspaceLabel(
  tag: string,
  catalog: OrgWorkspaceCatalog | null | undefined,
  allTags: readonly string[],
): string {
  const slash = tag.indexOf('/')
  if (slash <= 0 || slash === tag.length - 1) return tag
  const slug = tag.slice(0, slash)
  const workspaceId = tag.slice(slash + 1)
  const entry = findOrgWorkspaceCatalogEntry(catalog, slug, workspaceId)
  if (entry) return `${slug}/${entry.name}`
  const shared = allTags.some(other => other !== tag && tagSlug(other) === slug)
  return shared ? `${slug}/${workspaceId.slice(0, 8)}` : slug
}

function tagSlug(tag: string): string | null {
  const slash = tag.indexOf('/')
  if (slash <= 0 || slash === tag.length - 1) return null
  return tag.slice(0, slash)
}
