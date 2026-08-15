import { describe, it, expect } from 'vitest'
import { appendCappedTail, capPendingLine } from '../agentCliRuntime'

describe('appendCappedTail', () => {
  it('concatena mientras cabe', () => {
    expect(appendCappedTail('ab', 'cd', 10)).toBe('abcd')
  })

  it('conserva la cola al pasarse del tope', () => {
    expect(appendCappedTail('abcd', 'ef', 3)).toBe('def')
  })

  it('recorta también cuando el trozo nuevo ya excede el tope', () => {
    expect(appendCappedTail('', 'abcdef', 2)).toBe('ef')
  })

  it('no crece sin límite al repetir', () => {
    let buffer = ''
    for (let i = 0; i < 1_000; i++) buffer = appendCappedTail(buffer, 'linea de stderr\n', 100)
    expect(buffer.length).toBe(100)
  })
})

describe('capPendingLine', () => {
  it('mantiene una línea parcial normal', () => {
    expect(capPendingLine('{"type":"assi', 100)).toBe('{"type":"assi')
  })

  it('descarta la línea parcial que ya no puede ser NDJSON', () => {
    expect(capPendingLine('x'.repeat(101), 100)).toBe('')
  })
})
