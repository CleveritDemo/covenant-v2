import { describe, expect, it } from 'vitest'
import { buildTerminalInsertPayload } from '../terminalInsertPayload'

describe('buildTerminalInsertPayload', () => {
  it('una línea: Ctrl+U + texto, sin \\r', () => {
    expect(buildTerminalInsertPayload('ls -la')).toBe('\x15ls -la')
    expect(buildTerminalInsertPayload('ls -la').includes('\r')).toBe(false)
  })

  it('multilínea: Ctrl+U + bracketed paste, sin ejecutar', () => {
    expect(buildTerminalInsertPayload('echo a\necho b')).toBe(
      '\x15\x1b[200~echo a\necho b\x1b[201~',
    )
  })

  it('normaliza CRLF a LF', () => {
    expect(buildTerminalInsertPayload('echo a\r\necho b')).toBe(
      '\x15\x1b[200~echo a\necho b\x1b[201~',
    )
  })

  it('recorta líneas vacías al final y espacios finales', () => {
    expect(buildTerminalInsertPayload('ls  \n\n')).toBe('\x15ls')
  })

  it('string vacío → \'\'', () => {
    expect(buildTerminalInsertPayload('')).toBe('')
    expect(buildTerminalInsertPayload('\n\n  \n')).toBe('')
  })
})
