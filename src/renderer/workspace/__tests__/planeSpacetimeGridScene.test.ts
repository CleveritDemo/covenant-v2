import { describe, expect, it } from 'vitest'
import {
  maxFovHalfAngleRad,
  sphereGridFovFalloff,
  sphereGridFovFalloffFromAngles,
} from '../planeSphericalGridDraw'
import {
  angularStepsForAspect,
  interiorSphereLineWarmth,
  sphereCameraLookTarget,
  sphereCameraPosition,
  sphereInteriorPoint,
  sphereRotationAxis,
  sphereYRotationSpeedRadPerSec,
  verticalFovForAspect,
} from '../planeSpacetimeGridScene'

describe('sphereInteriorPoint', () => {
  it('coloca el polo norte en +Y', () => {
    const [x, y, z] = sphereInteriorPoint(Math.PI / 2, 0, 10)
    expect(x).toBeCloseTo(0)
    expect(z).toBeCloseTo(0)
    expect(y).toBeCloseTo(10)
  })

  it('coloca el frente de la cámara en +Z', () => {
    const [x, y, z] = sphereInteriorPoint(0, 0, 10)
    expect(x).toBeCloseTo(0)
    expect(y).toBeCloseTo(0)
    expect(z).toBeCloseTo(10)
  })
})

describe('sphereCameraPosition', () => {
  it('observa desde el centro de la esfera', () => {
    expect(sphereCameraPosition()).toEqual([0, 0, 0])
  })
})

describe('sphereCameraLookTarget', () => {
  it('mira por el ecuador frontal, no hacia un polo', () => {
    const [x, y, z] = sphereCameraLookTarget()
    expect(x).toBeCloseTo(0)
    expect(y).toBeCloseTo(0)
    expect(z).toBeGreaterThan(0)
  })
})

describe('verticalFovForAspect', () => {
  it('reduce el FOV vertical en pantallas anchas', () => {
    const square = verticalFovForAspect(1)
    const wide = verticalFovForAspect(2.2)
    expect(wide).toBeLessThan(square)
  })

  it('abre 110° horizontales en formato cuadrado', () => {
    expect(verticalFovForAspect(1)).toBeCloseTo(110, 5)
  })
})

describe('angularStepsForAspect', () => {
  it('usa el mismo paso en lat y lon para que la esfera sea uniforme', () => {
    const vFov = verticalFovForAspect(1600 / 900)
    const steps = angularStepsForAspect(88, 900, vFov)
    expect(steps.stepLat).toBe(steps.stepLon)
  })

  it('deriva el paso de la focal en píxeles, no del ancho del viewport', () => {
    const vFov = 60
    const focalPx = 900 / 2 / Math.tan((vFov * Math.PI) / 360)
    const steps = angularStepsForAspect(88, 900, vFov)
    expect(steps.stepLat).toBeCloseTo(88 / focalPx, 6)
  })
})

describe('sphereYRotationSpeedRadPerSec', () => {
  it('recorre 45° en el periodo configurado', () => {
    const period = 33
    const speed = sphereYRotationSpeedRadPerSec(45, period)
    expect(speed * period).toBeCloseTo((45 * Math.PI) / 180, 5)
  })
})

describe('sphereRotationAxis', () => {
  it('gira en Y vertical para mantener polos arriba/abajo', () => {
    const [x, y, z] = sphereRotationAxis()
    expect(Math.abs(y)).toBeCloseTo(1, 5)
    expect(Math.abs(x)).toBeLessThan(0.01)
    expect(Math.abs(z)).toBeLessThan(0.01)
  })
})

describe('interiorSphereLineWarmth', () => {
  it('es simétrico izquierda/derecha a igual profundidad', () => {
    const left = interiorSphereLineWarmth(50, 0, 50)
    const right = interiorSphereLineWarmth(-50, 0, 50)
    expect(left).toBeCloseTo(right, 5)
  })

  it('calienta más hacia el frente que hacia atrás', () => {
    const front = interiorSphereLineWarmth(0, 0, 50)
    const back = interiorSphereLineWarmth(0, 0, -50)
    expect(front).toBeGreaterThan(back)
  })
})

describe('sphereGridFovFalloff', () => {
  it('vale 1 en el centro del FOV (+Z)', () => {
    expect(sphereGridFovFalloff(0, 0, 1, maxFovHalfAngleRad(110, 1))).toBe(1)
  })

  it('cae a 50% en el borde del cono visual', () => {
    const maxAngle = maxFovHalfAngleRad(110, 16 / 9)
    const edge = sphereGridFovFalloff(
      Math.sin(maxAngle),
      0,
      Math.cos(maxAngle),
      maxAngle,
    )
    expect(edge).toBeCloseTo(0.5, 5)
  })

  it('interpola desde el ecuador frontal en ángulos', () => {
    const maxAngle = maxFovHalfAngleRad(110, 1)
    const mid = sphereGridFovFalloffFromAngles(0, maxAngle * 0.5, maxAngle)
    expect(mid).toBeGreaterThan(0.5)
    expect(mid).toBeLessThan(1)
  })
})
