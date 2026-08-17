/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import { computePaneMiniMorphTransform } from '../PaneWindow'
import {
  PLANE_MINI_TERMINAL_HEIGHT,
  PLANE_MINI_WINDOW_WIDTH,
} from '@shared/paneWindows'

function parseMorphTransform(transform: string): {
  dx: number
  dy: number
  sx: number
  sy: number
} {
  const match = transform.match(
    /translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([-\d.]+),\s*([-\d.]+)\)/,
  )
  if (!match) throw new Error(`unexpected transform: ${transform}`)
  return {
    dx: Number(match[1]),
    dy: Number(match[2]),
    sx: Number(match[3]),
    sy: Number(match[4]),
  }
}

describe('computePaneMiniMorphTransform', () => {
  it('maps full geometry exactly onto the mini slot (no cover overshoot)', () => {
    const geo = { x: 120, y: 80, width: 896, height: 560 }
    const mini = {
      x: 74,
      y: 72,
      w: PLANE_MINI_WINDOW_WIDTH,
      h: PLANE_MINI_TERMINAL_HEIGHT,
    }
    const { dx, dy, sx, sy } = parseMorphTransform(
      computePaneMiniMorphTransform(
        { x: mini.x, y: mini.y, w: mini.w, h: mini.h },
        geo,
      ),
    )
    expect(dx).toBe(mini.x - geo.x)
    expect(dy).toBe(mini.y - geo.y)
    expect(geo.width * sx).toBe(mini.w)
    expect(geo.height * sy).toBe(mini.h)
    // Cover uniforme (viejo) dejaba el alto ~125px en esta geometría.
    expect(geo.height * Math.max(sx, sy)).toBeGreaterThan(mini.h)
  })
})
