import React, { useMemo } from 'react'
import './AiMarkdown.css'

type MdBlock =
  | { type: 'h'; level: 1 | 2 | 3; text: string }
  | { type: 'hr' }
  | { type: 'quote'; lines: string[] }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'p'; lines: string[] }

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

function parseInline(text: string): React.ReactNode[] {
  /* Marcadores <<<AI_TERMINAL_*>>> usan _ internos; el markdown los convertiría en cursiva. */
  if (text.includes('<<<')) return [text]

  const nodes: React.ReactNode[] = []
  const re =
    /(`[^`]+`|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(text.slice(last, m.index))
    }
    const key = `md-i-${inlineKey++}`
    if (m[0].startsWith('`')) {
      nodes.push(
        <code key={key} className="ai-md__code">
          {m[0].slice(1, -1)}
        </code>,
      )
    } else if (m[2] !== undefined) {
      const safeHref = safeMarkdownHref(m[3] ?? '')
      if (safeHref) {
        nodes.push(
          <a
            key={key}
            className="ai-md__link"
            href={safeHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            {m[2]}
          </a>,
        )
      } else {
        nodes.push(<span key={key}>{m[2]}</span>)
      }
    } else {
      const bold = m[4] ?? m[5]
      const italic = m[6] ?? m[7]
      if (bold) nodes.push(<strong key={key}>{bold}</strong>)
      else if (italic) nodes.push(<em key={key}>{italic}</em>)
    }
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes.length > 0 ? nodes : [text]
}

function headingLevel(line: string): 1 | 2 | 3 | null {
  const m = line.match(/^(#{1,3})\s+(.+)$/)
  if (!m) return null
  return m[1].length as 1 | 2 | 3
}

function isHr(line: string): boolean {
  return /^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())
}

function isUlItem(line: string): string | null {
  const m = line.match(/^\s*[-*+]\s+(.+)$/)
  return m ? m[1] : null
}

function isOlItem(line: string): string | null {
  const m = line.match(/^\s*\d+\.\s+(.+)$/)
  return m ? m[1] : null
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
    if (head && isTableDivider(lines[i + 1])) {
      const rows: string[][] = []
      i += 2
      while (i < lines.length) {
        const cells = tableCells(lines[i])
        if (!cells) break
        rows.push(cells)
        i++
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

    const ul = isUlItem(line)
    if (ul) {
      const items: string[] = [ul]
      i++
      while (i < lines.length) {
        const nu = isUlItem(lines[i])
        if (!nu) break
        items.push(nu)
        i++
      }
      blocks.push({ type: 'ul', items })
      continue
    }

    const ol = isOlItem(line)
    if (ol) {
      const items: string[] = [ol]
      i++
      while (i < lines.length) {
        const no = isOlItem(lines[i])
        if (!no) break
        items.push(no)
        i++
      }
      blocks.push({ type: 'ol', items })
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

function renderBlock(block: MdBlock, index: number): React.ReactNode {
  const key = `md-b-${index}`
  switch (block.type) {
    case 'h': {
      const Tag = block.level === 1 ? 'h3' : block.level === 2 ? 'h4' : 'h5'
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
      return (
        <ul key={key} className="ai-md__ul">
          {block.items.map((item, j) => (
            <li key={j}>{parseInline(item)}</li>
          ))}
        </ul>
      )
    case 'ol':
      return (
        <ol key={key} className="ai-md__ol">
          {block.items.map((item, j) => (
            <li key={j}>{parseInline(item)}</li>
          ))}
        </ol>
      )
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
