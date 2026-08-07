import { describe, expect, it } from 'vitest'
import { MAX_PANE_TITLE_LENGTH, setPaneTitle } from '../tabSession'

describe('setPaneTitle', () => {
  it('guarda el nombre recortado', () => {
    expect(setPaneTitle(undefined, 'p1', '  karlTerminal  ')).toEqual({ p1: 'karlTerminal' })
  })

  it('borra el nombre cuando queda vacío', () => {
    expect(setPaneTitle({ p1: 'karlTerminal', p2: 'build' }, 'p1', '   ')).toEqual({ p2: 'build' })
  })

  it('devuelve undefined cuando no queda ningún nombre', () => {
    expect(setPaneTitle({ p1: 'karlTerminal' }, 'p1', '')).toBeUndefined()
  })

  it('trunca al máximo', () => {
    const long = 'x'.repeat(MAX_PANE_TITLE_LENGTH + 10)
    expect(setPaneTitle(undefined, 'p1', long)?.p1).toHaveLength(MAX_PANE_TITLE_LENGTH)
  })
})
