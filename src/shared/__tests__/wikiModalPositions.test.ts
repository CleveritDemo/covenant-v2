import { describe, expect, it } from 'vitest'
import {
  computeWikiModalPositionNearPoint,
  computeWikiModalSpreadPositions,
  modalOverlapsWikiDeadZone,
  wikiModalDockSide,
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

function boundsFor(padding: number) {
  const maxX = BOUNDS.width - BOUNDS.modalWidth - padding
  const deadZoneTop = BOUNDS.height - BOUNDS.height * 0.38
  const maxY = Math.max(
    padding,
    Math.min(
      BOUNDS.height - BOUNDS.modalHeight - padding,
      deadZoneTop - BOUNDS.modalHeight - padding,
    ),
  )
  return { minX: padding, minY: padding, maxX, maxY }
}

describe('computeWikiModalPositionNearPoint', () => {
  it('coloca el modal justo a la derecha del nodo en la mitad izquierda', () => {
    const originX = 200
    const padding = 8
    expect(wikiModalDockSide(originX, BOUNDS.width)).toBe('right')
    const pos = computeWikiModalPositionNearPoint({
      originX,
      originY: 200,
      ...BOUNDS,
    })
    expect(pos.x).toBe(originX + padding)
  })

  it('coloca el modal justo a la izquierda del nodo en la mitad derecha', () => {
    const originX = 760
    const padding = 8
    expect(wikiModalDockSide(originX, BOUNDS.width)).toBe('left')
    const pos = computeWikiModalPositionNearPoint({
      originX,
      originY: 200,
      ...BOUNDS,
    })
    expect(pos.x).toBe(originX - BOUNDS.modalWidth - padding)
  })

  it('centra verticalmente sobre el origen cuando hay espacio y evita la zona muerta', () => {
    const originX = 200
    const originY = 200
    const padding = 8
    const pos = computeWikiModalPositionNearPoint({
      originX,
      originY,
      ...BOUNDS,
    })
    expect(pos.y).toBe(Math.round(originY - BOUNDS.modalHeight / 2))
    expect(pos.x).toBe(originX + padding)
    expect(modalOverlapsWikiDeadZone(
      pos.x,
      pos.y,
      BOUNDS.modalWidth,
      BOUNDS.modalHeight,
      BOUNDS.width,
      BOUNDS.height,
    )).toBe(false)
    expect(pos.x).toBeGreaterThanOrEqual(padding)
    expect(pos.y).toBeGreaterThanOrEqual(padding)
    expect(pos.x + BOUNDS.modalWidth).toBeLessThanOrEqual(BOUNDS.width - padding)
    expect(pos.y + BOUNDS.modalHeight).toBeLessThanOrEqual(BOUNDS.height - padding)
  })

  it('evita la zona muerta y se mantiene en bounds con origen inferior-centro', () => {
    const originX = BOUNDS.width / 2
    const originY = BOUNDS.height - 40
    const pos = computeWikiModalPositionNearPoint({
      originX,
      originY,
      ...BOUNDS,
    })
    const padding = 8
    expect(modalOverlapsWikiDeadZone(
      pos.x,
      pos.y,
      BOUNDS.modalWidth,
      BOUNDS.modalHeight,
      BOUNDS.width,
      BOUNDS.height,
    )).toBe(false)
    expect(pos.x).toBeGreaterThanOrEqual(padding)
    expect(pos.y).toBeGreaterThanOrEqual(padding)
    expect(pos.x + BOUNDS.modalWidth).toBeLessThanOrEqual(BOUNDS.width - padding)
    expect(pos.y + BOUNDS.modalHeight).toBeLessThanOrEqual(BOUNDS.height - padding)
  })

  it('mantiene el modal en bounds y cerca del nodo cuando el origen está al borde', () => {
    const originX = 12
    const padding = 8
    const pos = computeWikiModalPositionNearPoint({
      originX,
      originY: 200,
      ...BOUNDS,
    })
    expect(pos.x).toBe(originX + padding)
    expect(pos.x).toBeGreaterThanOrEqual(padding)
    expect(pos.x + BOUNDS.modalWidth).toBeLessThanOrEqual(BOUNDS.width - padding)
    expect(pos.x).toBeLessThan(BOUNDS.width / 2)
  })
})

describe('computeWikiModalSpreadPositions', () => {
  it('count=1 con random=0.5 coloca el modal cerca del centro del rect disponible', () => {
    const padding = 8
    const { minX, minY, maxX, maxY } = boundsFor(padding)
    const [pos] = computeWikiModalSpreadPositions(
      { count: 1, ...BOUNDS, padding },
      () => 0.5,
    )
    expect(pos!.x).toBe(Math.round(minX + 0.5 * (maxX - minX)))
    expect(pos!.y).toBe(Math.round(minY + 0.5 * (maxY - minY)))
    expect(pos!.x).not.toBe(padding)
    expect(pos!.y).not.toBe(padding)
  })

  it('count=2 devuelve dos posiciones distintas con RNG determinista', () => {
    const padding = 8
    let seed = 0
    const random = () => {
      seed += 1
      return (seed * 17) % 100 / 100
    }
    const positions = computeWikiModalSpreadPositions(
      { count: 2, ...BOUNDS, padding },
      random,
    )
    expect(positions).toHaveLength(2)
    const keys = new Set(positions.map(pos => `${pos.x},${pos.y}`))
    expect(keys.size).toBe(2)
  })

  it('count=3 devuelve posiciones únicas y separadas con RNG determinista', () => {
    let seed = 0
    const random = () => {
      seed += 1
      return (seed * 23) % 97 / 97
    }
    const positions = computeWikiModalSpreadPositions({ count: 3, ...BOUNDS }, random)
    expect(positions).toHaveLength(3)
    const keys = new Set(positions.map(pos => `${pos.x},${pos.y}`))
    expect(keys.size).toBe(3)
    expect(minPairDistance(positions)).toBeGreaterThan(0)
  })

  it('ninguna posición cae en la zona muerta inferior-centro', () => {
    let seed = 0
    const random = () => {
      seed += 1
      return (seed * 31) % 89 / 89
    }
    const positions = computeWikiModalSpreadPositions({ count: 5, ...BOUNDS }, random)
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
    let seed = 0
    const random = () => {
      seed += 1
      return (seed * 13) % 79 / 79
    }
    const positions = computeWikiModalSpreadPositions({ count: 5, ...BOUNDS, padding }, random)
    for (const pos of positions) {
      expect(pos.x).toBeGreaterThanOrEqual(padding)
      expect(pos.y).toBeGreaterThanOrEqual(padding)
      expect(pos.x + BOUNDS.modalWidth).toBeLessThanOrEqual(BOUNDS.width - padding)
      expect(pos.y + BOUNDS.modalHeight).toBeLessThanOrEqual(BOUNDS.height - padding)
    }
  })
})
