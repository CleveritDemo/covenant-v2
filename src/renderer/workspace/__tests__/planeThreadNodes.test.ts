import { describe, expect, it } from 'vitest'
import { buildPlaneThreadNodes } from '../planeThreadNodes'

const catalog = [
  { id: 't1', title: 'humano' },
  { id: 'lane-1', title: '' },
]

describe('buildPlaneThreadNodes', () => {
  it('marca running al hilo humano en curso', () => {
    const nodes = buildPlaneThreadNodes(catalog, new Set(['t1']), { t1: 'arregla el composer' })
    expect(nodes).toEqual([
      { id: 't1', title: 'humano', running: true, activity: 'arregla el composer' },
      { id: 'lane-1', title: '', running: false, activity: '' },
    ])
  })

  it('incluye carriles vivos que el catálogo aún no registró', () => {
    // La delegación se despacha con su threadId antes de que el pane abra el
    // carril: sin esto la card se quedaba sin fila durante toda esa ventana.
    const nodes = buildPlaneThreadNodes(catalog, new Set(['t1', 'nuevo']), {
      nuevo: 'implementa el endpoint',
    })
    expect(nodes.map(node => node.id)).toEqual(['t1', 'lane-1', 'nuevo'])
    expect(nodes.find(node => node.id === 'nuevo')).toEqual({
      id: 'nuevo',
      title: '',
      running: true,
      activity: 'implementa el endpoint',
    })
  })

  it('sin hilos activos no marca ninguno', () => {
    const nodes = buildPlaneThreadNodes(catalog, undefined, undefined)
    expect(nodes.every(node => !node.running)).toBe(true)
    expect(nodes).toHaveLength(2)
  })
})
