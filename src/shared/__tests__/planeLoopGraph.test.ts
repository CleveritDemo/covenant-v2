import { describe, expect, it } from 'vitest'
import {
  createLoopLink,
  defaultLoopNodePosition,
  hasLoopLink,
  loopEdgePath,
  outgoingLoopLinks,
  outgoingLoopTargets,
  sanitizePlaneLoopLinks,
  wouldCreateLoopCycle,
} from '@shared/planeLoopGraph'

describe('planeLoopGraph', () => {
  it('detects self-links and cycles', () => {
    expect(wouldCreateLoopCycle([], 'a', 'a')).toBe(true)
    const ab = createLoopLink('a', 'b')
    const bc = createLoopLink('b', 'c')
    expect(wouldCreateLoopCycle([ab, bc], 'c', 'a')).toBe(true)
    expect(wouldCreateLoopCycle([ab, bc], 'a', 'c')).toBe(false)
  })

  it('tracks duplicate and outgoing targets', () => {
    const links = [createLoopLink('a', 'b'), createLoopLink('a', 'c')]
    expect(hasLoopLink(links, 'a', 'b')).toBe(true)
    expect(hasLoopLink(links, 'b', 'a')).toBe(false)
    expect(outgoingLoopTargets(links, 'a')).toEqual(['b', 'c'])
  })

  it('stores target objective on nest links', () => {
    const link = createLoopLink('a', 'b', '  ship the UI  ')
    expect(link.objective).toBe('ship the UI')
    expect(outgoingLoopLinks([link], 'a')).toEqual([link])
  })

  it('sanitizes links against known agents', () => {
    const agents = new Set(['a', 'b'])
    const cleaned = sanitizePlaneLoopLinks(
      [
        { id: '1', fromPaneId: 'a', toPaneId: 'b', objective: ' go ' },
        { id: '2', fromPaneId: 'a', toPaneId: 'missing' },
        { id: '3', fromPaneId: 'a', toPaneId: 'a' },
        { id: '4', fromPaneId: 'a', toPaneId: 'b' },
      ],
      agents,
    )
    expect(cleaned).toHaveLength(1)
    expect(cleaned[0]?.fromPaneId).toBe('a')
    expect(cleaned[0]?.toPaneId).toBe('b')
    expect(cleaned[0]?.objective).toBe('go')
  })

  it('builds a cubic edge path using measured node sizes', () => {
    const path = loopEdgePath(
      { x: 0, y: 0 },
      { x: 280, y: 40 },
      { width: 200, height: 100 },
      { width: 200, height: 120 },
    )
    expect(path.startsWith('M ')).toBe(true)
    expect(path.includes(' C ')).toBe(true)
    // Mid Y of source height 100 → 50; mid of target height 120 at y=40 → 100
    expect(path).toContain('M 201 50')
    expect(path).toContain('279 100')
    expect(defaultLoopNodePosition(0)).toEqual({ x: 48, y: 40 })
    expect(defaultLoopNodePosition(3).y).toBeGreaterThan(defaultLoopNodePosition(0).y)
  })
})
