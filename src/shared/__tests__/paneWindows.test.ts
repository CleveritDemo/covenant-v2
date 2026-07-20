import { describe, expect, it } from 'vitest'
import {
  collapseAllPaneWindows,
  computeStandardPaneWindowGeometry,
  createPaneWindowState,
  ensurePaneWindows,
  maxPaneWindowZ,
  minimizeOtherPaneWindows,
  PANE_WINDOW_VIEWPORT_RATIO,
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
