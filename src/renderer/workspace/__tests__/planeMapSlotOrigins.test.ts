/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import {
  computePlaneMiniSlotCell,
  computePlaneMiniSlotPadX,
  PLANE_MINI_SLOT_GAP,
  PLANE_MINI_SLOT_PAD_Y,
} from '@shared/paneWindows'
import { buildSlotOrigins, type PlaneMapEntity } from '../PlaneMap'

const VIEWPORT = { width: 1280, height: 800 }

function makeEntity(paneId: string, kind: 'terminal' | 'agent'): PlaneMapEntity {
  return {
    paneId,
    kind,
    title: paneId,
    busy: false,
    window: { open: false, fullscreen: false, zIndex: 1 },
  }
}

const ENTITIES: PlaneMapEntity[] = [
  makeEntity('t1', 'terminal'),
  makeEntity('t2', 'terminal'),
  makeEntity('t3', 'terminal'),
  makeEntity('a1', 'agent'),
  makeEntity('a2', 'agent'),
]

const AGENT_HEIGHTS = { a1: 100, a2: 140 }

describe('buildSlotOrigins virtual scroll', () => {
  it('shifts terminal slots up by scrollOffsets.terminal only', () => {
    const manyTerminals = Array.from({ length: 6 }, (_, index) => (
      makeEntity(`t${index}`, 'terminal')
    ))
    const base = buildSlotOrigins(manyTerminals, VIEWPORT, {})
    const scrolled = buildSlotOrigins(manyTerminals, VIEWPORT, {}, {
      terminal: 50,
      agent: 0,
    })
    expect(scrolled.maxScrollOffsets.terminal).toBeGreaterThan(0)
    for (const entity of manyTerminals) {
      expect(scrolled.origins[entity.paneId].y).toBe(base.origins[entity.paneId].y - 50)
      expect(scrolled.origins[entity.paneId].x).toBe(base.origins[entity.paneId].x)
    }
  })

  it('shifts agent slots up by scrollOffsets.agent only', () => {
    const manyAgents = Array.from({ length: 6 }, (_, index) => (
      makeEntity(`a${index}`, 'agent')
    ))
    const heights = Object.fromEntries(
      manyAgents.map(entity => [entity.paneId, 130]),
    )
    const base = buildSlotOrigins(manyAgents, VIEWPORT, heights)
    const scrolled = buildSlotOrigins(manyAgents, VIEWPORT, heights, {
      terminal: 0,
      agent: 80,
    })
    expect(scrolled.maxScrollOffsets.agent).toBeGreaterThan(0)
    for (const entity of manyAgents) {
      expect(scrolled.origins[entity.paneId].y).toBe(base.origins[entity.paneId].y - 80)
      expect(scrolled.origins[entity.paneId].x).toBe(base.origins[entity.paneId].x)
    }
  })

  it('computes per-column content heights', () => {
    const layout = buildSlotOrigins(ENTITIES, VIEWPORT, AGENT_HEIGHTS)
    const cell = computePlaneMiniSlotCell(VIEWPORT, 3)
    expect(layout.contentHeights.terminal).toBe(
      PLANE_MINI_SLOT_PAD_Y + 3 * cell.height + 2 * PLANE_MINI_SLOT_GAP,
    )
    expect(layout.contentHeights.agent).toBe(
      PLANE_MINI_SLOT_PAD_Y + AGENT_HEIGHTS.a1 + AGENT_HEIGHTS.a2 + PLANE_MINI_SLOT_GAP,
    )
  })

  it('keeps PLANE_MINI_SLOT_GAP between agent cards of different heights', () => {
    const agents: PlaneMapEntity[] = [
      makeEntity('a1', 'agent'),
      makeEntity('a2', 'agent'),
      makeEntity('a3', 'agent'),
    ]
    const heights = { a1: 100, a2: 80, a3: 120 }
    const layout = buildSlotOrigins(agents, VIEWPORT, heights)
    const ids = ['a1', 'a2', 'a3'] as const
    for (let i = 0; i < ids.length - 1; i += 1) {
      const current = layout.origins[ids[i]]
      const next = layout.origins[ids[i + 1]]
      expect(next.y - (current.y + current.height)).toBe(PLANE_MINI_SLOT_GAP)
      expect(current.height).toBe(heights[ids[i]])
    }
    expect(layout.origins.a3.height).toBe(120)
  })

  it('default offsets keep the previous coordinates', () => {
    const implicit = buildSlotOrigins(ENTITIES, VIEWPORT, AGENT_HEIGHTS)
    const explicitZero = buildSlotOrigins(ENTITIES, VIEWPORT, AGENT_HEIGHTS, {
      terminal: 0,
      agent: 0,
    })
    expect(implicit.origins).toEqual(explicitZero.origins)

    const cell = computePlaneMiniSlotCell(VIEWPORT, 3)
    const padX = computePlaneMiniSlotPadX(VIEWPORT, 3)
    const stride = cell.height + PLANE_MINI_SLOT_GAP
    expect(implicit.origins.t1).toEqual({
      x: padX,
      y: PLANE_MINI_SLOT_PAD_Y,
      width: cell.width,
      height: cell.height,
    })
    expect(implicit.origins.t2.y).toBe(PLANE_MINI_SLOT_PAD_Y + stride)
    expect(implicit.origins.a2.y).toBe(
      PLANE_MINI_SLOT_PAD_Y + AGENT_HEIGHTS.a1 + PLANE_MINI_SLOT_GAP,
    )
  })
})
