import { describe, expect, it } from 'vitest'
import {
  buildContextAssignmentEdges,
  buildContextConnectorPaths,
  contextConnectorAnchors,
  contextConnectorPath,
  focusedContextEdges,
  renderedContextLinksEqual,
  CONTEXT_LINK_MIN_REACH,
  type PlaneRect,
} from '../planeContextAssignmentLinkGeometry'

function rect(left: number, top: number, width: number, height: number): PlaneRect {
  return { left, top, width, height, right: left + width, bottom: top + height }
}

const PLANE = rect(0, 0, 1000, 800)

describe('buildContextAssignmentEdges', () => {
  it('crea una arista por par contexto-agente asignado', () => {
    const edges = buildContextAssignmentEdges(
      [
        { paneId: 'a1', contextIds: ['tree', 'deps'] },
        { paneId: 'a2', contextIds: ['tree'] },
      ],
      { tree: '#0aa', deps: '#f0a' },
    )
    expect(edges).toEqual([
      { contextId: 'tree', paneId: 'a1', color: '#0aa' },
      { contextId: 'deps', paneId: 'a1', color: '#f0a' },
      { contextId: 'tree', paneId: 'a2', color: '#0aa' },
    ])
  })

  it('omite contextos sin color en el catálogo del pool', () => {
    expect(buildContextAssignmentEdges(
      [{ paneId: 'a1', contextIds: ['missing'] }],
      {},
    )).toEqual([])
  })
})

describe('focusedContextEdges', () => {
  const edges = buildContextAssignmentEdges(
    [
      { paneId: 'a1', contextIds: ['tree', 'deps'] },
      { paneId: 'a2', contextIds: ['tree'] },
    ],
    { tree: '#0aa', deps: '#f0a' },
  )

  it('sin foco no dibuja ninguna conexión', () => {
    expect(focusedContextEdges(edges, {})).toEqual([])
    expect(focusedContextEdges(edges, { contextId: null, paneId: null })).toEqual([])
  })

  it('con un contexto señalado muestra solo sus agentes', () => {
    expect(focusedContextEdges(edges, { contextId: 'tree' })).toEqual([
      { contextId: 'tree', paneId: 'a1', color: '#0aa' },
      { contextId: 'tree', paneId: 'a2', color: '#0aa' },
    ])
  })

  it('con un agente señalado muestra solo sus contextos', () => {
    expect(focusedContextEdges(edges, { paneId: 'a1' })).toEqual([
      { contextId: 'tree', paneId: 'a1', color: '#0aa' },
      { contextId: 'deps', paneId: 'a1', color: '#f0a' },
    ])
  })
})

describe('contextConnectorAnchors', () => {
  it('sale del borde izquierdo del chip y remata en el borde derecho de la card', () => {
    const { from, to } = contextConnectorAnchors(
      PLANE,
      rect(900, 300, 20, 20),
      rect(400, 200, 380, 160),
      rect(430, 320, 18, 18),
    )
    expect(from).toEqual({ x: 900, y: 310 })
    expect(to).toEqual({ x: 780, y: 329 })
  })

  it('nunca entra a la card más allá del borde: usa la derecha, no el icono', () => {
    const iconLeft = 430
    const { to } = contextConnectorAnchors(
      PLANE,
      rect(900, 300, 20, 20),
      rect(400, 200, 380, 160),
      rect(iconLeft, 320, 18, 18),
    )
    expect(to.x).toBeGreaterThan(iconLeft)
  })

  it('garantiza un recorrido mínimo cuando la card queda bajo el pool', () => {
    const { from, to } = contextConnectorAnchors(
      PLANE,
      rect(900, 300, 20, 20),
      rect(400, 200, 520, 160),
      null,
    )
    expect(from.x - to.x).toBe(CONTEXT_LINK_MIN_REACH)
  })

  it('acota el remate dentro del alto de la card', () => {
    const card = rect(400, 200, 380, 160)
    const { to } = contextConnectorAnchors(
      PLANE,
      rect(900, 700, 20, 20),
      card,
      rect(430, 700, 18, 18),
    )
    expect(to.y).toBeLessThanOrEqual(card.bottom)
    expect(to.y).toBeGreaterThanOrEqual(card.top)
  })

  it('sin icono del contexto remata en el centro vertical de la card', () => {
    const { to } = contextConnectorAnchors(
      PLANE,
      rect(900, 300, 20, 20),
      rect(400, 200, 380, 160),
      null,
    )
    expect(to.y).toBe(280)
  })
})

describe('renderedContextLinksEqual', () => {
  const sample = buildContextConnectorPaths([
    { key: 'a:1', from: { x: 900, y: 100 }, to: { x: 780, y: 120 }, color: '#f0a' },
  ])

  it('detecta cambios en la curva o el remate', () => {
    expect(renderedContextLinksEqual(sample, sample)).toBe(true)
    const moved = buildContextConnectorPaths([
      { key: 'a:1', from: { x: 900, y: 100 }, to: { x: 780, y: 140 }, color: '#f0a' },
    ])
    expect(renderedContextLinksEqual(sample, moved)).toBe(false)
  })
})

describe('contextConnectorPath', () => {
  it('es una curva única con tangentes horizontales, sin espinas ni tramos rectos', () => {
    const d = contextConnectorPath({ x: 900, y: 310 }, { x: 780, y: 400 })
    expect(d.startsWith('M 900 310')).toBe(true)
    expect(d).toContain('C ')
    expect(d.endsWith('780 400')).toBe(true)
    expect(d).not.toContain('H ')
    expect(d).not.toContain('V ')
  })

  it('cada conexión traza su propia curva entre sus dos anclajes', () => {
    const paths = buildContextConnectorPaths([
      { key: 'a:1', from: { x: 900, y: 100 }, to: { x: 780, y: 120 }, color: '#f0a' },
      { key: 'b:1', from: { x: 900, y: 220 }, to: { x: 780, y: 240 }, color: '#0aa' },
    ])
    expect(paths).toHaveLength(2)
    expect(paths[0]?.d).not.toBe(paths[1]?.d)
    expect(paths[0]?.to).toEqual({ x: 780, y: 120 })
  })
})
