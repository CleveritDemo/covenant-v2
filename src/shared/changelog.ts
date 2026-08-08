// Lectura del CHANGELOG.md que viaja en el bundle (`?raw`).

/**
 * Extrae la sección `## vX.Y.Z` (sin el encabezado) del CHANGELOG.
 *
 * Es lo que se enseña en «Novedades» tras actualizar: las notas del release
 * remoto solo existen mientras la actualización está pendiente, y una vez
 * instalada la única fuente local es este fichero.
 */
export function changelogSection(markdown: string, version: string): string | null {
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const heading = new RegExp(`^##\\s+v?${escaped}(\\s|$)`)
  const lines = markdown.split(/\r?\n/)
  const start = lines.findIndex(line => heading.test(line))
  if (start < 0) return null
  const rest = lines.slice(start + 1)
  const end = rest.findIndex(line => /^##\s/.test(line))
  const body = (end < 0 ? rest : rest.slice(0, end)).join('\n').trim()
  return body || null
}
