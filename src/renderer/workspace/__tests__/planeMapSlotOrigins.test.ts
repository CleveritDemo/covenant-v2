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
    const base = buildSlotOrigins(ENTITIES, VIEWPORT, AGENT_HEIGHTS)
    const scrolled = buildSlotOrigins(ENTITIES, VIEWPORT, AGENT_HEIGHTS, {
      terminal: 50,
      agent: 0,
    })
    for (const id of ['t1', 't2', 't3']) {
      expect(scrolled.origins[id].y).toBe(base.origins[id].y - 50)
      expect(scrolled.origins[id].x).toBe(base.origins[id].x)
    }
    for (const id of ['a1', 'a2']) {
      expect(scrolled.origins[id]).toEqual(base.origins[id])
    }
  })

  it('shifts agent slots up by scrollOffsets.agent only', () => {
    const base = buildSlotOrigins(ENTITIES, VIEWPORT, AGENT_HEIGHTS)
    const scrolled = buildSlotOrigins(ENTITIES, VIEWPORT, AGENT_HEIGHTS, {
      terminal: 0,
      agent: 80,
    })
    for (const id of ['a1', 'a2']) {
      expect(scrolled.origins[id].y).toBe(base.origins[id].y - 80)
      expect(scrolled.origins[id].x).toBe(base.origins[id].x)
    }
    for (const id of ['t1', 't2', 't3']) {
      expect(scrolled.origins[id]).toEqual(base.origins[id])
    }
  })

  it('computes per-column content heights', () => {
    const layout = buildSlotOrigins(ENTITIES, VIEWPORT, AGENT_HEIGHTS)
    const cell = computePlaneMiniSlotCell(VIEWPORT, 3)
    expect(layout.contentHeights.terminal).toBe(
      PLANE_MINI_SLOT_PAD_Y + 3 * cell.height + 2 * PLANE_MINI_SLOT_GAP,
    )
    expect(layout.contentHeights.agent).toBe(
      PLANE_MINI_SLOT_PAD_Y
      + (AGENT_HEIGHTS.a1 + PLANE_MINI_SLOT_GAP)
      + (AGENT_HEIGHTS.a2 + PLANE_MINI_SLOT_GAP),
    )
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
