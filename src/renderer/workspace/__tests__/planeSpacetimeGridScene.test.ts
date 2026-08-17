import { describe, expect, it } from 'vitest'
import {
  angularStepsForAspect,
  energizedOpacityFactor,
  energizedRotationMul,
  energizedWarmth,
  interiorSphereLineWarmth,
  sphereCameraLookTarget,
  sphereCameraPosition,
  sphereInteriorPoint,
  spherePointerLookTarget,
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

describe('spherePointerLookTarget', () => {
  it('en el centro mira +Z', () => {
    const [x, y, z] = spherePointerLookTarget(0, 0)
    expect(x).toBeCloseTo(0)
    expect(y).toBeCloseTo(0)
    expect(z).toBeCloseTo(1)
  })

  it('cursor a la derecha gira yaw hacia +X', () => {
    const [x, , z] = spherePointerLookTarget(1, 0)
    expect(x).toBeGreaterThan(0)
    expect(z).toBeGreaterThan(0)
  })

  it('cursor arriba (ndcY+) mira hacia +Y para que la vista suba', () => {
    const [, y, z] = spherePointerLookTarget(0, 1)
    expect(y).toBeGreaterThan(0)
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
  it('gira en Y vertical: cámara en el centro, solo la rejilla rota', () => {
    const [x, y, z] = sphereRotationAxis()
    expect(Math.abs(y)).toBeCloseTo(1, 5)
    expect(Math.abs(x)).toBeLessThan(0.01)
    expect(Math.abs(z)).toBeLessThan(0.01)
  })
})

describe('energía del plano', () => {
  it('sin energía deja warmth, opacidad y rotación en su base', () => {
    expect(energizedWarmth(0.42, 0)).toBeCloseTo(0.42, 6)
    expect(energizedOpacityFactor(0)).toBe(1)
    expect(energizedRotationMul(0)).toBe(1)
  })

  it('a energía plena sube warmth 80%, opacidad 18% y rotación 50%', () => {
    expect(energizedWarmth(0.42, 1)).toBeCloseTo(0.42 * 1.8, 6)
    expect(energizedOpacityFactor(1)).toBeCloseTo(1.18, 6)
    expect(energizedRotationMul(1)).toBeCloseTo(1.5, 6)
  })

  it('crece de forma monótona con la energía', () => {
    expect(energizedWarmth(0.42, 0.7)).toBeGreaterThan(energizedWarmth(0.42, 0.4))
    expect(energizedOpacityFactor(0.7)).toBeGreaterThan(energizedOpacityFactor(0.4))
    expect(energizedRotationMul(0.7)).toBeGreaterThan(energizedRotationMul(0.4))
  })

  it('clampea energías fuera de rango o inválidas', () => {
    expect(energizedWarmth(0.42, 5)).toBeCloseTo(energizedWarmth(0.42, 1), 6)
    expect(energizedWarmth(0.42, -3)).toBeCloseTo(0.42, 6)
    expect(energizedOpacityFactor(Number.NaN)).toBe(1)
    expect(energizedRotationMul(9)).toBeCloseTo(1.5, 6)
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

  it('sigue +Z mundo tras rotar la geometría en Y (como el vertex shader)', () => {
    const rotateY = (x: number, y: number, z: number, angle: number): [number, number, number] => {
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      return [x * cos + z * sin, y, -x * sin + z * cos]
    }
    const angle = Math.PI / 2
    const [wx, wy, wz] = rotateY(0, 0, 50, angle)
    const warmthAfterRotation = interiorSphereLineWarmth(wx, wy, wz)
    const warmthAtCameraCenter = interiorSphereLineWarmth(0, 0, 50)
    const [cx, cy, cz] = rotateY(-50, 0, 0, angle)
    expect(interiorSphereLineWarmth(cx, cy, cz)).toBeCloseTo(warmthAtCameraCenter, 5)
    expect(warmthAfterRotation).toBeLessThan(warmthAtCameraCenter)
  })
})
