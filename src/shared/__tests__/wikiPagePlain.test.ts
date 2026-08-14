import { describe, expect, it } from 'vitest'
import { formatWikiPageBodyForHuman } from '../wikiPagePlain'

describe('formatWikiPageBodyForHuman', () => {
  it('resuelve wikilinks con y sin etiqueta', () => {
    expect(formatWikiPageBodyForHuman('Ver [[my-page|Mi página]] y [[other_slug]].'))
      .toBe('Ver Mi página y other slug.')
  })

  it('quita marcas de encabezado', () => {
    expect(formatWikiPageBodyForHuman('## Título\n\nPárrafo.'))
      .toBe('Título\n\nPárrafo.')
  })

  it('quita negrita e inline code', () => {
    expect(formatWikiPageBodyForHuman('Texto **fuerte** y `código`.'))
      .toBe('Texto fuerte y código.')
  })

  it('elimina comentarios HTML', () => {
    expect(formatWikiPageBodyForHuman('Antes <!-- oculto --> después.'))
      .toBe('Antes  después.')
  })

  it('elimina bloques de código fenced', () => {
    expect(formatWikiPageBodyForHuman('Intro\n\n```ts\nconst x = 1\n```\n\nFin'))
      .toBe('Intro\n\nFin')
  })
})
