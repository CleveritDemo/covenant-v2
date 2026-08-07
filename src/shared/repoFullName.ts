/**
 * Nombre canónico de repo (`owner/name`).
 * Debe coincidir con `normalize_repo_full_name` en back/src/workspaces.rs.
 *
 * Reglas: trim → sin `/` finales → sin sufijo `.git` (case-insensitive) → lowercase.
 */
export function normalizeRepoFullName(s: string): string {
  let out = s.trim().replace(/\/+$/, '')
  out = out.replace(/\.git$/i, '')
  out = out.replace(/\/+$/, '')
  return out.toLowerCase()
}
