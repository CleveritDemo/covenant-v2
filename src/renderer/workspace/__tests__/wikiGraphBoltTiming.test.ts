import { describe, expect, it } from 'vitest'
import {
  BOLT_INITIAL_WAVE_MS,
  BOLT_JITTER_MS,
  BOLT_PHASE_SLOT_MS,
  BOLT_RANDOM_EXTRA_JITTER_MS,
  computeInitialNodeFireAt,
  computeNextNodeFireAt,
} from '../wikiGraphBoltTiming'

describe('wikiGraphBoltTiming', () => {
  it('spread inicial separa índice 0 y total-1 al menos wave/total con música', () => {
    const startMs = 1000
    const total = 5
    const zeroRandom = (): number => 0
    const first = computeInitialNodeFireAt(startMs, 0, total, zeroRandom, true)
    const last = computeInitialNodeFireAt(startMs, total - 1, total, zeroRandom, true)
    const minSpread = BOLT_INITIAL_WAVE_MS / total
    expect(last - first).toBeGreaterThanOrEqual(minSpread)
  })

  it('jitter inicial queda acotado a BOLT_JITTER_MS con música', () => {
    const startMs = 500
    const base = computeInitialNodeFireAt(startMs, 2, 4, () => 0, true)
    const withJitter = computeInitialNodeFireAt(startMs, 2, 4, () => 1, true)
    expect(withJitter - base).toBeLessThanOrEqual(BOLT_JITTER_MS)
    expect(withJitter - base).toBeGreaterThanOrEqual(0)
  })

  it('computeNextNodeFireAt aplica desfase por índice con música', () => {
    const nowMs = 20000
    const zeroRandom = (): number => 0
    const at0 = computeNextNodeFireAt(nowMs, 0, zeroRandom, true)
    const at10 = computeNextNodeFireAt(nowMs, 10, zeroRandom, true)
    expect(at10 - at0).toBe((10 % 11) * BOLT_PHASE_SLOT_MS)
    expect(at0).toBeGreaterThan(nowMs)
  })

  it('inicial sin música con random()=1 devuelve startMs + BOLT_INITIAL_WAVE_MS', () => {
    const startMs = 3000
    const result = computeInitialNodeFireAt(startMs, 7, 12, () => 1, false)
    expect(result).toBe(startMs + BOLT_INITIAL_WAVE_MS)
  })

  it('inicial sin música no separa índices con random()=0', () => {
    const startMs = 1000
    const zeroRandom = (): number => 0
    const first = computeInitialNodeFireAt(startMs, 0, 5, zeroRandom, false)
    const last = computeInitialNodeFireAt(startMs, 4, 5, zeroRandom, false)
    expect(first).toBe(startMs)
    expect(last).toBe(startMs)
  })

  it('siguiente sin música no aplica desfase por índice y acota jitter extra', () => {
    const nowMs = 20000
    const zeroRandom = (): number => 0
    const at0 = computeNextNodeFireAt(nowMs, 0, zeroRandom, false)
    const at10 = computeNextNodeFireAt(nowMs, 10, zeroRandom, false)
    expect(at10).toBe(at0)

    let call = 0
    const sequencedRandom = (): number => {
      call += 1
      return call === 1 ? 0 : 1
    }
    const withMaxJitter = computeNextNodeFireAt(nowMs, 3, sequencedRandom, false)
    expect(withMaxJitter - at0).toBeLessThanOrEqual(BOLT_RANDOM_EXTRA_JITTER_MS)
    expect(withMaxJitter - at0).toBeGreaterThanOrEqual(0)
  })
})
