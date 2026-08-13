import { describe, expect, it } from 'vitest'
import { highlightParts } from '../textHighlight'

describe('highlightParts', () => {
  it('parte el texto en antes / coincidencia / después', () => {
    expect(highlightParts('CT-124: Auto en rojo', 'CT-12')).toEqual([
      { text: 'CT-12', match: true },
      { text: '4: Auto en rojo', match: false },
    ])
  })

  it('no distingue mayúsculas, pero devuelve el texto original', () => {
    expect(highlightParts('Loop chain colgada', 'LOOP')).toEqual([
      { text: 'Loop', match: true },
      { text: ' chain colgada', match: false },
    ])
  })

  it('sin coincidencia devuelve una sola parte: el llamador no necesita casos especiales', () => {
    expect(highlightParts('Loop chain', 'zzz')).toEqual([{ text: 'Loop chain', match: false }])
  })

  it('consulta vacía no resalta nada', () => {
    expect(highlightParts('Loop chain', '   ')).toEqual([{ text: 'Loop chain', match: false }])
  })

  it('no deja partes vacías cuando la coincidencia toca un borde', () => {
    expect(highlightParts('CT-1', 'CT-1')).toEqual([{ text: 'CT-1', match: true }])
  })
})
