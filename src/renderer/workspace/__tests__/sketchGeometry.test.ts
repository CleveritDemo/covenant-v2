import { describe, expect, it } from 'vitest'
import { arrowHeadPoints, boxFromDrag, ellipseFromDrag } from '../sketchGeometry'

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay)
}

describe('arrowHeadPoints', () => {
  const quadrants: Array<[string, number, number]> = [
    ['derecha-abajo', 120, 80],
    ['izquierda-abajo', -120, 80],
    ['izquierda-arriba', -120, -80],
    ['derecha-arriba', 120, -80],
  ]

  it.each(quadrants)('apunta al destino en %s', (_name, dx, dy) => {
    const fromX = 200
    const fromY = 200
    const toX = fromX + dx
    const toY = fromY + dy
    const stroke = 3
    const [left, right] = arrowHeadPoints(fromX, fromY, toX, toY, stroke)
    const expected = 9 + stroke * 2

    // Ambos extremos cuelgan del destino a la distancia del largo de punta.
    expect(distance(toX, toY, left.x, left.y)).toBeCloseTo(expected, 6)
    expect(distance(toX, toY, right.x, right.y)).toBeCloseTo(expected, 6)

    // Y quedan por detrás: más cerca del origen que el propio destino.
    expect(distance(fromX, fromY, left.x, left.y)).toBeLessThan(distance(fromX, fromY, toX, toY))
    expect(distance(fromX, fromY, right.x, right.y)).toBeLessThan(distance(fromX, fromY, toX, toY))

    // Y son distintos entre sí (la punta abre, no colapsa en una línea).
    expect(distance(left.x, left.y, right.x, right.y)).toBeGreaterThan(1)
  })

  it('crece la punta con el trazo', () => {
    const thin = arrowHeadPoints(0, 0, 100, 0, 2)
    const thick = arrowHeadPoints(0, 0, 100, 0, 6)
    expect(distance(100, 0, thick[0].x, thick[0].y))
      .toBeGreaterThan(distance(100, 0, thin[0].x, thin[0].y))
  })
})

describe('boxFromDrag', () => {
  it('normaliza un arrastre hacia arriba-izquierda', () => {
    expect(boxFromDrag(300, 250, 100, 50)).toEqual({ x: 100, y: 50, width: 200, height: 200 })
  })

  it('coincide con el arrastre hacia abajo-derecha', () => {
    expect(boxFromDrag(100, 50, 300, 250)).toEqual({ x: 100, y: 50, width: 200, height: 200 })
  })

  it('un clic sin arrastre da una caja vacía, no negativa', () => {
    expect(boxFromDrag(42, 42, 42, 42)).toEqual({ x: 42, y: 42, width: 0, height: 0 })
  })
})

describe('ellipseFromDrag', () => {
  it('queda inscrita en la caja del arrastre, en cualquier dirección', () => {
    const box = boxFromDrag(300, 250, 100, 50)
    const ellipse = ellipseFromDrag(300, 250, 100, 50)
    expect(ellipse).toEqual({ cx: 200, cy: 150, rx: 100, ry: 100 })
    expect(ellipse.cx - ellipse.rx).toBeCloseTo(box.x, 6)
    expect(ellipse.cy - ellipse.ry).toBeCloseTo(box.y, 6)
    expect(ellipse.rx * 2).toBeCloseTo(box.width, 6)
    expect(ellipse.ry * 2).toBeCloseTo(box.height, 6)
  })
})
