import { describe, expect, it } from 'vitest'
import {
  assignedPaneIdsByContext,
  splitPoolContexts,
  POOL_VISIBLE_CAP,
  type PlaneContextPoolAgent,
} from '../planeContextPoolLayout'

const agent = (
  paneId: string,
  contextIds: string[],
): PlaneContextPoolAgent => ({ paneId, title: paneId, contextIds })

describe('assignedPaneIdsByContext', () => {
  it('agrupa los agentes que tienen cada contexto', () => {
    const map = assignedPaneIdsByContext([
      agent('a', ['tree', 'deps']),
      agent('b', ['tree']),
      agent('c', []),
    ])
    expect(map).toEqual({ tree: ['a', 'b'], deps: ['a'] })
  })

  it('no cuenta dos veces un contexto duplicado en el mismo agente', () => {
    const map = assignedPaneIdsByContext([agent('a', ['tree', 'tree'])])
    expect(map.tree).toEqual(['a'])
  })

  it('devuelve un mapa vacío sin agentes', () => {
    expect(assignedPaneIdsByContext([])).toEqual({})
  })
})

describe('splitPoolContexts', () => {
  const ids = (contexts: readonly { id: string }[]): string[] => contexts.map(c => c.id)
  const catalog = (...names: string[]): { id: string }[] => names.map(id => ({ id }))
  const none = (): number => 0

  it('no desborda mientras el catálogo quepa en el tope', () => {
    const { visible, overflow } = splitPoolContexts(catalog('a', 'b', 'c'), none)
    expect(ids(visible)).toEqual(['a', 'b', 'c'])
    expect(overflow).toEqual([])
  })

  it('corta en el tope y manda el resto al desbordamiento', () => {
    const all = catalog('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h')
    const { visible, overflow } = splitPoolContexts(all, none)
    expect(visible).toHaveLength(POOL_VISIBLE_CAP)
    expect(ids(overflow)).toEqual(['g', 'h'])
  })

  it('sube a la barra los contextos asignados, aunque estén al final del catálogo', () => {
    const all = catalog('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h')
    const assigned = (id: string): number => (id === 'h' ? 2 : id === 'g' ? 1 : 0)
    const { visible, overflow } = splitPoolContexts(all, assigned)
    expect(ids(visible)).toEqual(['h', 'g', 'a', 'b', 'c', 'd'])
    expect(ids(overflow)).toEqual(['e', 'f'])
  })

  it('conserva el orden del catálogo entre contextos con el mismo uso', () => {
    const { visible } = splitPoolContexts(catalog('a', 'b', 'c'), none, 2)
    expect(ids(visible)).toEqual(['a', 'b'])
  })

  it('no falla con el catálogo vacío', () => {
    expect(splitPoolContexts([], none)).toEqual({ visible: [], overflow: [] })
  })
})
