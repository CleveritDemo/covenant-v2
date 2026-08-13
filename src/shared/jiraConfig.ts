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

export const DEFAULT_JIRA_JQL = 'assignee = currentUser() AND sprint in openSprints()'
export const DEFAULT_REFRESH_SECONDS = 900
export const DEFAULT_MAX_COMMENTS = 10
const MAX_COMMENTS_CAP = 50

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null

function normalizeSite(raw: unknown): string {
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

export function parseJiraConfig(raw: unknown): JiraProjectConfig | null {
  const record = asRecord(raw)
  if (!record) return null
  const site = normalizeSite(record.site)
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
    defaultJql: typeof record.defaultJql === 'string' && record.defaultJql.trim()
      ? record.defaultJql.trim()
      : DEFAULT_JIRA_JQL,
    refreshSeconds: clamp(record.refreshSeconds, DEFAULT_REFRESH_SECONDS, 0, 86_400),
    maxComments: clamp(record.maxComments, DEFAULT_MAX_COMMENTS, 0, MAX_COMMENTS_CAP),
  }
}
