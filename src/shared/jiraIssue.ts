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

export interface JiraMentionRange {
  /** Offset donde empieza el token completo (incluye el `@` si es búsqueda libre). */
  start: number
  /** Siempre el `caret` recibido: el token termina justo donde miró `mentionRangeAt`. */
  end: number
  query: string
}

/**
 * Igual que `mentionQueryAt`, pero además dice DÓNDE empieza (y termina) el
 * token que disparó la mención — para poder reemplazarlo por la clave
 * canónica del issue elegido (`GRAV-4` truncado → `GRAV-412`) en vez de
 * dejarlo colgado en el borrador. `mentionQueryAt` es un envoltorio de esto:
 * mismo contrato, ya testeado, sin duplicar la regex.
 */
export function mentionRangeAt(
  text: string,
  caret: number,
  projectKeys: readonly string[],
): JiraMentionRange | null {
  if (!projectKeys.length) return null
  const clampedCaret = Math.max(0, caret)
  const before = (text ?? '').slice(0, clampedCaret)

  const mention = before.match(/(?:^|\s)@([\w-]*)$/)
  if (mention) {
    // -1: el `@` no está en el grupo capturado, pero sí en el token a reemplazar.
    return { start: clampedCaret - mention[1].length - 1, end: clampedCaret, query: mention[1] }
  }

  const partial = before.match(/(?:^|\s)([A-Za-z][A-Za-z0-9]*)-(\d*)$/)
  if (!partial) return null
  const project = partial[1].toUpperCase()
  if (!projectKeys.some(key => key.trim().toUpperCase() === project)) return null
  const matchedLength = partial[1].length + 1 + partial[2].length
  return { start: clampedCaret - matchedLength, end: clampedCaret, query: `${project}-${partial[2]}` }
}

/**
 * Qué está escribiendo el usuario justo antes del cursor, si es una mención.
 * Devuelve el término de búsqueda, `''` para un `@` recién tecleado, o `null`
 * si no hay nada que buscar. Vive acá y no en el componente porque es la regla
 * que decide cuándo la app interrumpe al usuario: se testea sin React.
 *
 * El prefijo `PROY-` solo abre el picker si `PROY` está en `projectKeys`: sin
 * ese filtro, `UTF-8`, `SHA-256` o `CVE-2023-30533` abrirían un picker en
 * medio de cualquier frase técnica.
 */
export function mentionQueryAt(
  text: string,
  caret: number,
  projectKeys: readonly string[],
): string | null {
  return mentionRangeAt(text, caret, projectKeys)?.query ?? null
}
