export const PASTED_TEXT_MIN_CHARS = 700
export const PASTED_TEXT_MIN_LINES = 12
export const MAX_PENDING_PASTED_TEXTS = 5

export interface ComposerPastedText {
  id: string
  text: string
  charCount: number
  lineCount: number
  byteSize: number
}

function lineCountOf(text: string): number {
  return text.split(/\r?\n/).length
}

export function shouldCapturePastedText(text: string): boolean {
  if (text.length >= PASTED_TEXT_MIN_CHARS) return true
  return lineCountOf(text) >= PASTED_TEXT_MIN_LINES
}

export function createPastedText(text: string): ComposerPastedText {
  return {
    id: crypto.randomUUID(),
    text,
    charCount: text.length,
    lineCount: lineCountOf(text),
    byteSize: new TextEncoder().encode(text).length,
  }
}

export function formatPastedTextSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function pastedTextPreview(text: string, maxChars = 180): string {
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars)}…`
}

export function composeTextWithPastes(typed: string, pastes: ComposerPastedText[]): string {
  const parts = [typed.trim(), ...pastes.map(paste => paste.text)].filter(part => part.length > 0)
  return parts.join('\n\n')
}
