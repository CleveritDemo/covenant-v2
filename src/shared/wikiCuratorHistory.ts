/**
 * Historial persistente del curador de la wiki: entradas tipadas por rol,
 * recorte por tope y parse seguro desde localStorage. Sin fs ni DOM.
 */

export interface WikiCuratorHistoryEntry {
  role: 'user' | 'curator' | 'error'
  text: string
  at: number
}

export const MAX_WIKI_CURATOR_HISTORY = 80

/** Agrega al final y conserva solo las últimas MAX_WIKI_CURATOR_HISTORY entradas. */
export function appendWikiCuratorHistoryEntry(
  entries: WikiCuratorHistoryEntry[],
  entry: WikiCuratorHistoryEntry,
): WikiCuratorHistoryEntry[] {
  const next = [...entries, entry]
  return next.length > MAX_WIKI_CURATOR_HISTORY
    ? next.slice(next.length - MAX_WIKI_CURATOR_HISTORY)
    : next
}

function isWikiCuratorHistoryEntry(value: unknown): value is WikiCuratorHistoryEntry {
  if (!value || typeof value !== 'object') return false
  const raw = value as Record<string, unknown>
  if (raw.role !== 'user' && raw.role !== 'curator' && raw.role !== 'error') return false
  if (typeof raw.text !== 'string') return false
  if (typeof raw.at !== 'number' || !Number.isFinite(raw.at)) return false
  return true
}

/** Valida shape; JSON inválido o entradas mal formadas se descartan (parcial → válidas). */
export function parseWikiCuratorHistory(json: string): WikiCuratorHistoryEntry[] {
  try {
    const parsed: unknown = JSON.parse(json)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isWikiCuratorHistoryEntry)
  } catch {
    return []
  }
}

export function wikiCuratorHistoryStorageKey(cwd: string): string {
  return `wiki-curator-history:${cwd}`
}
