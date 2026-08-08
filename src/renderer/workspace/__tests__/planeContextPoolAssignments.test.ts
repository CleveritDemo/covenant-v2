import { describe, expect, it } from 'vitest'
import {
  assignedPaneIdsByContext,
  type PlaneContextPoolAgent,
} from '../PlaneContextPool'

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
