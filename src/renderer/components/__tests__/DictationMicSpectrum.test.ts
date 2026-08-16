import { describe, expect, it } from 'vitest'
import {
  VIEW_H,
  VIEW_W,
  buildWavePath,
  smoothSpectrumBands,
} from '../DictationMicSpectrum'

describe('DictationMicSpectrum', () => {
  const bands = [0.2, 0.8, 0.5, 0.9, 0.3, 0.7, 0.4, 0.6, 0.35, 0.75, 0.45, 0.55]

  it('builds one centered stroke path edge to edge', () => {
    const line = buildWavePath(bands, 0.4)
    expect(line).not.toBeNull()
    expect(line).toMatch(/^M 0\.00/)
    expect(line).toContain(`${VIEW_W.toFixed(2)}`)
    expect(line).not.toContain(' Z')
  })

  it('keeps the wave centered around the midline', () => {
    const line = buildWavePath(bands, 0.4)
    const coords = line!.match(/-?\d+\.\d+/g)!.map(Number)
    const ys = coords.filter((_, index) => index % 2 === 1)
    const mid = VIEW_H / 2
    expect(Math.min(...ys)).toBeLessThan(mid)
    expect(Math.max(...ys)).toBeGreaterThan(mid)
  })

  it('smooths spectrum bands between frames', () => {
    const previous = bands.map(value => value * 0.2)
    const next = smoothSpectrumBands(bands, previous, 0.5)
    expect(next[1]).toBeGreaterThan(previous[1])
    expect(next[1]).toBeLessThan(bands[1])
  })

  it('reacts louder with a taller wave', () => {
    const quiet = buildWavePath(bands.map(value => value * 0.15), 0.08)
    const loud = buildWavePath(bands, 0.9)
    expect(loud).not.toBe(quiet)
  })
})
