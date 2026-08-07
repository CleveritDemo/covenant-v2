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

/**
 * Extrae `owner/repo` de una URL git (https o ssh) y la normaliza.
 * Devuelve '' si no se puede parsear.
 */
export function repoFullNameFromCloneUrl(url: string): string {
  const raw = url.trim()
  if (!raw) return ''

  let path = ''
  const https = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^?#]+)/i.exec(raw)
  if (https?.[1]) {
    path = https[1]
  } else {
    const ssh = /^(?:git@|ssh:\/\/git@)github\.com[/:]([^?#]+)/i.exec(raw)
    if (ssh?.[1]) path = ssh[1]
  }
  if (!path) return ''

  const cleaned = path.replace(/\/+$/, '').replace(/\.git$/i, '')
  const parts = cleaned.split('/').filter(Boolean)
  if (parts.length < 2) return ''
  return normalizeRepoFullName(`${parts[0]}/${parts[1]}`)
}
