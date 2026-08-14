import { describe, expect, it } from 'vitest'
import {
  computeWikiModalSpreadPositions,
  modalOverlapsWikiDeadZone,
} from '../wikiModalPositions'

const BOUNDS = { width: 960, height: 640, modalWidth: 400, modalHeight: 280 }

function minPairDistance(positions: Array<{ x: number; y: number }>): number {
  let min = Number.POSITIVE_INFINITY
  for (let i = 0; i < positions.length; i += 1) {
    for (let j = i + 1; j < positions.length; j += 1) {
      const dx = positions[i]!.x - positions[j]!.x
      const dy = positions[i]!.y - positions[j]!.y
      min = Math.min(min, Math.hypot(dx, dy))
    }
  }
  return min
}

describe('computeWikiModalSpreadPositions', () => {
  it('count=1 coloca el modal arriba-izquierda dentro del padding', () => {
    const padding = 8
    const [pos] = computeWikiModalSpreadPositions({ count: 1, ...BOUNDS, padding })
    expect(pos!.x).toBe(padding)
    expect(pos!.y).toBe(padding)
  })

  it('count=2 separa modales en esquinas superiores', () => {
    const padding = 8
    const positions = computeWikiModalSpreadPositions({ count: 2, ...BOUNDS, padding })
    expect(positions).toHaveLength(2)
    const maxX = BOUNDS.width - BOUNDS.modalWidth - padding
    expect(positions[0]).toEqual({ x: padding, y: padding })
    expect(positions[1]).toEqual({ x: maxX, y: padding })
    expect(minPairDistance(positions)).toBeGreaterThan(400)
  })

  it('count=3 usa triángulo perimetral más separado que la espiral centrada', () => {
    const positions = computeWikiModalSpreadPositions({ count: 3, ...BOUNDS })
    expect(positions).toHaveLength(3)
    const keys = new Set(positions.map(pos => `${pos.x},${pos.y}`))
    expect(keys.size).toBe(3)
    const xs = positions.map(pos => pos.x)
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(400)
    expect(minPairDistance(positions)).toBeGreaterThan(90)
  })

  it('ninguna posición cae en la zona muerta inferior-centro', () => {
    const positions = computeWikiModalSpreadPositions({ count: 5, ...BOUNDS })
    for (const pos of positions) {
      expect(modalOverlapsWikiDeadZone(
        pos.x,
        pos.y,
        BOUNDS.modalWidth,
        BOUNDS.modalHeight,
        BOUNDS.width,
        BOUNDS.height,
      )).toBe(false)
    }
  })

  it('todas las posiciones quedan dentro del bounds con padding', () => {
    const padding = 8
    const positions = computeWikiModalSpreadPositions({ count: 5, ...BOUNDS, padding })
    for (const pos of positions) {
      expect(pos.x).toBeGreaterThanOrEqual(padding)
      expect(pos.y).toBeGreaterThanOrEqual(padding)
      expect(pos.x + BOUNDS.modalWidth).toBeLessThanOrEqual(BOUNDS.width - padding)
      expect(pos.y + BOUNDS.modalHeight).toBeLessThanOrEqual(BOUNDS.height - padding)
    }
  })
})
