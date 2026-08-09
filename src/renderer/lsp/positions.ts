// Las posiciones LSP son 0-based (línea, carácter UTF-16). Los offsets de CM6
// son offsets UTF-16 de todo el documento (strings de JS), así que la aritmética
// por línea sobre `Text.line` es exacta: no hay conversión de encoding.
import type { Text } from '@codemirror/state'

export interface LspPosition {
  line: number
  character: number
}

export function offsetToLsp(doc: Text, offset: number): LspPosition {
  const clamped = Math.max(0, Math.min(offset, doc.length))
  const line = doc.lineAt(clamped)
  return { line: line.number - 1, character: clamped - line.from }
}

export function lspToOffset(doc: Text, pos: LspPosition): number {
  if (pos.line >= doc.lines) return doc.length
  const line = doc.line(Math.max(0, pos.line) + 1)
  return Math.min(line.from + Math.max(0, pos.character), line.to)
}

export function lspRangeToCm(
  doc: Text,
  range: { start: LspPosition; end: LspPosition },
): { from: number; to: number } {
  return { from: lspToOffset(doc, range.start), to: lspToOffset(doc, range.end) }
}

export function pathToUri(path: string): string {
  return 'file://' + path.split('/').map(encodeURIComponent).join('/')
}

export function uriToPath(uri: string): string {
  const stripped = uri.replace(/^file:\/\//, '')
  return stripped.split('/').map(decodeURIComponent).join('/')
}
