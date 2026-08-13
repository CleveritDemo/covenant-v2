/**
 * Partición del `.md` materializado en secciones pedibles.
 *
 * Vive en `src/shared/` porque lo necesitan los dos lados: `electron/` para armar
 * el catálogo del prompt, y el renderer para mostrar el presupuesto en el modal
 * de contextos. Duplicar las heurísticas daría cifras distintas de las reales.
 */

import type { TabContext, TabContextPreviewResult } from './tabContext'

export const AUTO_START = '<!-- iaterminal:auto -->'
export const AUTO_END = '<!-- /iaterminal:auto -->'
export const NOTES_START = '<!-- iaterminal:notes -->'
export const NOTES_END = '<!-- /iaterminal:notes -->'
export const MAX_REQUESTED_CONTEXT_CHARS = 60_000
/** Sección de anotaciones; se adjunta sola al pedir cualquier otra del mismo contexto. */
export const NOTES_SECTION_KEY = '__notes'

export interface ContextSectionDescriptor {
  key: string
  label: string
  chars: number
}

export interface ContextSection extends ContextSectionDescriptor {
  content: string
}

export function extractSection(text: string, start: string, end: string): string {
  const startIdx = text.indexOf(start)
  const endIdx = text.indexOf(end)
  if (startIdx < 0 || endIdx < 0 || endIdx <= startIdx) return ''
  return text.slice(startIdx + start.length, endIdx).trim()
}

export function markdownSections(body: string): ContextSection[] {
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  const headings: Array<{ index: number; level: number; key: string; label: string }> = []
  let inFence = false
  for (let index = 0; index < lines.length; index++) {
    if (/^\s*```/.test(lines[index])) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const match = lines[index].match(/^(#{2,3})\s+(.+?)\s*$/)
    if (!match) continue
    const label = match[2].trim()
    headings.push({ index, level: match[1].length, key: label, label })
  }
  if (!headings.length) {
    const content = body.trim()
    return content ? [{ key: 'all', label: 'Contenido', chars: content.length, content }] : []
  }
  return headings.map((heading, position) => {
    let end = lines.length
    for (let next = position + 1; next < headings.length; next++) {
      if (headings[next].level <= heading.level) {
        end = headings[next].index
        break
      }
    }
    const content = lines.slice(heading.index, end).join('\n').trim()
    return { key: heading.key, label: heading.label, chars: content.length, content }
  })
}

export function folderTreeSections(body: string): ContextSection[] {
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  const starts: Array<{ index: number; key: string; label: string }> = []
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (!line.trim() || /^\s/.test(line)) continue
    const label = line.trim()
    const key = label.replace(/\s+\(.*\)$/, '').replace(/\/$/, '')
    starts.push({ index, key: key || 'root', label })
  }
  return starts.map((start, position) => {
    const end = starts[position + 1]?.index ?? lines.length
    const content = lines.slice(start.index, end).join('\n').trim()
    return { key: start.key, label: start.label, chars: content.length, content }
  })
}

export function dependencySections(body: string): ContextSection[] {
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>
    return Object.entries(parsed).map(([key, value]) => {
      const content = JSON.stringify({ [key]: value }, null, 2)
      return { key, label: key, chars: content.length, content }
    })
  } catch {
    return markdownSections(body)
  }
}

/** Slug canónico de page: el mismo alfabeto que normalizeWikiSlug produce. */
const WIKI_SECTION_SLUG_RE = /^[a-z0-9._-]+$/

/**
 * Partición de la wiki materializada: SOLO cortan `## Index`, `## Log` y
 * `### <slug>` con slug canónico. Headings más profundos, con otros textos o
 * dentro de un fence son contenido de la sección en curso.
 */
export function wikiSections(body: string): ContextSection[] {
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  const starts: Array<{ index: number; key: string; label: string }> = []
  let inFence = false
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (/^\s*```/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    if (/^## Index\s*$/.test(line)) {
      starts.push({ index, key: 'index', label: 'Index' })
      continue
    }
    if (/^## Log\s*$/.test(line)) {
      starts.push({ index, key: 'log', label: 'Log' })
      continue
    }
    const page = /^### (\S+)\s*$/.exec(line)
    if (page && WIKI_SECTION_SLUG_RE.test(page[1])) {
      starts.push({ index, key: page[1], label: page[1] })
    }
  }
  if (!starts.length) {
    const content = body.trim()
    return content ? [{ key: 'all', label: 'Contenido', chars: content.length, content }] : []
  }
  return starts.map((start, position) => {
    const end = starts[position + 1]?.index ?? lines.length
    const content = lines.slice(start.index, end).join('\n').trim()
    return { key: start.key, label: start.label, chars: content.length, content }
  })
}

export function gitSections(body: string): ContextSection[] {
  const marker = '\n\nDiff stat:\n'
  const split = body.indexOf(marker)
  if (split < 0) return markdownSections(body)
  const status = body.slice(0, split).trim()
  const diff = `Diff stat:\n${body.slice(split + marker.length)}`
  return [
    { key: 'status', label: 'Git status', chars: status.length, content: status },
    { key: 'diff-stat', label: 'Diff stat', chars: diff.length, content: diff },
  ]
}

export function sectionsForContext(
  context: Pick<TabContext, 'kind'>,
  materialized: TabContextPreviewResult,
): ContextSection[] {
  if (!materialized.ok) {
    const content = `(error: ${materialized.error ?? 'could not materialize context'})`
    return [{ key: 'error', label: 'Error', chars: content.length, content }]
  }
  const auto = extractSection(materialized.content, AUTO_START, AUTO_END)
  const body = context.kind === 'changelog'
    ? materialized.content
    : context.kind === 'notes'
      ? materialized.notesContent ?? ''
      : auto || materialized.content
  let sections: ContextSection[]
  if (context.kind === 'folderTree') sections = folderTreeSections(body)
  else if (context.kind === 'deps') sections = dependencySections(body)
  else if (context.kind === 'git') sections = gitSections(body)
  else if (context.kind === 'wiki') sections = wikiSections(body)
  else sections = markdownSections(body)

  if (context.kind !== 'notes' && context.kind !== 'changelog') {
    const notes = extractSection(materialized.content, NOTES_START, NOTES_END)
    if (notes && notes !== '(no annotations yet)') {
      sections.push({ key: NOTES_SECTION_KEY, label: 'Notas y anotaciones', chars: notes.length, content: notes })
    }
  }
  return sections
}
