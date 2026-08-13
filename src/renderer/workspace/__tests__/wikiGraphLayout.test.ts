import { describe, expect, it } from 'vitest'
import {
  createSeededRandom,
  layoutWikiGraph,
  wikiGraphMockData,
  type WikiGraphNodeType,
} from '../wikiGraph'

const positionsAsObject = (
  layout: Map<string, [number, number, number]>,
): Record<string, [number, number, number]> => Object.fromEntries(layout)

describe('createSeededRandom', () => {
  it('misma semilla → misma secuencia; semillas distintas divergen', () => {
    const a = createSeededRandom(7)
    const b = createSeededRandom(7)
    const c = createSeededRandom(8)
    const seqA = Array.from({ length: 10 }, () => a())
    const seqB = Array.from({ length: 10 }, () => b())
    const seqC = Array.from({ length: 10 }, () => c())
    expect(seqA).toEqual(seqB)
    expect(seqA).not.toEqual(seqC)
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('layoutWikiGraph', () => {
  const data = wikiGraphMockData()

  it('es determinista: mismo seed → posiciones idénticas', () => {
    const first = layoutWikiGraph(data, { seed: 42 })
    const second = layoutWikiGraph(data, { seed: 42 })
    expect(positionsAsObject(first)).toEqual(positionsAsObject(second))
  })

  it('otro seed produce otro layout', () => {
    const first = layoutWikiGraph(data, { seed: 42 })
    const other = layoutWikiGraph(data, { seed: 1337 })
    const anyDiffers = data.nodes.some(node => {
      const [ax, ay, az] = first.get(node.slug)!
      const [bx, by, bz] = other.get(node.slug)!
      return ax !== bx || ay !== by || az !== bz
    })
    expect(anyDiffers).toBe(true)
  })

  it('devuelve una posición 3D finita por nodo, sin solapes', () => {
    const layout = layoutWikiGraph(data, { seed: 42 })
    expect(layout.size).toBe(data.nodes.length)
    const points = data.nodes.map(node => layout.get(node.slug)!)
    for (const point of points) {
      expect(point).toHaveLength(3)
      for (const coord of point) expect(Number.isFinite(coord)).toBe(true)
    }
    let minDist = Infinity
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const [ax, ay, az] = points[i]!
        const [bx, by, bz] = points[j]!
        minDist = Math.min(
          minDist,
          Math.hypot(ax - bx, ay - by, az - bz),
        )
      }
    }
    expect(minDist).toBeGreaterThan(0.5)
  })
})

describe('wikiGraphMockData', () => {
  it('trae ~15 nodos con los 4 tipos y aristas válidas', () => {
    const data = wikiGraphMockData()
    expect(data.nodes.length).toBeGreaterThanOrEqual(15)
    const types = new Set<WikiGraphNodeType>(data.nodes.map(node => node.type))
    expect(types).toEqual(new Set(['concept', 'decision', 'flow', 'reference']))
    const slugs = new Set(data.nodes.map(node => node.slug))
    expect(slugs.size).toBe(data.nodes.length)
    for (const edge of data.edges) {
      expect(slugs.has(edge.from)).toBe(true)
      expect(slugs.has(edge.to)).toBe(true)
    }
  })

  it('linkCount refleja el grado real de cada nodo', () => {
    const data = wikiGraphMockData()
    const degree = new Map<string, number>()
    for (const edge of data.edges) {
      degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1)
      degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1)
    }
    for (const node of data.nodes) {
      expect(node.linkCount).toBe(degree.get(node.slug) ?? 0)
    }
  })
})
