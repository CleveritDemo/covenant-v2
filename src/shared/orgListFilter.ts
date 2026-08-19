/** Filtro de listas de Organizations: query vacía o solo espacios no recorta. */

export function filterOrgsByQuery<T extends { name: string; slug: string }>(
  orgs: T[],
  query: string,
): T[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return orgs
  return orgs.filter(org =>
    org.name.toLowerCase().includes(needle) || org.slug.toLowerCase().includes(needle),
  )
}

export function filterWorkspacesByQuery<T extends { name: string }>(
  workspaces: T[],
  query: string,
): T[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return workspaces
  return workspaces.filter(workspace => workspace.name.toLowerCase().includes(needle))
}
