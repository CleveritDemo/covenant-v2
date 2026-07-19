import React, { useMemo } from 'react'
import './AiMarkdown.css'

type MdBlock =
  | { type: 'h'; level: 1 | 2 | 3; text: string }
  | { type: 'hr' }
  | { type: 'quote'; lines: string[] }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'p'; lines: string[] }

interface AiMarkdownProps {
  content: string
  showCursor?: boolean
}

let inlineKey = 0

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
      nodes.push(
        <a
          key={key}
          className="ai-md__link"
          href={m[3]}
          target="_blank"
          rel="noopener noreferrer"
        >
          {m[2]}
        </a>,
      )
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

function isQuote(line: string): string | null {
  const m = line.match(/^\s*>\s?(.*)$/)
  return m ? m[1] : null
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
      blocks.push({ type: 'quote', lines: items })
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

    const para: string[] = [line]
    i++
    while (i < lines.length) {
      const next = lines[i]
      if (
        !next.trim() ||
        headingLevel(next) ||
        isHr(next) ||
        isQuote(next) !== null ||
        isUlItem(next) ||
        isOlItem(next)
      ) {
        break
      }
      para.push(next)
      i++
    }
    blocks.push({ type: 'p', lines: para })
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
    case 'p':
      return (
        <p key={key} className="ai-md__p">
          {block.lines.map((ln, j) => (
            <React.Fragment key={j}>
              {j > 0 && <br />}
              {parseInline(ln)}
            </React.Fragment>
          ))}
        </p>
      )
    default:
      return null
  }
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
