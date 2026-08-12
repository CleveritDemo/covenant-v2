import { describe, expect, it } from 'vitest'
import { CONFIG_DEFAULTS, mergeWithDefaults, validateConfig } from '../configSchema'

describe('systemSoundsEnabled', () => {
  it('defaults to true', () => {
    expect(CONFIG_DEFAULTS.systemSoundsEnabled).toBe(true)
    expect(mergeWithDefaults({}).systemSoundsEnabled).toBe(true)
  })

  it('preserves explicit false', () => {
    expect(mergeWithDefaults({ systemSoundsEnabled: false }).systemSoundsEnabled).toBe(false)
  })

  it('migrates configs without the key to default true', () => {
    const { systemSoundsEnabled: _omit, ...legacy } = CONFIG_DEFAULTS
    expect(
      mergeWithDefaults(legacy as Partial<typeof CONFIG_DEFAULTS>).systemSoundsEnabled,
    ).toBe(true)
  })

  it('migrates soundFeedbackEnabled legacy to systemSoundsEnabled', () => {
    const { systemSoundsEnabled: _omit, ...legacy } = CONFIG_DEFAULTS
    const merged = mergeWithDefaults({
      ...legacy,
      soundFeedbackEnabled: false,
    } as Partial<typeof CONFIG_DEFAULTS>)
    expect(merged.systemSoundsEnabled).toBe(false)
    expect('soundFeedbackEnabled' in merged).toBe(false)
  })

  it('validate rejects non-boolean', () => {
    const bad = {
      ...CONFIG_DEFAULTS,
      systemSoundsEnabled: 'yes' as unknown as boolean,
    }
    expect(validateConfig(bad).some(e => e.includes('systemSoundsEnabled'))).toBe(true)
  })
})
