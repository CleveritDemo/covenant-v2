import React, { useMemo } from 'react'
import './AiMarkdown.css'

export type MdListItem = {
  text: string
  /** Solo en tareas (`- [ ]` / `- [x]`). */
  checked?: boolean
  nested?: { type: 'ul' | 'ol'; items: MdListItem[] }
}

type MdBlock =
  | { type: 'h'; level: 1 | 2 | 3 | 4 | 5 | 6; text: string }
  | { type: 'hr' }
  | { type: 'quote'; lines: string[] }
  | { type: 'ul'; items: MdListItem[] }
  | { type: 'ol'; items: MdListItem[] }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'p'; lines: string[] }

type RawListEntry = {
  indent: number
  ordered: boolean
  text: string
  checked?: boolean
}

interface AiMarkdownProps {
  content: string
  showCursor?: boolean
}

let inlineKey = 0

/** Solo http(s); bloquea javascript:, data:, file:, etc. */
function safeMarkdownHref(raw: string): string | null {
  const href = raw.trim()
  if (!href) return null
  try {
    const u = new URL(href)
    if (u.protocol === 'http:' || u.protocol === 'https:') return href
  } catch {
    /* no es URL absoluta */
  }
  return null
}

function openMarkdownExternalUrl(e: React.MouseEvent<HTMLAnchorElement>, href: string): void {
  e.preventDefault()
  e.stopPropagation()
  void window.api?.openExternalUrl(href).then(r => {
    if (r && !r.ok) console.warn('[openExternalUrl]', r.error)
  })
}

function parseInline(text: string): React.ReactNode[] {
  /* Marcadores <<<AI_TERMINAL_*>>> usan _ internos; el markdown los convertiría en cursiva. */
  if (text.includes('<<<')) return [text]

  const nodes: React.ReactNode[] = []
  /* Orden: code con N backticks, links, *** / ___, **, __, ~~, *, _ */
  const re =
    /(`+)((?:(?!\1).)+?)\1|\[([^\]]+)\]\(([^)]+)\)|\*\*\*([^*]+)\*\*\*|___([^_]+)___|\*\*([^*]+)\*\*|__([^_]+)__|~~([^~]+)~~|\*([^*]+)\*|_([^_]+)_/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(text.slice(last, m.index))
    }
    const key = `md-i-${inlineKey++}`
    if (m[1] !== undefined) {
      const code = m[2] ?? ''
      nodes.push(
        <code key={key} className="ai-md__code">
          {code.replace(/^ /u, '').replace(/ $/u, '')}
        </code>,
      )
    } else if (m[3] !== undefined) {
      const safeHref = safeMarkdownHref(m[4] ?? '')
      if (safeHref) {
        nodes.push(
          <a
            key={key}
            className="ai-md__link"
            href={safeHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => openMarkdownExternalUrl(e, safeHref)}
            onAuxClick={e => {
              if (e.button === 1) openMarkdownExternalUrl(e, safeHref)
            }}
          >
            {m[3]}
          </a>,
        )
      } else {
        nodes.push(<span key={key}>{m[3]}</span>)
      }
    } else if (m[5] !== undefined || m[6] !== undefined) {
      nodes.push(
        <strong key={key}>
          <em>{m[5] ?? m[6]}</em>
        </strong>,
      )
    } else if (m[7] !== undefined || m[8] !== undefined) {
      nodes.push(<strong key={key}>{m[7] ?? m[8]}</strong>)
    } else if (m[9] !== undefined) {
      nodes.push(<del key={key}>{m[9]}</del>)
    } else {
      const italic = m[10] ?? m[11]
      if (italic) nodes.push(<em key={key}>{italic}</em>)
    }
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes.length > 0 ? nodes : [text]
}

function headingLevel(line: string): 1 | 2 | 3 | 4 | 5 | 6 | null {
  const m = line.match(/^(#{1,6})\s+(.+)$/)
  if (!m) return null
  return m[1].length as 1 | 2 | 3 | 4 | 5 | 6
}

function isHr(line: string): boolean {
  return /^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())
}

/** Espacios + tabs (tab = 4) delante del marcador de lista. */
function leadingIndent(line: string): number {
  let n = 0
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === ' ') n += 1
    else if (ch === '\t') n += 4
    else break
  }
  return n
}

function parseListLine(line: string): RawListEntry | null {
  const task = line.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)$/)
  if (task) {
    return {
      indent: leadingIndent(line),
      ordered: false,
      text: task[3],
      checked: task[2].toLowerCase() === 'x',
    }
  }
  const ul = line.match(/^(\s*)[-*+]\s+(.+)$/)
  if (ul) {
    return { indent: leadingIndent(line), ordered: false, text: ul[2] }
  }
  const ol = line.match(/^(\s*)\d+\.\s+(.+)$/)
  if (ol) {
    return { indent: leadingIndent(line), ordered: true, text: ol[2] }
  }
  return null
}

function buildList(
  entries: RawListEntry[],
  from: number,
  baseIndent: number,
): { list: { type: 'ul' | 'ol'; items: MdListItem[] }; next: number } {
  const ordered = entries[from].ordered
  const items: MdListItem[] = []
  let i = from

  while (i < entries.length) {
    const entry = entries[i]
    if (entry.indent < baseIndent) break
    if (entry.indent > baseIndent) break
    if (entry.ordered !== ordered) break

    const item: MdListItem = { text: entry.text }
    if (entry.checked !== undefined) item.checked = entry.checked
    i++

    if (i < entries.length && entries[i].indent > baseIndent) {
      const nested = buildList(entries, i, entries[i].indent)
      item.nested = nested.list
      i = nested.next
    }
    items.push(item)
  }

  return { list: { type: ordered ? 'ol' : 'ul', items }, next: i }
}

function parseListBlocks(entries: RawListEntry[]): MdBlock[] {
  const blocks: MdBlock[] = []
  let i = 0
  while (i < entries.length) {
    const built = buildList(entries, i, entries[i].indent)
    blocks.push(built.list)
    i = built.next
  }
  return blocks
}

/** Celdas de una fila `| a | b |`; sin pipes escapados (nadie los escribe en el chat). */
function tableCells(line: string): string[] | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('|')) return null
  return trimmed.replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim())
}

/** `|---|:--:|` — la fila que confirma que la anterior era la cabecera. */
function isTableDivider(line: string | undefined): boolean {
  const cells = line === undefined ? null : tableCells(line)
  return !!cells && cells.length > 0 && cells.every(cell => /^:?-{1,}:?$/.test(cell))
}

/**
 * Índice de la siguiente línea con contenido. Tablas y listas pegadas a mano
 * suelen llegar con un blanco entre filas/ítems; markdown estricto las partiría
 * en bloques sueltos (y la tabla saldría como pipes crudos).
 */
function skipBlank(lines: readonly string[], from: number): number {
  let i = from
  while (i < lines.length && !lines[i].trim()) i++
  return i
}

function isQuote(line: string): string | null {
  const m = line.match(/^\s*>\s?(.*)$/)
  return m ? m[1] : null
}

/**
 * Punto seguido / ! / ? → párrafos de chat separados.
 * Solo corta si hay espacio después del signo (no parte 3.14 ni example.com).
 */
export function splitChatSentences(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  return trimmed
    .split(/(?<=[.!?…])\s+(?=\S)/u)
    .map(part => part.trim())
    .filter(Boolean)
}

function parseBlocks(raw: string): MdBlock[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const blocks: MdBlock[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }

    const h = headingLevel(line)
    if (h) {
      blocks.push({ type: 'h', level: h, text: line.replace(/^#+\s+/, '') })
      i++
      continue
    }

    if (isHr(line)) {
      blocks.push({ type: 'hr' })
      i++
      continue
    }

    const head = tableCells(line)
    const dividerAt = head ? skipBlank(lines, i + 1) : -1
    if (head && isTableDivider(lines[dividerAt])) {
      const rows: string[][] = []
      i = dividerAt + 1
      while (i < lines.length) {
        const at = skipBlank(lines, i)
        const cells = at < lines.length ? tableCells(lines[at]) : null
        if (!cells) break
        rows.push(cells)
        i = at + 1
      }
      blocks.push({ type: 'table', head, rows })
      continue
    }

    const q = isQuote(line)
    if (q !== null) {
      const items: string[] = [q]
      i++
      while (i < lines.length) {
        const nq = isQuote(lines[i])
        if (nq === null) break
        items.push(nq)
        i++
      }
      for (const item of items) {
        for (const sentence of splitChatSentences(item)) {
          blocks.push({ type: 'quote', lines: [sentence] })
        }
      }
      continue
    }

    const listEntry = parseListLine(line)
    if (listEntry) {
      const entries: RawListEntry[] = [listEntry]
      i++
      while (i < lines.length) {
        const at = skipBlank(lines, i)
        const next = at < lines.length ? parseListLine(lines[at]) : null
        if (!next) break
        entries.push(next)
        i = at + 1
      }
      blocks.push(...parseListBlocks(entries))
      continue
    }

    // `\n` y punto seguido = párrafo aparte.
    for (const sentence of splitChatSentences(line)) {
      blocks.push({ type: 'p', lines: [sentence] })
    }
    i++
  }

  return blocks
}

function headingTag(level: 1 | 2 | 3 | 4 | 5 | 6): 'h3' | 'h4' | 'h5' | 'h6' {
  if (level === 1) return 'h3'
  if (level === 2) return 'h4'
  if (level === 3) return 'h5'
  return 'h6'
}

function renderListItem(item: MdListItem, j: number): React.ReactNode {
  return (
    <li key={j} className={item.checked !== undefined ? 'ai-md__task' : undefined}>
      {item.checked !== undefined && (
        <input
          type="checkbox"
          className="ai-md__task-check"
          checked={item.checked}
          disabled
          readOnly
          tabIndex={-1}
          aria-hidden={false}
        />
      )}
      {parseInline(item.text)}
      {item.nested && renderList(item.nested, `n-${j}`)}
    </li>
  )
}

function renderList(
  list: { type: 'ul' | 'ol'; items: MdListItem[] },
  key: string,
): React.ReactNode {
  if (list.type === 'ul') {
    return (
      <ul key={key} className="ai-md__ul">
        {list.items.map((item, j) => renderListItem(item, j))}
      </ul>
    )
  }
  return (
    <ol key={key} className="ai-md__ol">
      {list.items.map((item, j) => renderListItem(item, j))}
    </ol>
  )
}

function renderBlock(block: MdBlock, index: number): React.ReactNode {
  const key = `md-b-${index}`
  switch (block.type) {
    case 'h': {
      const Tag = headingTag(block.level)
      return (
        <Tag key={key} className={`ai-md__h ai-md__h--${block.level}`}>
          {parseInline(block.text)}
        </Tag>
      )
    }
    case 'hr':
      return <hr key={key} className="ai-md__hr" />
    case 'quote':
      return (
        <blockquote key={key} className="ai-md__quote">
          {block.lines.map((ln, j) => (
            <p key={j}>{parseInline(ln)}</p>
          ))}
        </blockquote>
      )
    case 'ul':
    case 'ol':
      return renderList(block, key)
    case 'table':
      return (
        <div key={key} className="ai-md__table-wrap">
          <table className="ai-md__table">
            <thead>
              <tr>
                {block.head.map((cell, j) => (
                  <th key={j}>{parseInline(cell)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, j) => (
                <tr key={j}>
                  {row.map((cell, k) => (
                    <td key={k}>{parseInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'p':
      return (
        <p key={key} className="ai-md__p">
          {parseInline(block.lines[0] ?? '')}
        </p>
      )
    default:
      return null
  }
}

/** Parser de bloques markdown del chat (exportado para tests). */
export function parseAiMarkdownBlocks(raw: string): MdBlock[] {
  return parseBlocks(raw)
}

export const AiMarkdown: React.FC<AiMarkdownProps> = ({ content, showCursor }) => {
  const blocks = useMemo(() => {
    inlineKey = 0
    return parseBlocks(content.trim())
  }, [content])

  if (blocks.length === 0) return null

  return (
    <div className="ai-md">
      {blocks.map((b, i) => renderBlock(b, i))}
      {showCursor && <span className="ai-cursor">▌</span>}
    </div>
  )
}
