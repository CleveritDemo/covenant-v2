import { describe, expect, it } from 'vitest'
import { parseAiMarkdownBlocks, splitChatSentences } from '../AiMarkdown'

describe('splitChatSentences', () => {
  it('splits punto seguido into separate sentences', () => {
    expect(splitChatSentences('Hola. Sigo aquí. Listo.')).toEqual([
      'Hola.',
      'Sigo aquí.',
      'Listo.',
    ])
  })

  it('splits ! and ? the same way', () => {
    expect(splitChatSentences('¿Listo? Sí. ¡Vamos!')).toEqual([
      '¿Listo?',
      'Sí.',
      '¡Vamos!',
    ])
  })

  it('does not split decimals or domains without spaces', () => {
    expect(splitChatSentences('Usa v1.2.3 en example.com ahora.')).toEqual([
      'Usa v1.2.3 en example.com ahora.',
    ])
  })
})

describe('parseAiMarkdownBlocks', () => {
  it('treats a single newline as a separate paragraph', () => {
    const blocks = parseAiMarkdownBlocks('Primera frase.\nSegunda frase.')
    expect(blocks).toEqual([
      { type: 'p', lines: ['Primera frase.'] },
      { type: 'p', lines: ['Segunda frase.'] },
    ])
  })

  it('splits punto seguido on the same line into paragraphs', () => {
    const blocks = parseAiMarkdownBlocks('Uno. Dos. Tres.')
    expect(blocks).toEqual([
      { type: 'p', lines: ['Uno.'] },
      { type: 'p', lines: ['Dos.'] },
      { type: 'p', lines: ['Tres.'] },
    ])
  })

  it('keeps blank lines as paragraph separators without empty blocks', () => {
    const blocks = parseAiMarkdownBlocks('Uno.\n\nDos.')
    expect(blocks).toEqual([
      { type: 'p', lines: ['Uno.'] },
      { type: 'p', lines: ['Dos.'] },
    ])
  })

  it('still groups list items across newlines', () => {
    const blocks = parseAiMarkdownBlocks('- a\n- b\n\nCierre.')
    expect(blocks).toEqual([
      { type: 'ul', items: ['a', 'b'] },
      { type: 'p', lines: ['Cierre.'] },
    ])
  })
})
