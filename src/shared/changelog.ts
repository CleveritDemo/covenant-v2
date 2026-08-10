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

const VERSION_HEADING = /^##\s/
const TOP_LEVEL_BULLET = /^- /

/**
 * Recorta el CHANGELOG a las N modificaciones más recientes (Configuración).
 *
 * Una modificación es un bullet top-level (`- ...`) en el orden del fichero.
 * Conserva los `## v...` que aportan bullets incluidos y sus líneas de
 * continuación; deja fuera el preámbulo y los bullets posteriores al límite.
 */
export function changelogRecentModifications(markdown: string, limit = 10): string {
  if (limit <= 0) return ''

  const lines = markdown.split(/\r?\n/)
  const out: string[] = []
  let taken = 0
  let i = 0
  let pendingHeading: string | null = null

  while (i < lines.length && !VERSION_HEADING.test(lines[i]!)) i++

  while (i < lines.length && taken < limit) {
    const line = lines[i]!

    if (VERSION_HEADING.test(line)) {
      pendingHeading = line
      i++
      continue
    }

    if (TOP_LEVEL_BULLET.test(line)) {
      if (pendingHeading) {
        if (out.length > 0) out.push('')
        out.push(pendingHeading)
        out.push('')
        pendingHeading = null
      }

      const bullet: string[] = [line]
      i++
      while (i < lines.length) {
        const next = lines[i]!
        if (VERSION_HEADING.test(next) || TOP_LEVEL_BULLET.test(next)) break
        bullet.push(next)
        i++
      }
      while (bullet.length > 1 && bullet[bullet.length - 1] === '') bullet.pop()

      out.push(...bullet)
      taken++
      continue
    }

    i++
  }

  return out.join('\n').trim()
}
