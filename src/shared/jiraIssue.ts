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
  /**
   * ISO 8601 del `fields.updated`. El picker lo muestra como «hace 2 días»:
   * entre varias issues que casan, la actividad reciente es la señal que
   * distingue la que buscas.
   */
  updated: string
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

export interface PartialIssueKey {
  /** Prefijo tecleado, en mayúsculas: la clave del proyecto. */
  project: string
  /** Dígitos tecleados tras el guion; `''` si todavía no hay ninguno. */
  digits: string
}

/**
 * `CT-`, `CT-12`, `CT-128` → `{ project: 'CT', digits: … }`.
 *
 * Existe porque el `~` de Jira **no indexa la clave de la issue**: buscar
 * `CT-*` por texto no casa nunca, por muy difusa que sea la consulta. Cuando lo
 * tecleado tiene forma de clave, lo útil es acotar al proyecto y filtrar por
 * prefijo de clave; el prefijo ES la clave del proyecto, así que sirve incluso
 * si la lista de `projectKeys` de Ajustes está mal puesta.
 */
export function parsePartialIssueKey(query: string): PartialIssueKey | null {
  const match = (query ?? '').trim().match(/^([A-Za-z][A-Za-z0-9]*)-(\d*)$/)
  if (!match) return null
  return { project: match[1].toUpperCase(), digits: match[2] }
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

/**
 * Lo mínimo que hace falta para saber de qué issue habla un contexto jira.
 * Estructural (no `TabContext`) para que este módulo siga sin importar nada.
 */
export interface JiraIssueKeySource {
  issueKey?: string
  fileName?: string
  name?: string
}

/**
 * La ÚNICA regla de resolución de clave para un contexto jira: `issueKey`
 * explícito y, si falta, el nombre del archivo (`jira/GRAV-412.md` →
 * `GRAV-412`).
 *
 * El fallback no es cosmético: un contexto jira recién descubierto en disco
 * todavía no tiene `issueKey` en su metadata, y hasta que lo tenga los tres
 * lados que preguntan «¿de qué issue es esto?» —`contextFilePath`
 * (`electron/tabContextBuild.ts`), el refresher (`electron/jiraContextRefresh.ts`)
 * y el preámbulo de issues adjuntas (`composePrompt`)— tienen que responder lo
 * mismo. Cuando cada uno traía su propia regla, el preámbulo exigía `issueKey`
 * y los otros dos no: el mismo contexto existía en disco, se refrescaba, y aun
 * así no se anunciaba al agente.
 *
 * Sin `path.basename`: `src/shared/` es puro y el renderer también lo importa.
 */
export function issueKeyFor(context: JiraIssueKeySource): string {
  const explicit = (context.issueKey ?? '').trim()
  if (explicit) return explicit.toUpperCase()
  const source = (context.fileName || context.name || '').trim()
  const base = source.split(/[/\\]/).pop() ?? ''
  return base.replace(/\.md$/i, '').trim().toUpperCase()
}
