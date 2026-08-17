/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import {
  computePlaneMiniSlotPadX,
  PLANE_MINI_AGENT_BOTTOM_CLEARANCE,
  PLANE_MINI_AGENT_WIDTH,
  PLANE_MINI_TERMINAL_HEIGHT,
  PLANE_MINI_SLOT_GAP,
  PLANE_MINI_SLOT_PAD_Y,
} from '@shared/paneWindows'
import { buildSlotOrigins, computeColumnOverflowBandAnchors, type PlaneMapEntity } from '../PlaneMap'

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
    const manyTerminals = Array.from({ length: 10 }, (_, index) => (
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
    expect(layout.contentHeights.terminal).toBe(
      PLANE_MINI_SLOT_PAD_Y + 3 * PLANE_MINI_TERMINAL_HEIGHT + 2 * PLANE_MINI_SLOT_GAP,
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

    const padX = computePlaneMiniSlotPadX(VIEWPORT, 3)
    const stride = PLANE_MINI_TERMINAL_HEIGHT + PLANE_MINI_SLOT_GAP
    expect(implicit.origins.t1).toEqual({
      x: padX,
      y: PLANE_MINI_SLOT_PAD_Y,
      width: PLANE_MINI_AGENT_WIDTH,
      height: PLANE_MINI_TERMINAL_HEIGHT,
    })
    expect(implicit.origins.t2.y).toBe(PLANE_MINI_SLOT_PAD_Y + stride)
    expect(implicit.origins.a1.y).toBe(PLANE_MINI_SLOT_PAD_Y)
    expect(implicit.origins.a2.y).toBe(
      PLANE_MINI_SLOT_PAD_Y + AGENT_HEIGHTS.a1 + PLANE_MINI_SLOT_GAP,
    )
  })

  it('anchors overflow arrows to the fixed visible band, not the stack', () => {
    const anchors = computeColumnOverflowBandAnchors(
      VIEWPORT.height,
      PLANE_MINI_AGENT_BOTTOM_CLEARANCE,
    )
    expect(anchors.up).toBe(PLANE_MINI_SLOT_PAD_Y - 8 - 24)
    expect(anchors.down).toBe(
      VIEWPORT.height - PLANE_MINI_AGENT_BOTTOM_CLEARANCE + 8,
    )

    const manyAgents = Array.from({ length: 6 }, (_, index) => (
      makeEntity(`a${index}`, 'agent')
    ))
    const heights = Object.fromEntries(
      manyAgents.map(entity => [entity.paneId, 130]),
    )
    const scrolled = buildSlotOrigins(manyAgents, VIEWPORT, heights, {
      terminal: 0,
      agent: 200,
    })
    expect(scrolled.hidden.agent.above.length).toBeGreaterThan(0)
    const scrolledAnchors = computeColumnOverflowBandAnchors(
      VIEWPORT.height,
      PLANE_MINI_AGENT_BOTTOM_CLEARANCE,
    )
    expect(scrolledAnchors).toEqual(anchors)
  })

  it('anchors agent overflow arrows smaller and farther from the visible band', () => {
    const terminalAnchors = computeColumnOverflowBandAnchors(
      VIEWPORT.height,
      PLANE_MINI_AGENT_BOTTOM_CLEARANCE,
    )
    const agentAnchors = computeColumnOverflowBandAnchors(
      VIEWPORT.height,
      PLANE_MINI_AGENT_BOTTOM_CLEARANCE,
      {
        arrowSize: 18,
        gap: 12,
        outward: 10,
      },
    )
    expect(agentAnchors.up).toBeLessThan(terminalAnchors.up)
    expect(agentAnchors.down).toBeGreaterThan(terminalAnchors.down)
  })
})
