import { describe, expect, it } from 'vitest'
import {
  PLANE_ENERGY_ATTACK,
  PLANE_ENERGY_RELEASE,
  planeEnergyTargetForBusyCount,
  stepPlaneEnergy,
} from '../planeEnergyEnvelope'

const FRAME = 1 / 60

function stepsToReach(
  from: number,
  target: number,
  predicate: (value: number) => boolean,
  maxSteps = 10000,
): number {
  let value = from
  for (let i = 1; i <= maxSteps; i += 1) {
    value = stepPlaneEnergy(value, target, FRAME)
    if (predicate(value)) return i
  }
  return Number.POSITIVE_INFINITY
}

describe('planeEnergyTargetForBusyCount', () => {
  it('escala con el conteo y satura en tres agentes', () => {
    expect(planeEnergyTargetForBusyCount(0)).toBe(0)
    expect(planeEnergyTargetForBusyCount(1)).toBe(0.4)
    expect(planeEnergyTargetForBusyCount(2)).toBe(0.7)
    expect(planeEnergyTargetForBusyCount(3)).toBe(1)
    expect(planeEnergyTargetForBusyCount(7)).toBe(1)
  })

  it('trata conteos inválidos o negativos como reposo', () => {
    expect(planeEnergyTargetForBusyCount(-1)).toBe(0)
    expect(planeEnergyTargetForBusyCount(-2)).toBe(0)
    expect(planeEnergyTargetForBusyCount(Number.NaN)).toBe(0)
  })
})

describe('stepPlaneEnergy', () => {
  it('el ataque llega arriba de 0.9 en menos de 2.5s a 60fps', () => {
    const steps = stepsToReach(0, 1, value => value > 0.9)
    expect(steps).toBeLessThan(2.5 * 60)
    expect(steps).toBeGreaterThan(1)
  })

  it('el release tarda más que el ataque en el mismo recorrido', () => {
    const attackSteps = stepsToReach(0, 1, value => value > 0.9)
    const releaseSteps = stepsToReach(1, 0, value => value < 0.1)
    expect(releaseSteps).toBeGreaterThan(attackSteps)
    expect(PLANE_ENERGY_RELEASE).toBeLessThan(PLANE_ENERGY_ATTACK)
  })

  it('avanza hacia el objetivo sin pasarse', () => {
    const up = stepPlaneEnergy(0.2, 0.7, FRAME)
    expect(up).toBeGreaterThan(0.2)
    expect(up).toBeLessThan(0.7)

    const down = stepPlaneEnergy(0.7, 0.2, FRAME)
    expect(down).toBeLessThan(0.7)
    expect(down).toBeGreaterThan(0.2)
  })

  it('es independiente del framerate: un dt largo avanza más que uno corto', () => {
    const short = stepPlaneEnergy(0, 1, FRAME)
    const long = stepPlaneEnergy(0, 1, FRAME * 4)
    expect(long).toBeGreaterThan(short)
    expect(long).toBeLessThanOrEqual(1)
  })

  it('clampea entradas fuera de rango y devuelve siempre 0..1', () => {
    expect(stepPlaneEnergy(-3, 1, FRAME)).toBeGreaterThanOrEqual(0)
    expect(stepPlaneEnergy(5, 1, FRAME)).toBeLessThanOrEqual(1)
    expect(stepPlaneEnergy(0.5, 9, FRAME)).toBeLessThanOrEqual(1)
    expect(stepPlaneEnergy(0.5, -9, FRAME)).toBeGreaterThanOrEqual(0)
    expect(stepPlaneEnergy(Number.NaN, 1, FRAME)).toBe(
      stepPlaneEnergy(0, 1, FRAME),
    )
  })

  it('sin tiempo transcurrido no se mueve', () => {
    expect(stepPlaneEnergy(0.3, 1, 0)).toBeCloseTo(0.3, 10)
    expect(stepPlaneEnergy(0.3, 1, -1)).toBeCloseTo(0.3, 10)
    expect(stepPlaneEnergy(0.3, 1, Number.NaN)).toBeCloseTo(0.3, 10)
  })
})
