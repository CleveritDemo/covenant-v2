import { describe, expect, it } from 'vitest'
import { computeWikiModalSpreadPositions } from '../wikiModalPositions'

const BOUNDS = { width: 960, height: 640, modalWidth: 400, modalHeight: 280 }

describe('computeWikiModalSpreadPositions', () => {
  it('count=1 devuelve posición cercana al centro', () => {
    const [pos] = computeWikiModalSpreadPositions({ count: 1, ...BOUNDS })
    const centerX = (BOUNDS.width - BOUNDS.modalWidth) / 2
    const centerY = (BOUNDS.height - BOUNDS.modalHeight) / 2
    expect(Math.abs(pos!.x - centerX)).toBeLessThanOrEqual(2)
    expect(Math.abs(pos!.y - centerY)).toBeLessThanOrEqual(2)
  })

  it('count=3 devuelve tres posiciones distintas', () => {
    const positions = computeWikiModalSpreadPositions({ count: 3, ...BOUNDS })
    expect(positions).toHaveLength(3)
    const keys = new Set(positions.map(pos => `${pos.x},${pos.y}`))
    expect(keys.size).toBe(3)
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
