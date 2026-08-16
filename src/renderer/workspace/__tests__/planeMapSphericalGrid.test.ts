import { describe, expect, it } from 'vitest'
import {
  angularStepsForAspect,
  verticalFovForAspect,
} from '../planeSpacetimeGridScene'
import {
  drawSphericalGrid,
  PLANE_GRID_CELL_SIZE_PX,
  planeGridFocalPx,
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
      cellSizePx: PLANE_GRID_CELL_SIZE_PX,
      lineColor: 'rgb(78, 73, 64)',
      lineAlpha: 0.063,
    })

    const drawn = alphas.slice(0, -1)
    expect(drawn.length).toBeGreaterThan(0)
    for (const alpha of drawn) {
      expect(alpha).toBeCloseTo(0.063, 2)
    }
  })
})

describe('plane grid density parity', () => {
  it('el paso angular 2D coincide con WebGL en varios aspectos', () => {
    const cellSize = PLANE_GRID_CELL_SIZE_PX
    for (const [width, height] of [[1920, 1080], [800, 600], [1600, 900]]) {
      const aspect = width / height
      const vFov = verticalFovForAspect(aspect)
      const step3d = angularStepsForAspect(cellSize, height, vFov).stepLat
      const step2d = cellSize / planeGridFocalPx(width, height)
      expect(step2d).toBeCloseTo(step3d, 6)
    }
  })
})
