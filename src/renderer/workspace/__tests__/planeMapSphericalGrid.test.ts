import { describe, expect, it } from 'vitest'
import {
  angularStepsForAspect,
  verticalFovForAspect,
} from '../planeSpacetimeGridScene'
import {
  PLANE_GRID_CELL_SIZE_PX,
  drawSphericalGrid,
  planeGridFocalPx,
  planeGridPointerLerpAlpha,
  planeGridRadialOpacityFactor,
  projectSphereGridPoint,
  sphereGridLatitudeMax,
  spherePointerLookTarget,
} from '../planeSphericalGridDraw'

describe('projectSphereGridPoint', () => {
  it('centra el polo frontal con look +Z', () => {
    const point = projectSphereGridPoint(0, 0, 800, 600, [0, 0, 1])
    expect(point).toEqual({ x: 400, y: 300 })
  })

  it('oculta puntos detrás del observador', () => {
    expect(projectSphereGridPoint(0, Math.PI, 800, 600, [0, 0, 1])).toBeNull()
  })
})

describe('spherePointerLookTarget', () => {
  it('en el centro mira +Z', () => {
    const [x, y, z] = spherePointerLookTarget(0, 0)
    expect(x).toBeCloseTo(0)
    expect(y).toBeCloseTo(0)
    expect(z).toBeCloseTo(1)
  })

  it('cursor arriba (ndcY+) mira hacia +Y', () => {
    const [, y, z] = spherePointerLookTarget(0, 1)
    expect(y).toBeGreaterThan(0)
    expect(z).toBeGreaterThan(0)
  })
})

describe('planeGridPointerLerpAlpha', () => {
  it('dt 0 o tau inválido → 0', () => {
    expect(planeGridPointerLerpAlpha(0, 0.5)).toBe(0)
    expect(planeGridPointerLerpAlpha(0.016, 0)).toBe(0)
  })

  it('tau alto da alfa bajo (más inercia)', () => {
    const slow = planeGridPointerLerpAlpha(1 / 60, 0.55)
    const fast = planeGridPointerLerpAlpha(1 / 60, 0.1)
    expect(slow).toBeLessThan(fast)
    expect(slow).toBeGreaterThan(0)
    expect(slow).toBeLessThan(0.1)
  })
})

describe('planeGridRadialOpacityFactor', () => {
  it('centro = 50%, esquina = 100%', () => {
    expect(planeGridRadialOpacityFactor(400, 300, 800, 600)).toBe(0.5)
    expect(planeGridRadialOpacityFactor(800, 600, 800, 600)).toBe(1)
    expect(planeGridRadialOpacityFactor(0, 0, 800, 600)).toBe(1)
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
})

describe('plane grid density parity', () => {
  it('el paso angular coincide con la focal del viewport en varios aspectos', () => {
    const cellSize = PLANE_GRID_CELL_SIZE_PX
    for (const [width, height] of [[1920, 1080], [800, 600], [1600, 900]]) {
      const aspect = width / height
      const vFov = verticalFovForAspect(aspect)
      const step3d = angularStepsForAspect(cellSize, height, vFov).stepLat
      const stepFromFocal = cellSize / planeGridFocalPx(width, height)
      expect(stepFromFocal).toBeCloseTo(step3d, 6)
    }
  })
})

describe('sphereGridLatitudeMax', () => {
  it('recorta antes del polo para vista interior desde el centro', () => {
    expect(sphereGridLatitudeMax()).toBeLessThan(Math.PI / 2)
  })
})
