import { describe, expect, it } from 'vitest'
import {
  buildDelegationMiniNodes,
  buildPlaneThreadNodes,
  mergePlaneMiniThreadRows,
} from '../planeThreadNodes'

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

  it('una sola fila agregada de ola, aunque haya varias delegaciones pending', () => {
    const delegations = buildDelegationMiniNodes({
      done: 1,
      total: 3,
      items: [
        { delegationId: 'd1', agentLabel: 'Cristian', status: 'done' },
        { delegationId: 'd2', agentLabel: 'David', status: 'running' },
        { delegationId: 'd3', agentLabel: 'Vanesa', status: 'deferred' },
      ],
    }, {
      delegatingTitle: 'Delegando…',
      waveProgress: (done, total) => `Esperando ${done}/${total}`,
    })
    expect(delegations).toHaveLength(1)
    expect(delegations[0]).toMatchObject({
      id: 'delegation:wave',
      title: 'Delegando…',
      activity: 'Esperando 1/3',
      kind: 'delegation',
      dotVariant: 'delegating',
    })
  })

  it('delegación agregada va primero que hilos busy', () => {
    const delegations = buildDelegationMiniNodes({
      done: 0,
      total: 1,
      items: [{
        delegationId: 'd1',
        agentLabel: 'Cristian',
        status: 'running',
      }],
    }, {
      delegatingTitle: 'Delegando…',
      waveProgress: (done, total) => `${done}/${total}`,
    })
    const threads = buildPlaneThreadNodes(catalog, new Set(['t1']), { t1: 'humano' })
    const merged = mergePlaneMiniThreadRows(delegations, threads)
    expect(merged.map(row => row.id)).toEqual(['delegation:wave', 't1'])
    expect(merged[0]?.kind).toBe('delegation')
    expect(merged[0]?.dotVariant).toBe('delegating')
  })
})
