/**
 * `.gravity/jira.json`: qué sitio, qué proyectos y cada cuánto refrescar.
 *
 * Este archivo se commitea, así que **no tiene campo de credencial**: el par
 * email + API token vive cifrado con `safeStorage` (ver `electron/jiraConfig.ts`).
 * El parseo es puro porque el renderer también lo lee, para saber si debe
 * activar el picker de menciones.
 */

export interface JiraProjectConfig {
  /** Base del sitio Cloud, sin barra final. Siempre https. */
  site: string
  /** Prefijos válidos; acotan el reconocimiento de claves. */
  projectKeys: string[]
  defaultJql: string
  /** 0 desactiva el refresco automático. */
  refreshSeconds: number
  /**
   * Cuántos de los comentarios MÁS RECIENTES entran en el snapshot.
   * `0` es cero comentarios (no «todos»): mismo criterio que `refreshSeconds`
   * aquí al lado, donde 0 también apaga la función.
   */
  maxComments: number
}

/**
 * Qué se ofrece al abrir el picker sin haber escrito nada.
 *
 * «Lo que miraste hace poco» gana a «tu sprint abierto»: al abrir un buscador
 * lo que buscas casi siempre es algo en lo que ya estabas, y la lista sale útil
 * sin teclear. Requiere que la instancia tenga historial (`issueHistory()`),
 * que es estándar en Jira Cloud.
 */
export const DEFAULT_JIRA_JQL = 'issuekey in issueHistory() ORDER BY lastViewed DESC'

/**
 * El default anterior. Un `jira.json` que lo lleve tal cual nunca lo eligió
 * nadie — es el valor que escribimos nosotros — así que se trata como «sin
 * fijar» y se migra al nuevo. Quien de verdad quiera su sprint solo tiene que
 * escribir cualquier variante.
 */
const LEGACY_DEFAULT_JIRA_JQL = 'assignee = currentUser() AND sprint in openSprints()'
export const DEFAULT_REFRESH_SECONDS = 900
export const DEFAULT_MAX_COMMENTS = 10
const MAX_COMMENTS_CAP = 50

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null

export function normalizeJiraSite(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) return ''
  try {
    const url = new URL(raw.trim())
    // http dejaría viajar el Basic auth en claro.
    if (url.protocol !== 'https:') return ''
    return `${url.protocol}//${url.host.toLowerCase()}`
  } catch {
    return ''
  }
}

function clamp(raw: unknown, fallback: number, min: number, max: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback
  if (raw < min || raw > max) return raw > max ? max : fallback
  return Math.round(raw)
}

/**
 * Forma de una CLAVE de proyecto de Jira: letras y dígitos, empezando por
 * letra. Sin guiones — `CDLC-TRANSFORMATION` es el *nombre* del proyecto, y
 * colarlo aquí genera un JQL que Jira rechaza (`project in (…)`), dejando la
 * búsqueda y las menciones mudas. Se valida en la UI para avisar a tiempo, no
 * para bloquear: quien tenga una instancia rara puede seguir guardando.
 */
export function isJiraProjectKey(value: string): boolean {
  return /^[A-Z][A-Z0-9]*$/.test(value.trim().toUpperCase())
}

export function parseJiraConfig(raw: unknown): JiraProjectConfig | null {
  const record = asRecord(raw)
  if (!record) return null
  const site = normalizeJiraSite(record.site)
  if (!site) return null

  const keys = Array.isArray(record.projectKeys) ? record.projectKeys : []
  const projectKeys: string[] = []
  for (const entry of keys) {
    if (typeof entry !== 'string') continue
    const key = entry.trim().toUpperCase()
    if (key && !projectKeys.includes(key)) projectKeys.push(key)
  }

  return {
    site,
    projectKeys,
    defaultJql: typeof record.defaultJql === 'string'
      && record.defaultJql.trim()
      && record.defaultJql.trim() !== LEGACY_DEFAULT_JIRA_JQL
      ? record.defaultJql.trim()
      : DEFAULT_JIRA_JQL,
    refreshSeconds: clamp(record.refreshSeconds, DEFAULT_REFRESH_SECONDS, 0, 86_400),
    maxComments: clamp(record.maxComments, DEFAULT_MAX_COMMENTS, 0, MAX_COMMENTS_CAP),
  }
}
