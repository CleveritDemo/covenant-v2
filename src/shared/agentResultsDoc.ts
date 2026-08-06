/**
 * Parseo puro de `.iaterminal/results/<agent>.md` para la vista Reporte.
 * El formato canónico lo escribe `electron/aiAgentResults.ts`; aquí solo se lee.
 */

export interface AgentResultsLogEntry {
  timestamp: string
  text: string
}

export interface AgentResultsDoc {
  /** `## Latest` sin placeholder, o null si el agente aún no publicó nada. */
  summary: string | null
  /** `## Log`, más recientes primero (tal como los escribe el runtime). */
  entries: AgentResultsLogEntry[]
  /** Región `iaterminal:notes`, sin placeholder. */
  notes: string | null
}

// Placeholders que escribe el host cuando no hay contenido real.
const PLACEHOLDERS = new Set(['(empty)', '(no results yet)', '(no entries yet)', '(no annotations yet)'])

// Sin flag `m`: `$` es fin de archivo, igual que en electron/aiAgentResults.ts.
const LATEST_RE = /##\s+Latest\s*\n([\s\S]*?)(?=\n##\s|\n<!--\s*\/iaterminal:auto|$)/i
const LOG_RE = /##\s+Log\s*\n([\s\S]*?)(?=\n##\s|\n<!--\s*\/iaterminal:auto|$)/i
const LOG_ENTRY_RE = /^-\s+`([^`]+)`\s+—\s+(.+)$/gm
const NOTES_RE = /<!--\s*iaterminal:notes\s*-->([\s\S]*?)<!--\s*\/iaterminal:notes\s*-->/

function clean(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim()
  if (!trimmed || PLACEHOLDERS.has(trimmed)) return null
  return trimmed
}

export function parseAgentResultsDoc(raw: string): AgentResultsDoc {
  const log = raw.match(LOG_RE)?.[1] ?? ''
  return {
    summary: clean(raw.match(LATEST_RE)?.[1]),
    entries: [...log.matchAll(LOG_ENTRY_RE)]
      .map(match => ({ timestamp: match[1].trim(), text: match[2].trim() }))
      .filter(entry => clean(entry.text) !== null),
    notes: clean(raw.match(NOTES_RE)?.[1]),
  }
}

const NOTES_START = '<!-- iaterminal:notes -->'
const NOTES_END = '<!-- /iaterminal:notes -->'
const NOTES_PLACEHOLDER = '(no annotations yet)'

/**
 * Reemplaza SOLO la región `iaterminal:notes`; el bloque `auto` del agente queda
 * intacto byte a byte. Si el archivo no tiene la región, la añade al final.
 */
export function withAgentResultsNotes(raw: string, notes: string): string {
  const body = notes.trim() || NOTES_PLACEHOLDER
  const region = `${NOTES_START}\n${body}\n${NOTES_END}`
  if (NOTES_RE.test(raw)) return raw.replace(NOTES_RE, region)
  return `${raw.replace(/\s*$/, '')}\n\n${region}\n`
}

/** True si el archivo existe pero no tiene contenido publicado ni anotado. */
export function isAgentResultsDocEmpty(doc: AgentResultsDoc): boolean {
  return !doc.summary && !doc.notes && doc.entries.length === 0
}

/** `2026-08-06T14:22:10Z` → `14:22`. Devuelve el crudo si no es una fecha válida. */
export function formatLogTime(timestamp: string, locale?: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return timestamp
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

/**
 * Agrupa entradas por día local, conservando el orden de entrada.
 * `label` es la fecha ISO local (`2026-08-06`) para que el render decida el texto.
 */
export function groupLogEntriesByDay(
  entries: readonly AgentResultsLogEntry[],
): Array<{ day: string; entries: AgentResultsLogEntry[] }> {
  const groups: Array<{ day: string; entries: AgentResultsLogEntry[] }> = []
  for (const entry of entries) {
    const date = new Date(entry.timestamp)
    // ponytail: sin timestamp válido va a su propio grupo sin día; el render lo omite.
    const day = Number.isNaN(date.getTime())
      ? ''
      : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.entries.push(entry)
    else groups.push({ day, entries: [entry] })
  }
  return groups
}
