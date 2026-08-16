import { describe, expect, it } from 'vitest'
import { dictationMicBarEnergies, dictationMicVisualBars } from '../dictationMicButton'

describe('dictationMicButton', () => {
  it('maps band peaks into six visual bars', () => {
    const bands = Array.from({ length: 12 }, () => 0)
    bands[2] = 0.6
    bands[9] = 0.4
    const energies = dictationMicBarEnergies(bands, 0)
    expect(energies.some(value => value > 0)).toBe(true)
    expect(energies[1]).toBeGreaterThan(0)
    expect(energies[4]).toBeGreaterThan(0)
  })

  it('falls back to level when bands are silent', () => {
    const energies = dictationMicBarEnergies(Array.from({ length: 12 }, () => 0), 0.3)
    expect(energies.every(value => value > 0)).toBe(true)
  })

  it('exposes seven visual bars for the in-button equalizer', () => {
    const bands = Array.from({ length: 12 }, (_, index) => (index === 5 ? 0.5 : 0))
    const visual = dictationMicVisualBars(bands, 0.2)
    expect(visual).toHaveLength(7)
    expect(visual.some(value => value > 0.3)).toBe(true)
  })
})
