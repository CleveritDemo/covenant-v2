/**
 * Arma el payload que se escribe al PTY al pulsar «poner en terminal».
 * Inserta sin ejecutar: Ctrl+U (`\x15`) limpia la línea; una sola línea va
 * cruda, varias van en bracketed paste (igual que ⌘V en zsh/bash). Nunca
 * añade `\r`.
 */
export function buildTerminalInsertPayload(code: string): string {
  const normalized = code
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
  const lines = normalized.split('\n').map(line => line.trimEnd())
  while (lines.length > 0 && lines[0] === '') lines.shift()
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  if (lines.length === 0) return ''
  if (lines.length === 1) return `\x15${lines[0]}`
  return `\x15\x1b[200~${lines.join('\n')}\x1b[201~`
}
