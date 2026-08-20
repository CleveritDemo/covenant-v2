import { describe, expect, it } from 'vitest'
import { findTextMatches, lineIndexAt } from '../textMatches'

describe('findTextMatches', () => {
  it('devuelve [] con consulta vacía o de un carácter', () => {
    expect(findTextMatches('hello world', '')).toEqual([])
    expect(findTextMatches('hello world', ' ')).toEqual([])
    expect(findTextMatches('hello world', 'h')).toEqual([])
  })

  it('encuentra varias coincidencias sin solape', () => {
    expect(findTextMatches('ababab', 'ab')).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 4 },
      { start: 4, end: 6 },
    ])
  })

  it('no distingue mayúsculas', () => {
    expect(findTextMatches('Hello HELLO', 'hello')).toEqual([
      { start: 0, end: 5 },
      { start: 6, end: 11 },
    ])
  })

  it('respeta offsets exactos en el texto original', () => {
    const text = 'foo Bar foo'
    const matches = findTextMatches(text, 'foo')
    expect(matches).toEqual([
      { start: 0, end: 3 },
      { start: 8, end: 11 },
    ])
    expect(text.slice(matches[0].start, matches[0].end)).toBe('foo')
    expect(text.slice(matches[1].start, matches[1].end)).toBe('foo')
  })
})

describe('lineIndexAt', () => {
  const text = 'line0\nline1\nline2'

  it('devuelve 0 en la primera línea', () => {
    expect(lineIndexAt(text, 0)).toBe(0)
    expect(lineIndexAt(text, 4)).toBe(0)
  })

  it('devuelve el índice correcto en la última línea', () => {
    expect(lineIndexAt(text, text.length)).toBe(2)
    expect(lineIndexAt(text, text.length - 1)).toBe(2)
  })
})
