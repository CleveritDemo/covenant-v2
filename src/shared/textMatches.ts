export interface TextMatch {
  start: number
  end: number
}

/** Coincidencias de subcadena sin distinguir mayúsculas; sin solape. */
export function findTextMatches(text: string, query: string): TextMatch[] {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const lowerText = text.toLocaleLowerCase()
  const lowerQuery = trimmed.toLocaleLowerCase()
  const matches: TextMatch[] = []
  let start = 0

  while (start <= lowerText.length - lowerQuery.length) {
    const idx = lowerText.indexOf(lowerQuery, start)
    if (idx === -1) break
    matches.push({ start: idx, end: idx + lowerQuery.length })
    start = idx + lowerQuery.length
  }

  return matches
}

/** Índice de línea (0-based) del carácter en `offset`. */
export function lineIndexAt(text: string, offset: number): number {
  let line = 0
  const end = Math.min(offset, text.length)
  for (let i = 0; i < end; i++) {
    if (text[i] === '\n') line++
  }
  return line
}
