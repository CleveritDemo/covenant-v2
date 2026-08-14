import { describe, expect, it } from 'vitest'
import {
  PLANE_MINI_BOTTOM_CLEARANCE,
  PLANE_MINI_SLOT_GAP,
  PLANE_MINI_SLOT_PAD_Y,
} from '@shared/paneWindows'
import { computePlaneColumnWindowing } from '@shared/planeColumnWindowing'

const VIEWPORT_HEIGHT = 800

describe('computePlaneColumnWindowing', () => {
  it('returns empty layout for an empty column', () => {
    const result = computePlaneColumnWindowing({
      items: [],
      viewportHeight: VIEWPORT_HEIGHT,
      scrollOffset: 0,
    })

    expect(result).toEqual({
      slots: [],
      hiddenAbove: [],
      hiddenBelow: [],
      contentHeight: 0,
      maxScroll: 0,
      appliedScrollOffset: 0,
    })
  })

  it('keeps three short cards fully visible with no scroll', () => {
    const result = computePlaneColumnWindowing({
      items: [
        { id: 'a', height: 100 },
        { id: 'b', height: 100 },
        { id: 'c', height: 100 },
      ],
      viewportHeight: VIEWPORT_HEIGHT,
      scrollOffset: 0,
    })

    expect(result.contentHeight).toBe(
      PLANE_MINI_SLOT_PAD_Y + 300 + 2 * PLANE_MINI_SLOT_GAP,
    )
    expect(result.maxScroll).toBe(0)
    expect(result.appliedScrollOffset).toBe(0)
    expect(result.slots.every(slot => slot.visible)).toBe(true)
    expect(result.slots.every(slot => slot.progress === 1)).toBe(true)
    expect(result.hiddenAbove).toEqual([])
    expect(result.hiddenBelow).toEqual([])
  })

  it('overflows tall stacks into hiddenBelow without crossing bandBottom', () => {
    const result = computePlaneColumnWindowing({
      items: Array.from({ length: 6 }, (_, index) => ({
        id: `c${index}`,
        height: 130,
      })),
      viewportHeight: VIEWPORT_HEIGHT,
      scrollOffset: 0,
    })

    const bandBottom = Math.max(
      PLANE_MINI_SLOT_PAD_Y + 1,
      VIEWPORT_HEIGHT - PLANE_MINI_BOTTOM_CLEARANCE,
    )

    expect(result.contentHeight).toBe(952)
    expect(result.maxScroll).toBe(248)
    expect(result.slots.filter(slot => slot.visible).every(
      slot => slot.y + slot.height <= bandBottom + 1,
    )).toBe(true)
    expect(result.hiddenBelow.every(id => {
      const slot = result.slots.find(item => item.id === id)
      return slot?.progress === 0
    })).toBe(true)
    expect(result.hiddenAbove.every(id => {
      const slot = result.slots.find(item => item.id === id)
      return slot?.progress === 0
    })).toBe(true)
    expect(result.hiddenBelow.length).toBeGreaterThan(0)
    expect(result.hiddenAbove).toEqual([])
  })

  it('clamps scrollOffset above maxScroll and below zero', () => {
    const items = [{ id: 'a', height: 900 }]
    const maxScroll = computePlaneColumnWindowing({
      items,
      viewportHeight: VIEWPORT_HEIGHT,
      scrollOffset: 0,
    }).maxScroll

    expect(computePlaneColumnWindowing({
      items,
      viewportHeight: VIEWPORT_HEIGHT,
      scrollOffset: 999,
    }).appliedScrollOffset).toBe(maxScroll)

    expect(computePlaneColumnWindowing({
      items,
      viewportHeight: VIEWPORT_HEIGHT,
      scrollOffset: -40,
    }).appliedScrollOffset).toBe(0)
  })

  it('shows the last card at maxScroll with some hiddenAbove', () => {
    const items = Array.from({ length: 6 }, (_, index) => ({
      id: `c${index}`,
      height: 130,
    }))
    const maxScroll = computePlaneColumnWindowing({
      items,
      viewportHeight: VIEWPORT_HEIGHT,
      scrollOffset: 0,
    }).maxScroll

    const result = computePlaneColumnWindowing({
      items,
      viewportHeight: VIEWPORT_HEIGHT,
      scrollOffset: maxScroll,
    })

    expect(result.appliedScrollOffset).toBe(maxScroll)
    expect(result.slots.at(-1)?.visible).toBe(true)
    expect(result.hiddenAbove.every(id => {
      const slot = result.slots.find(item => item.id === id)
      return slot?.progress === 0
    })).toBe(true)
    expect(result.hiddenAbove.length).toBeGreaterThan(0)
  })

  it('bottom-aligns short stacks when fitAlignment is bottom and there is no scroll', () => {
    const result = computePlaneColumnWindowing({
      items: [
        { id: 'a', height: 100 },
        { id: 'b', height: 140 },
      ],
      viewportHeight: VIEWPORT_HEIGHT,
      scrollOffset: 0,
      bottomClearance: 88,
      fitAlignment: 'bottom',
    })

    const bandBottom = VIEWPORT_HEIGHT - 88
    expect(result.maxScroll).toBe(0)
    expect(result.slots.at(-1)!.y + result.slots.at(-1)!.height).toBe(bandBottom)
    expect(result.slots[0].y).toBeGreaterThan(PLANE_MINI_SLOT_PAD_Y)
  })

  it('stacks mixed heights with gap between consecutive cards', () => {
    const result = computePlaneColumnWindowing({
      items: [
        { id: 'a', height: 84 },
        { id: 'b', height: 210 },
        { id: 'c', height: 130 },
      ],
      viewportHeight: VIEWPORT_HEIGHT,
      scrollOffset: 0,
    })

    const [a, b, c] = result.slots
    expect(a.y).toBe(PLANE_MINI_SLOT_PAD_Y)
    expect(b.y).toBe(a.y + a.height + PLANE_MINI_SLOT_GAP)
    expect(c.y).toBe(b.y + b.height + PLANE_MINI_SLOT_GAP)
  })

  it('does not mutate frozen input items', () => {
    const items = Object.freeze([
      Object.freeze({ id: 'a', height: 120 }),
      Object.freeze({ id: 'b', height: 140 }),
    ])

    expect(() => computePlaneColumnWindowing({
      items,
      viewportHeight: VIEWPORT_HEIGHT,
      scrollOffset: 0,
    })).not.toThrow()
  })

  it('gives a card at the bottom band edge partial progress between 0 and 1', () => {
    const result = computePlaneColumnWindowing({
      items: [{ id: 'edge', height: 600 }],
      viewportHeight: VIEWPORT_HEIGHT,
      scrollOffset: 0,
      bottomClearance: 148,
    })

    const slot = result.slots[0]
    expect(slot.progress).toBeGreaterThan(0)
    expect(slot.progress).toBeLessThan(1)
    expect(result.hiddenBelow).not.toContain('edge')
    expect(result.hiddenAbove).not.toContain('edge')
  })

  it('lists a fully outside card with progress 0 in hiddenBelow', () => {
    const result = computePlaneColumnWindowing({
      items: [{ id: 'below', height: 700 }],
      viewportHeight: VIEWPORT_HEIGHT,
      scrollOffset: 0,
      bottomClearance: 148,
    })

    expect(result.slots[0].progress).toBe(0)
    expect(result.hiddenBelow).toEqual(['below'])
    expect(result.hiddenAbove).toEqual([])
  })

  it('decays progress faster with an explicit fadeZone of 40 than the default', () => {
    const items = [{ id: 'fade', height: 600 }]
    const defaultResult = computePlaneColumnWindowing({
      items,
      viewportHeight: VIEWPORT_HEIGHT,
      scrollOffset: 0,
      bottomClearance: 148,
    })
    const tightResult = computePlaneColumnWindowing({
      items,
      viewportHeight: VIEWPORT_HEIGHT,
      scrollOffset: 0,
      fadeZone: 40,
      bottomClearance: 148,
    })

    expect(defaultResult.slots[0].progress).toBeGreaterThan(tightResult.slots[0].progress)
  })
})
