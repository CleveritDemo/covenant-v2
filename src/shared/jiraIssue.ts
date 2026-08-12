/**
 * Tipos y parseo de issues de Jira. Puro: vive acá porque lo necesitan los dos
 * lados — `electron/` para materializar el `.md` y el renderer para el picker
 * del composer, que debe reconocer exactamente las mismas claves.
 */

export interface JiraIssueRef {
  key: string
  summary: string
  status: string
  issueType: string
  assignee: string | null
}

export interface JiraComment {
  author: string
  /** ISO 8601 tal como lo devuelve Jira. */
  created: string
  body: string
}

export interface JiraIssueSnapshot extends JiraIssueRef {
  priority: string | null
  sprint: string | null
  /** ISO 8601 del `fields.updated` de Jira; la cabecera del `.md` lo muestra. */
  updated: string
  url: string
  description: string
  /** Campo custom si el proyecto lo tiene; si no, null y no se escribe la sección. */
  acceptanceCriteria: string | null
  comments: JiraComment[]
  subtasks: JiraIssueRef[]
  links: Array<{ type: string; key: string; summary: string }>
}

const KEY_RE = /^([A-Z][A-Z0-9]*)-(\d+)$/

/** `' grav-412 '` → `'GRAV-412'`. Cadena vacía si no es una clave. */
export function normalizeIssueKey(raw: string): string {
  const candidate = (raw ?? '').trim().toUpperCase()
  return KEY_RE.test(candidate) ? candidate : ''
}

/**
 * Claves presentes en el texto, **acotadas a los proyectos declarados**. Sin ese
 * filtro `UTF-8`, `SHA-256` o `CVE-2023-30533` se leerían como issues.
 * Los bordes `(?<![A-Z0-9])` / `(?![\w-])` evitan partir palabras y sufijos.
 */
export function parseIssueKeys(text: string, projectKeys: readonly string[]): string[] {
  const allowed = new Set(
    projectKeys.map(key => key.trim().toUpperCase()).filter(Boolean),
  )
  if (!allowed.size) return []

  const found: string[] = []
  const seen = new Set<string>()
  const re = /(?<![A-Z0-9])([A-Z][A-Z0-9]*)-(\d+)(?![\w-])/gi
  for (const match of (text ?? '').matchAll(re)) {
    const project = match[1].toUpperCase()
    if (!allowed.has(project)) continue
    const key = `${project}-${match[2]}`
    if (seen.has(key)) continue
    seen.add(key)
    found.push(key)
  }
  return found
}

/**
 * `refreshSeconds` a 0 desactiva el refresco: el snapshot es manual.
 * `mtimeMs` a 0 significa «no hay archivo», y eso siempre se refresca.
 */
export function isSnapshotStale(mtimeMs: number, refreshSeconds: number, nowMs: number): boolean {
  if (!mtimeMs) return true
  if (refreshSeconds <= 0) return false
  return nowMs - mtimeMs >= refreshSeconds * 1000
}
