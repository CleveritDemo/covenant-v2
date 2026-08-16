import { describe, expect, it } from 'vitest'
import {
  DICTATION_BAND_SPAWN_THRESHOLD,
  DICTATION_LEVEL_SPAWN_THRESHOLD,
  hasDictationBandEnergy,
  hasDictationVoiceEnergy,
  sinkTargetForBand,
  spawnAngleForBand,
  spawnDictationVoiceParticles,
  updateDictationMicParticles,
} from '../dictationMicParticles'
import type { DictationMicParticle } from '../dictationMicParticles'

describe('dictationMicParticles', () => {
  it('does not spawn below voice threshold', () => {
    const particles: DictationMicParticle[] = []
    spawnDictationVoiceParticles(
      Array.from({ length: 12 }, () => 0),
      DICTATION_LEVEL_SPAWN_THRESHOLD * 0.5,
      { x: 100, y: 100 },
      ['#fff'],
      particles,
    )
    expect(particles).toHaveLength(0)
  })

  it('spawns from mic level when bands are empty', () => {
    const particles: DictationMicParticle[] = []
    spawnDictationVoiceParticles(
      Array.from({ length: 12 }, () => 0),
      0.25,
      { x: 200, y: 200 },
      ['#fff'],
      particles,
    )
    expect(particles.length).toBeGreaterThan(0)
    expect(typeof particles[0]!.pulsePhase).toBe('number')
  })

  it('uses distinct spawn arcs and sinks per band', () => {
    expect(spawnAngleForBand(0)).not.toBeCloseTo(spawnAngleForBand(6), 1)
    const mic = { x: 200, y: 200 }
    const bassSink = sinkTargetForBand(0, mic)
    const trebleSink = sinkTargetForBand(10, mic)
    expect(bassSink.x).not.toBeCloseTo(trebleSink.x, 0)
    expect(bassSink.y).not.toBeCloseTo(trebleSink.y, 0)
  })

  it('spawns only the hot band when one frequency dominates', () => {
    const particles: DictationMicParticle[] = []
    const bands = Array.from({ length: 12 }, () => 0)
    bands[4] = 0.7
    spawnDictationVoiceParticles(bands, 0, { x: 200, y: 200 }, ['#fff'], particles)
    expect(particles.length).toBeGreaterThan(0)
    expect(particles.every(p => p.bandIndex === 4)).toBe(true)
  })

  it('converges each band toward its own sink on the mic ring', () => {
    const particles: DictationMicParticle[] = []
    const bands = Array.from({ length: 12 }, () => 0)
    bands[8] = 0.65
    spawnDictationVoiceParticles(bands, 0, { x: 200, y: 200 }, ['#fff'], particles)
    const particle = particles[0]!
    const startDist = Math.hypot(particle.x - particle.sinkX, particle.y - particle.sinkY)
    updateDictationMicParticles(particles, { x: 200, y: 200 }, 0.08)
    const endDist = Math.hypot(particle.x - particle.sinkX, particle.y - particle.sinkY)
    expect(endDist).toBeLessThan(startDist)
  })

  it('detects live voice from level or bands', () => {
    expect(hasDictationBandEnergy(Array.from({ length: 12 }, () => 0))).toBe(false)
    expect(hasDictationVoiceEnergy(Array.from({ length: 12 }, () => 0), 0)).toBe(false)
    expect(hasDictationVoiceEnergy([], 0.05)).toBe(true)
    expect(hasDictationVoiceEnergy(
      [0, DICTATION_BAND_SPAWN_THRESHOLD, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      0,
    )).toBe(true)
  })
})
