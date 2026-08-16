import type { Language } from '@codemirror/language'
import { highlightTree, tagHighlighter, tags } from '@lezer/highlight'
import { isShellAiCodeLang, resolveAiCodeLanguage } from './aiCodeLang'

export type AiCodeHighlightPiece = {
  text: string
  className?: string
}

export const aiCodeTagHighlighter = tagHighlighter([
  { tag: tags.keyword, class: 'ai-tok-keyword' },
  { tag: tags.controlKeyword, class: 'ai-tok-keyword' },
  { tag: tags.definitionKeyword, class: 'ai-tok-keyword' },
  { tag: tags.modifier, class: 'ai-tok-keyword' },
  { tag: tags.operatorKeyword, class: 'ai-tok-keyword' },
  { tag: tags.string, class: 'ai-tok-string' },
  { tag: tags.special(tags.string), class: 'ai-tok-string' },
  { tag: tags.number, class: 'ai-tok-number' },
  { tag: tags.bool, class: 'ai-tok-bool' },
  { tag: tags.null, class: 'ai-tok-bool' },
  { tag: tags.comment, class: 'ai-tok-comment' },
  { tag: tags.lineComment, class: 'ai-tok-comment' },
  { tag: tags.blockComment, class: 'ai-tok-comment' },
  { tag: tags.function(tags.variableName), class: 'ai-tok-fn' },
  { tag: tags.typeName, class: 'ai-tok-type' },
  { tag: tags.className, class: 'ai-tok-type' },
  { tag: tags.namespace, class: 'ai-tok-type' },
  { tag: tags.propertyName, class: 'ai-tok-prop' },
  { tag: tags.definition(tags.propertyName), class: 'ai-tok-prop' },
  { tag: tags.variableName, class: 'ai-tok-var' },
  { tag: tags.definition(tags.variableName), class: 'ai-tok-def' },
  { tag: tags.operator, class: 'ai-tok-op' },
  { tag: tags.punctuation, class: 'ai-tok-punct' },
  { tag: tags.meta, class: 'ai-tok-meta' },
  { tag: tags.regexp, class: 'ai-tok-regexp' },
  { tag: tags.link, class: 'ai-tok-link' },
  { tag: tags.heading, class: 'ai-tok-heading' },
  { tag: tags.invalid, class: 'ai-tok-invalid' },
])

type Span = { from: number; to: number; className: string }

function mergeSpans(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.from - b.from || a.to - b.to)
  const out: Span[] = []
  for (const span of sorted) {
    const last = out[out.length - 1]
    if (last && last.from === span.from && last.to === span.to) {
      last.className = `${last.className} ${span.className}`.trim()
      continue
    }
    out.push({ ...span })
  }
  return out
}

function spansToPieces(code: string, spans: Span[]): AiCodeHighlightPiece[] {
  if (spans.length === 0) return [{ text: code }]
  const pieces: AiCodeHighlightPiece[] = []
  let cursor = 0
  for (const span of spans) {
    if (span.from > cursor) {
      pieces.push({ text: code.slice(cursor, span.from) })
    }
    if (span.to > span.from) {
      pieces.push({
        text: code.slice(span.from, span.to),
        className: span.className,
      })
    }
    cursor = Math.max(cursor, span.to)
  }
  if (cursor < code.length) {
    pieces.push({ text: code.slice(cursor) })
  }
  return pieces
}

function highlightWithLanguage(code: string, language: Language): AiCodeHighlightPiece[] {
  if (!code) return [{ text: '' }]
  const tree = language.parser.parse(code)
  const spans: Span[] = []
  highlightTree(tree, aiCodeTagHighlighter, (from, to, className) => {
    if (className) spans.push({ from, to, className })
  })
  return spansToPieces(code, mergeSpans(spans))
}

const SHELL_KEYWORDS = new Set([
  'if', 'then', 'else', 'elif', 'fi', 'for', 'do', 'done', 'while', 'until',
  'case', 'esac', 'in', 'function', 'select', 'export', 'local', 'readonly',
  'return', 'exit', 'set', 'unset', 'source', 'alias', 'sudo', 'cd', 'echo',
])

/** Resaltado ligero para bash/zsh cuando no hay parser Lezer. */
function highlightShell(code: string): AiCodeHighlightPiece[] {
  if (!code) return [{ text: '' }]
  const spans: Span[] = []
  const push = (from: number, to: number, className: string): void => {
    if (to > from) spans.push({ from, to, className })
  }

  for (const match of code.matchAll(/(^|\n)(#[^\n]*)/g)) {
    const start = (match.index ?? 0) + match[1].length
    push(start, start + match[2].length, 'ai-tok-comment')
  }

  for (const match of code.matchAll(/"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/g)) {
    push(match.index ?? 0, (match.index ?? 0) + match[0].length, 'ai-tok-string')
  }

  for (const match of code.matchAll(/\$\{[A-Za-z_][A-Za-z0-9_]*\}|\$[A-Za-z_][A-Za-z0-9_]*/g)) {
    push(match.index ?? 0, (match.index ?? 0) + match[0].length, 'ai-tok-var')
  }

  for (const match of code.matchAll(/\b[A-Za-z_][A-Za-z0-9_]*\b/g)) {
    const word = match[0]
    if (!SHELL_KEYWORDS.has(word)) continue
    push(match.index ?? 0, (match.index ?? 0) + word.length, 'ai-tok-keyword')
  }

  return spansToPieces(code, mergeSpans(spans))
}

/** Trocea el código con clases de token cuando el lenguaje está soportado. */
export function buildAiCodeHighlightPieces(code: string, lang: string): AiCodeHighlightPiece[] {
  const language = resolveAiCodeLanguage(lang)
  if (language) return highlightWithLanguage(code, language)
  if (isShellAiCodeLang(lang)) return highlightShell(code)
  return [{ text: code }]
}
