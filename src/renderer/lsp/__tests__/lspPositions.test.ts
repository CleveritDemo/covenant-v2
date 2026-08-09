import { Text } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { lspRangeToCm, lspToOffset, offsetToLsp, pathToUri, uriToPath } from '../positions'

const doc = Text.of(['const a = 1', 'const b = 2', ''])

describe('posiciones LSP ↔ CM6', () => {
  it('offsetToLsp devuelve línea y carácter 0-based', () => {
    expect(offsetToLsp(doc, 0)).toEqual({ line: 0, character: 0 })
    expect(offsetToLsp(doc, 12)).toEqual({ line: 1, character: 0 })
  })

  it('offsetToLsp acota fuera de rango en vez de reventar', () => {
    expect(offsetToLsp(doc, -5)).toEqual({ line: 0, character: 0 })
    expect(offsetToLsp(doc, 9999)).toEqual(offsetToLsp(doc, doc.length))
  })

  it('lspToOffset es el inverso dentro del documento', () => {
    for (const offset of [0, 3, 11, 12, 20]) {
      expect(lspToOffset(doc, offsetToLsp(doc, offset))).toBe(offset)
    }
  })

  it('lspToOffset acota una línea o columna que se pasa', () => {
    expect(lspToOffset(doc, { line: 99, character: 0 })).toBe(doc.length)
    // Un carácter más allá del fin de línea se recorta al fin de esa línea, no
    // se derrama a la siguiente.
    expect(lspToOffset(doc, { line: 0, character: 999 })).toBe(11)
  })

  it('lspRangeToCm mapea los dos extremos', () => {
    expect(lspRangeToCm(doc, {
      start: { line: 0, character: 6 },
      end: { line: 1, character: 5 },
    })).toEqual({ from: 6, to: 17 })
  })

  it('pathToUri y uriToPath hacen ida y vuelta con espacios', () => {
    const path = '/Users/x/mi proyecto/src/main.rs'
    expect(pathToUri(path)).toBe('file:///Users/x/mi%20proyecto/src/main.rs')
    expect(uriToPath(pathToUri(path))).toBe(path)
  })
})
