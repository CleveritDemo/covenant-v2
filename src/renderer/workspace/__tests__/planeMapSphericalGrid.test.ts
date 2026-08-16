import { describe, expect, it } from 'vitest'
import {
  drawSphericalGrid,
  PLANE_GRID_FOV_FALLOFF_MIN,
  projectSphereGridPoint,
} from '../planeSphericalGridDraw'

describe('projectSphereGridPoint', () => {
  it('centra el polo frontal', () => {
    const point = projectSphereGridPoint(0, 0, 800, 600, 1.72)
    expect(point).toEqual({ x: 400, y: 300 })
  })

  it('curva hacia los bordes', () => {
    const center = projectSphereGridPoint(0, 0, 800, 600, 1.72)!
    const edge = projectSphereGridPoint(0, 0.8, 800, 600, 1.72)!
    expect(edge.x).toBeGreaterThan(center.x)
  })

  it('oculta puntos detrás del observador', () => {
    expect(projectSphereGridPoint(0, Math.PI, 800, 600, 1.72)).toBeNull()
  })
})

describe('drawSphericalGrid', () => {
  it('dibuja paralelos y meridianos', () => {
    let strokeCount = 0
    const ctx = {
      clearRect: () => undefined,
      beginPath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      stroke: () => { strokeCount += 1 },
      set strokeStyle(_: string) { /* noop */ },
      set globalAlpha(_: number) { /* noop */ },
      set lineWidth(_: number) { /* noop */ },
      set lineJoin(_: string) { /* noop */ },
      set lineCap(_: string) { /* noop */ },
    } as unknown as CanvasRenderingContext2D

    drawSphericalGrid(ctx, 640, 480, {
      cellSizePx: 44,
      lineColor: '#334455',
    })

    expect(strokeCount).toBeGreaterThan(30)
  })

  it('aplica la opacidad compuesta en el canvas, no en el contenedor', () => {
    const alphas: number[] = []
    const ctx = {
      clearRect: () => undefined,
      beginPath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      stroke: () => undefined,
      set strokeStyle(_: string) { /* noop */ },
      set globalAlpha(value: number) { alphas.push(value) },
      set lineWidth(_: number) { /* noop */ },
      set lineJoin(_: string) { /* noop */ },
      set lineCap(_: string) { /* noop */ },
    } as unknown as CanvasRenderingContext2D

    drawSphericalGrid(ctx, 640, 480, {
      cellSizePx: 68,
      lineColor: 'rgb(78, 73, 64)',
      lineAlpha: 0.063,
    })

    expect(alphas[0]).toBeCloseTo(0.063 * PLANE_GRID_FOV_FALLOFF_MIN, 5)
  })
})
