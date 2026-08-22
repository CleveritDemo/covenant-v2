export type PreviewMention = { fileName: string; raw: string }

const PREVIEW_MENTION_RE =
  /(?:\.\/|(?:\/(?:[^\s/\\)`'"]+))+)?\.gravity\/previews\/([^)\s`'"]+?)\.(html|htm|svg)\b/gi

const MAX_PREVIEW_MENTIONS = 3

/**
 * Extrae menciones a artefactos `.gravity/previews/*.html` del texto del agente.
 * Sin fs: solo parsing para que otra capa abra el archivo por basename.
 */
export function findPreviewMentions(text: string): PreviewMention[] {
  if (!text) return []

  const results: PreviewMention[] = []
  const seen = new Set<string>()

  for (const match of text.matchAll(PREVIEW_MENTION_RE)) {
    const matchStart = match.index ?? 0
    const stem = match[1]
    if (stem.includes('..')) continue

    const baseStem = stem.includes('/') ? stem.split('/').pop()! : stem
    if (baseStem.includes('..')) continue

    const ext = match[2].toLowerCase()
    const fileName = `${baseStem}.${ext}`
    if (seen.has(fileName)) continue

    let rawStart = matchStart
    while (rawStart > 0) {
      const prev = text[rawStart - 1]
      if (prev === '/' || prev === '.' || /[A-Za-z0-9_\-]/.test(prev)) {
        rawStart--
      } else {
        break
      }
    }

    seen.add(fileName)
    results.push({
      fileName,
      raw: text.slice(rawStart, matchStart + match[0].length),
    })
    if (results.length >= MAX_PREVIEW_MENTIONS) break
  }

  return results
}
