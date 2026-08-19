/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react'
import { AiMarkdown, parseAiMarkdownBlocks, splitChatSentences } from '../AiMarkdown'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string) => (key === 'aiCodeBlock.copyLinkLabel' ? 'Copy link' : key),
  }),
}))

afterEach(cleanup)

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

  it('keeps a bold span with inner punto seguido intact and splits after it', () => {
    expect(
      splitChatSentences('**1. Suscripción y provider.** En la suscripción de Cleverit ahora.'),
    ).toEqual([
      '**1. Suscripción y provider.**',
      'En la suscripción de Cleverit ahora.',
    ])
  })

  it('does not split inside inline code that contains punto seguido', () => {
    const parts = splitChatSentences('`npm i. luego build` sigue aquí.')
    expect(parts.some(p => p.includes('`npm i. luego build`'))).toBe(true)
  })

  it('does not split inside a link label that contains punto seguido', () => {
    const parts = splitChatSentences('[Ver docs. ahora](https://example.com/x) sigue aquí.')
    expect(parts.some(p => p.includes('[Ver docs. ahora](https://example.com/x)'))).toBe(true)
  })

  it('does not split text that contains a terminal marker', () => {
    expect(splitChatSentences('<<<AI_TERMINAL_X>>> algo. mas.')).toEqual([
      '<<<AI_TERMINAL_X>>> algo. mas.',
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
      { type: 'ul', items: [{ text: 'a' }, { text: 'b' }] },
      { type: 'p', lines: ['Cierre.'] },
    ])
  })
})

describe('parseAiMarkdownBlocks · encabezados', () => {
  it('parses h1–h3 as before', () => {
    expect(parseAiMarkdownBlocks('# Uno\n## Dos\n### Tres')).toEqual([
      { type: 'h', level: 1, text: 'Uno' },
      { type: 'h', level: 2, text: 'Dos' },
      { type: 'h', level: 3, text: 'Tres' },
    ])
  })

  it('parses h4–h6 instead of leaving hashes in a paragraph', () => {
    expect(parseAiMarkdownBlocks('#### Cuatro\n##### Cinco\n###### Seis')).toEqual([
      { type: 'h', level: 4, text: 'Cuatro' },
      { type: 'h', level: 5, text: 'Cinco' },
      { type: 'h', level: 6, text: 'Seis' },
    ])
  })
})

describe('parseAiMarkdownBlocks · listas anidadas', () => {
  it('nests unordered items indented with 2 spaces', () => {
    const blocks = parseAiMarkdownBlocks('- padre\n  - hijo\n  - hermano\n- otro')
    expect(blocks).toEqual([
      {
        type: 'ul',
        items: [
          {
            text: 'padre',
            nested: { type: 'ul', items: [{ text: 'hijo' }, { text: 'hermano' }] },
          },
          { text: 'otro' },
        ],
      },
    ])
  })

  it('nests with 4 spaces and tabs', () => {
    const blocks = parseAiMarkdownBlocks('- a\n    - b\n\t- c')
    expect(blocks).toEqual([
      {
        type: 'ul',
        items: [
          {
            text: 'a',
            nested: { type: 'ul', items: [{ text: 'b' }, { text: 'c' }] },
          },
        ],
      },
    ])
  })

  it('nests an unordered list under an ordered item', () => {
    const blocks = parseAiMarkdownBlocks('1. uno\n   - nested\n2. dos')
    expect(blocks).toEqual([
      {
        type: 'ol',
        items: [
          { text: 'uno', nested: { type: 'ul', items: [{ text: 'nested' }] } },
          { text: 'dos' },
        ],
      },
    ])
  })

  it('keeps two levels deep without flattening', () => {
    const blocks = parseAiMarkdownBlocks('- L0\n  - L1\n    - L2')
    expect(blocks).toEqual([
      {
        type: 'ul',
        items: [
          {
            text: 'L0',
            nested: {
              type: 'ul',
              items: [
                {
                  text: 'L1',
                  nested: { type: 'ul', items: [{ text: 'L2' }] },
                },
              ],
            },
          },
        ],
      },
    ])
  })
})

describe('parseAiMarkdownBlocks · checklists', () => {
  it('marks unchecked and checked task items', () => {
    const blocks = parseAiMarkdownBlocks('- [ ] pendiente\n- [x] hecho\n- [X] mayúscula')
    expect(blocks).toEqual([
      {
        type: 'ul',
        items: [
          { text: 'pendiente', checked: false },
          { text: 'hecho', checked: true },
          { text: 'mayúscula', checked: true },
        ],
      },
    ])
  })

  it('renders disabled checkboxes for task items', () => {
    render(<AiMarkdown content={'- [ ] pendiente\n- [x] hecho'} />)
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(boxes).toHaveLength(2)
    expect(boxes[0].hasAttribute('disabled')).toBe(true)
    expect(boxes[0].checked).toBe(false)
    expect(boxes[1].hasAttribute('disabled')).toBe(true)
    expect(boxes[1].checked).toBe(true)
    expect(screen.queryByText('[ ]')).toBeNull()
    expect(screen.queryByText('[x]')).toBeNull()
  })
})

describe('parseAiMarkdownBlocks · tablas', () => {
  it('parses a pipe table with its divider', () => {
    const blocks = parseAiMarkdownBlocks('| A | B |\n|---|:-:|\n| 1 | 2 |\n\nFin.')
    expect(blocks).toEqual([
      { type: 'table', head: ['A', 'B'], rows: [['1', '2']] },
      { type: 'p', lines: ['Fin.'] },
    ])
  })

  it('leaves a pipe line without divider as text', () => {
    const blocks = parseAiMarkdownBlocks('| solo una fila |')
    expect(blocks).toEqual([{ type: 'p', lines: ['| solo una fila |'] }])
  })

  // Contextos .md escritos a mano llegan con un blanco entre cada fila.
  it('parses a table with blank lines between rows', () => {
    const blocks = parseAiMarkdownBlocks(
      '| A | B |\n\n|---|---|\n\n| 1 | 2 |\n\n| 3 | 4 |',
    )
    expect(blocks).toEqual([
      { type: 'table', head: ['A', 'B'], rows: [['1', '2'], ['3', '4']] },
    ])
  })

  it('stops the table at the first non-row line', () => {
    const blocks = parseAiMarkdownBlocks('| A |\n|---|\n| 1 |\n\nFin.\n\n| suelta |')
    expect(blocks).toEqual([
      { type: 'table', head: ['A'], rows: [['1']] },
      { type: 'p', lines: ['Fin.'] },
      { type: 'p', lines: ['| suelta |'] },
    ])
  })

  it('keeps a loose list as one list', () => {
    expect(parseAiMarkdownBlocks('- uno\n\n- dos')).toEqual([
      { type: 'ul', items: [{ text: 'uno' }, { text: 'dos' }] },
    ])
  })
})

describe('AiMarkdown · inline', () => {
  it('renders bold and italic combined via ***', () => {
    const { container } = render(<AiMarkdown content="***ambos***" />)
    const strong = container.querySelector('strong')
    expect(strong).toBeTruthy()
    expect(strong?.querySelector('em')?.textContent).toBe('ambos')
  })

  it('renders strikethrough', () => {
    const { container } = render(<AiMarkdown content="~~viejo~~" />)
    expect(container.querySelector('del')?.textContent).toBe('viejo')
  })

  it('keeps a literal backtick via double-backtick fences', () => {
    const { container } = render(<AiMarkdown content={'`` ` ``'} />)
    expect(container.querySelector('code')?.textContent).toBe('`')
  })

  it('still blocks javascript: links', () => {
    render(<AiMarkdown content={'[x](javascript:alert(1))'} />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('x')).toBeTruthy()
  })

  it('renders a bold span with inner punto seguido as one strong without literal asterisks', () => {
    const { container } = render(<AiMarkdown content="**1. Paso uno.** Sigue el resto." />)
    const strongs = container.querySelectorAll('strong')
    expect(strongs).toHaveLength(1)
    expect(strongs[0].textContent).toBe('1. Paso uno.')
    expect(container.textContent).not.toContain('*')
  })

  it('renders a single link when the label contains punto seguido', () => {
    const { container } = render(
      <AiMarkdown content={'[Ver docs. ahora](https://example.com/x) sigue aquí.'} />,
    )
    const links = container.querySelectorAll('a')
    expect(links).toHaveLength(1)
    expect(links[0].textContent).toBe('Ver docs. ahora')
  })
})

describe('AiMarkdown · openExternalUrl', () => {
  const openExternalUrl = vi.fn()

  beforeEach(() => {
    openExternalUrl.mockReset()
    openExternalUrl.mockResolvedValue({ ok: true })
    vi.stubGlobal('window', Object.assign(window, { api: { openExternalUrl } }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('opens http links via window.api.openExternalUrl and prevents default', () => {
    render(<AiMarkdown content={'[docs](https://example.com/path)'} />)
    const link = screen.getByRole('link')
    const event = createEvent.click(link)
    fireEvent(link, event)
    expect(openExternalUrl).toHaveBeenCalledWith('https://example.com/path')
    expect(event.defaultPrevented).toBe(true)
  })

  it('opens middle-click via auxclick the same way', () => {
    render(<AiMarkdown content={'[docs](https://example.com/path)'} />)
    const link = screen.getByRole('link')
    const event = new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 })
    fireEvent(link, event)
    expect(openExternalUrl).toHaveBeenCalledWith('https://example.com/path')
    expect(event.defaultPrevented).toBe(true)
  })

  it('renders a javascript: href as a span and does not call openExternalUrl', () => {
    render(<AiMarkdown content={'[x](javascript:alert(1))'} />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('x').tagName).toBe('SPAN')
    expect(openExternalUrl).not.toHaveBeenCalled()
  })
})

describe('parseAiMarkdownBlocks · robustez', () => {
  it('does not throw on a table without divider and keeps the text', () => {
    expect(() => parseAiMarkdownBlocks('| a | b |\n| c | d |')).not.toThrow()
    expect(parseAiMarkdownBlocks('| a | b |\n| c | d |')).toEqual([
      { type: 'p', lines: ['| a | b |'] },
      { type: 'p', lines: ['| c | d |'] },
    ])
  })

  it('does not throw on an unclosed fence and keeps the text', () => {
    expect(() => parseAiMarkdownBlocks('```\ncode')).not.toThrow()
    const blocks = parseAiMarkdownBlocks('```\ncode')
    expect(blocks.some(b => b.type === 'p' && b.lines[0]?.includes('```'))).toBe(true)
    expect(blocks.some(b => b.type === 'p' && b.lines[0] === 'code')).toBe(true)
  })

  it('treats a lone # as a paragraph, not a heading', () => {
    expect(parseAiMarkdownBlocks('#')).toEqual([{ type: 'p', lines: ['#'] }])
  })

  it('starts a list immediately after a paragraph without a blank line', () => {
    expect(parseAiMarkdownBlocks('texto\n- item')).toEqual([
      { type: 'p', lines: ['texto'] },
      { type: 'ul', items: [{ text: 'item' }] },
    ])
  })
})
