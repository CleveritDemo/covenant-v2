/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import {
  clampPlaneColumnScroll,
  collapseAllPaneWindows,
  computePlaneChatColumnWidth,
  computePlaneMiniSlotCell,
  computePlaneMiniSlotPadX,
  computePlaneAgentContextIconsPerRow,
  computeStandardPaneWindowGeometry,
  createPaneWindowState,
  ensurePaneWindows,
  estimatePlaneAgentMiniHeight,
  maxPaneWindowZ,
  minimizeOtherPaneWindows,
  PANE_WINDOW_VIEWPORT_RATIO,
  PLANE_CHAT_BASE_WIDTH,
  PLANE_CHAT_MAX_WIDTH,
  PLANE_MINI_BOTTOM_CLEARANCE,
  PLANE_MINI_MAX_WIDTH,
  PLANE_MINI_SLOT_PAD_X,
  PLANE_MINI_SLOT_PAD_X_MAX,
  PLANE_MINI_WINDOW_HEIGHT,
  PLANE_MINI_WINDOW_WIDTH,
  readPlaneMiniAgentLayoutHeight,
  sanitizePaneWindowState,
} from '../paneWindows'

describe('paneWindows', () => {
  it('creates window state with bumping zIndex (no geometry)', () => {
    const first = createPaneWindowState(undefined, true)
    const second = createPaneWindowState({ a: first }, true)
    expect(first).toEqual({ open: true, fullscreen: false, zIndex: 1 })
    expect(second.zIndex).toBe(first.zIndex + 1)
    expect(maxPaneWindowZ({ a: first, b: second })).toBe(second.zIndex)
    expect(second).not.toHaveProperty('x')
    expect(second).not.toHaveProperty('width')
  })

  it('computes ~70% geometry slightly above vertical center', () => {
    const box = computeStandardPaneWindowGeometry({ width: 1000, height: 800 })
    expect(box.width).toBe(Math.round(1000 * PANE_WINDOW_VIEWPORT_RATIO))
    expect(box.height).toBe(Math.round(800 * PANE_WINDOW_VIEWPORT_RATIO))
    expect(box.x).toBe(Math.round((1000 - box.width) / 2))
    const centeredY = Math.round((800 - box.height) / 2)
    expect(box.y).toBe(Math.max(16, centeredY - Math.round(800 * 0.04)))
    expect(box.y).toBeLessThan(centeredY)
    const again = computeStandardPaneWindowGeometry({ width: 1000, height: 800 })
    expect(again).toEqual(box)
  })

  it('scales mini slot cell with large viewports and keeps base on reference', () => {
    const base = computePlaneMiniSlotCell({ width: 1280, height: 800 }, 1)
    expect(base).toEqual({
      width: PLANE_MINI_WINDOW_WIDTH,
      height: PLANE_MINI_WINDOW_HEIGHT,
    })
    const wide = computePlaneMiniSlotCell({ width: 2560, height: 1440 }, 1)
    expect(wide.width).toBe(PLANE_MINI_MAX_WIDTH)
    expect(wide.height).toBeGreaterThan(PLANE_MINI_WINDOW_HEIGHT)
    expect(wide.width).toBeGreaterThan(base.width)
  })

  it('keeps mini slot at least base height when column is crowded', () => {
    const crowded = computePlaneMiniSlotCell({ width: 1920, height: 900 }, 12)
    expect(crowded.height).toBe(PLANE_MINI_WINDOW_HEIGHT)
    expect(crowded.width).toBeGreaterThanOrEqual(PLANE_MINI_WINDOW_WIDTH)
  })

  it('scales chat column width with viewport without invading side minis', () => {
    const base = computePlaneChatColumnWidth({ width: 1280, height: 800 }, 1)
    expect(base).toBe(PLANE_CHAT_BASE_WIDTH)
    const wide = computePlaneChatColumnWidth({ width: 2560, height: 1440 }, 1)
    expect(wide).toBe(PLANE_CHAT_MAX_WIDTH)
    expect(wide).toBeGreaterThan(base)
  })

  it('anchors mini columns between edge and chat on reference viewport', () => {
    const base = computePlaneMiniSlotPadX({ width: 1280, height: 800 }, 1)
    expect(base).toBe(72)
    const wide = computePlaneMiniSlotPadX({ width: 2560, height: 1440 }, 1)
    expect(wide).toBeGreaterThan(base)
    expect(wide).toBeLessThanOrEqual(PLANE_MINI_SLOT_PAD_X_MAX)
  })

  it('sanitize keeps open/fullscreen/zIndex and drops legacy geometry', () => {
    const win = sanitizePaneWindowState({
      open: true,
      fullscreen: true,
      x: 12,
      y: 24,
      width: 500,
      height: 400,
      zIndex: 9,
    }, 1)
    expect(win).toEqual({
      open: true,
      fullscreen: true,
      zIndex: 9,
    })
    expect(sanitizePaneWindowState({ fullscreen: true, zIndex: 2 }, 1)).toEqual({
      open: false,
      fullscreen: true,
      zIndex: 2,
    })
  })

  it('ensurePaneWindows migrates missing entries and strips geometry', () => {
    expect(ensurePaneWindows([], undefined)).toBeUndefined()
    const migrated = ensurePaneWindows(['p1', 'p2'], {
      p1: {
        open: false,
        fullscreen: true,
        zIndex: 2,
        // @ts-expect-error legacy fields from old sessions
        x: 10,
        y: 20,
        width: 400,
        height: 300,
      },
    })
    expect(migrated?.p1).toEqual({ open: false, fullscreen: true, zIndex: 2 })
    expect(migrated?.p2).toEqual({ open: false, fullscreen: false, zIndex: 2 })
  })

  it('collapseAllPaneWindows forces mini state', () => {
    expect(collapseAllPaneWindows({
      a: { open: true, fullscreen: true, zIndex: 3 },
      b: { open: false, fullscreen: false, zIndex: 1 },
    })).toEqual({
      a: { open: false, fullscreen: false, zIndex: 3 },
      b: { open: false, fullscreen: false, zIndex: 1 },
    })
  })

  it('clampPlaneColumnScroll is 0 when content plus clearance fits', () => {
    const viewportHeight = 800
    const fitting = viewportHeight - PLANE_MINI_BOTTOM_CLEARANCE
    expect(clampPlaneColumnScroll(fitting, viewportHeight)).toBe(0)
    expect(clampPlaneColumnScroll(fitting - 100, viewportHeight)).toBe(0)
    expect(clampPlaneColumnScroll(0, viewportHeight)).toBe(0)
  })

  it('clampPlaneColumnScroll returns exact overflow, never negative', () => {
    const viewportHeight = 800
    const contentHeight = 900
    expect(clampPlaneColumnScroll(contentHeight, viewportHeight)).toBe(
      contentHeight + PLANE_MINI_BOTTOM_CLEARANCE - viewportHeight,
    )
    expect(clampPlaneColumnScroll(37, 10_000)).toBe(0)
  })

  it('computes context icons per row from mini cell width', () => {
    expect(computePlaneAgentContextIconsPerRow(PLANE_MINI_WINDOW_WIDTH)).toBe(6)
    expect(computePlaneAgentContextIconsPerRow(128)).toBe(3)
    expect(computePlaneAgentContextIconsPerRow(40)).toBe(1)
  })

  it('estimates mini agent height from CSS chrome, not AABB', () => {
    expect(estimatePlaneAgentMiniHeight(0)).toBe(84)
    expect(estimatePlaneAgentMiniHeight(1)).toBe(89)
    expect(estimatePlaneAgentMiniHeight(3)).toBe(89)
    expect(estimatePlaneAgentMiniHeight(6)).toBe(89)
    expect(estimatePlaneAgentMiniHeight(6, 128)).toBe(2 + 8 + 22 + 6 + 17 + 8 + 40 + 8)
  })

  it('readPlaneMiniAgentLayoutHeight uses offsetHeight, not getBoundingClientRect', () => {
    const el = document.createElement('div')
    el.style.boxSizing = 'content-box'
    el.style.height = '120px'
    el.style.border = '1px solid'
    document.body.appendChild(el)
    Object.defineProperty(el, 'offsetHeight', { configurable: true, value: 122 })
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({
        height: 999,
        width: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    })
    expect(readPlaneMiniAgentLayoutHeight(el)).toBe(el.offsetHeight)
    expect(readPlaneMiniAgentLayoutHeight(el)).toBe(122)
    el.remove()
  })

  it('minimizes every other open window', () => {
    const windows = {
      a: { open: true, fullscreen: false, zIndex: 1 },
      b: { open: true, fullscreen: true, zIndex: 2 },
      c: { open: false, fullscreen: false, zIndex: 3 },
    }
    minimizeOtherPaneWindows(['a', 'b', 'c'], windows, 'a')
    expect(windows.a.open).toBe(true)
    expect(windows.b).toEqual({ open: false, fullscreen: false, zIndex: 2 })
    expect(windows.c.open).toBe(false)
  })
})
