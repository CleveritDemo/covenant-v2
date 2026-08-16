import { describe, expect, it } from 'vitest'
import { buildAiCodeHighlightPieces } from '../aiCodeHighlight'

describe('buildAiCodeHighlightPieces', () => {
  it('resalta keywords en javascript', () => {
    const pieces = buildAiCodeHighlightPieces('const value = 1', 'javascript')
    expect(pieces.some(p => p.className === 'ai-tok-keyword' && p.text === 'const')).toBe(true)
    expect(pieces.some(p => p.className === 'ai-tok-number' && p.text === '1')).toBe(true)
  })

  it('resalta typescript con el parser de TS', () => {
    const pieces = buildAiCodeHighlightPieces('interface User {}', 'typescript')
    expect(pieces.some(p => p.className === 'ai-tok-keyword' && p.text === 'interface')).toBe(true)
  })

  it('resalta comentarios en bash', () => {
    const pieces = buildAiCodeHighlightPieces('# setup\nexport PATH=/tmp', 'bash')
    expect(pieces.some(p => p.className === 'ai-tok-comment' && p.text.startsWith('#'))).toBe(true)
    expect(pieces.some(p => p.className === 'ai-tok-keyword' && p.text === 'export')).toBe(true)
  })

  it('deja texto plano en lenguajes sin soporte', () => {
    const pieces = buildAiCodeHighlightPieces('plain text', 'plaintext')
    expect(pieces).toEqual([{ text: 'plain text' }])
  })
})
