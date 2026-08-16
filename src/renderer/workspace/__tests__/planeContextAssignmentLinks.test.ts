import { describe, expect, it } from 'vitest'
import {
  buildContextAssignmentEdges,
  buildContextConnectorPaths,
  contextConnectorAnchors,
  contextConnectorPath,
  focusedContextEdges,
  renderedContextLinksEqual,
  resolveConnectorLanes,
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
    expect(from.x - to.x).toBeGreaterThanOrEqual(10)
    expect(from.x - to.x).toBeLessThanOrEqual(CONTEXT_LINK_MIN_REACH)
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
  it('usa curva suave con tangentes horizontales y poco arco', () => {
    const d = contextConnectorPath({ x: 900, y: 310 }, { x: 780, y: 400 })
    expect(d).toBe('M 900 310 C 868 310 812 400 780 400')
    expect(d).toContain('C ')
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

  it('en corredor estrecho curva por eje vertical con menos giro', () => {
    const d = contextConnectorPath({ x: 320, y: 180 }, { x: 260, y: 420 })
    expect(d).toBe('M 320 180 C 310 180 290 180 290 300 C 290 420 270 420 260 420')
  })

  it('reparte carriles cuando hay varias líneas en el mismo foco', () => {
    const left = contextConnectorPath(
      { x: 300, y: 200 },
      { x: 240, y: 210 },
      { laneIndex: 0, laneCount: 3 },
    )
    const right = contextConnectorPath(
      { x: 300, y: 200 },
      { x: 240, y: 210 },
      { laneIndex: 2, laneCount: 3 },
    )
    expect(left).not.toBe(right)
  })

  it('resolveConnectorLanes agrupa solo destinos con Y parecida', () => {
    const links = [
      { key: 'a:1', from: { x: 300, y: 100 }, to: { x: 240, y: 110 }, color: '#f0a' },
      { key: 'b:1', from: { x: 300, y: 115 }, to: { x: 240, y: 118 }, color: '#0aa' },
      { key: 'c:1', from: { x: 300, y: 400 }, to: { x: 240, y: 410 }, color: '#00f' },
    ]
    expect(resolveConnectorLanes(links)).toEqual([
      { laneIndex: 0, laneCount: 2 },
      { laneIndex: 1, laneCount: 2 },
      { laneIndex: 0, laneCount: 1 },
    ])
  })

  it('destinos lejanos no abanicán carriles entre sí', () => {
    const paths = buildContextConnectorPaths([
      { key: 'a:1', from: { x: 900, y: 100 }, to: { x: 780, y: 120 }, color: '#f0a' },
      { key: 'b:1', from: { x: 900, y: 500 }, to: { x: 780, y: 520 }, color: '#0aa' },
    ])
    expect(paths[0]?.d).toBe('M 900 100 C 868 100 812 120 780 120')
    expect(paths[1]?.d).toBe('M 900 500 C 868 500 812 520 780 520')
  })
})
