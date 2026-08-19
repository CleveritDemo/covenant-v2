import { describe, expect, it } from 'vitest'
import {
  sketchFontSize,
  sketchTextFont,
  sketchTextLineHeight,
  sketchTextLines,
} from '../sketchText'

describe('sketchFontSize', () => {
  it.each([
    [2, 14],
    [3, 20],
    [6, 30],
  ] as const)('mapea grosor %i → %i px', (width, expected) => {
    expect(sketchFontSize(width)).toBe(expected)
  })

  it('devuelve 20 para un grosor desconocido', () => {
    expect(sketchFontSize(4)).toBe(20)
    expect(sketchFontSize(99)).toBe(20)
  })
})

describe('sketchTextFont', () => {
  it('incluye el tamaño y la pila del sistema', () => {
    expect(sketchTextFont(20)).toBe(
      '20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    )
  })
})

describe('sketchTextLineHeight', () => {
  it('redondea fontPx × 1.25', () => {
    expect(sketchTextLineHeight(20)).toBe(25)
    expect(sketchTextLineHeight(14)).toBe(18)
  })
})

describe('sketchTextLines', () => {
  it('parte por saltos de línea', () => {
    expect(sketchTextLines('a\nb\nc')).toEqual(['a', 'b', 'c'])
  })

  it('quita líneas vacías solo al final', () => {
    expect(sketchTextLines('hola\n\n\n')).toEqual(['hola'])
    expect(sketchTextLines('a\n\nb')).toEqual(['a', '', 'b'])
  })

  it('string vacío → []', () => {
    expect(sketchTextLines('')).toEqual([])
    expect(sketchTextLines('\n\n')).toEqual([])
  })
})
