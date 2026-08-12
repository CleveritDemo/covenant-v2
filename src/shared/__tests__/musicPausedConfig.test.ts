import { describe, expect, it } from 'vitest'
import { CONFIG_DEFAULTS, mergeWithDefaults, validateConfig } from '../configSchema'

describe('musicPaused', () => {
  it('defaults to false on fresh install', () => {
    expect(CONFIG_DEFAULTS.musicPaused).toBe(false)
    expect(mergeWithDefaults({}).musicPaused).toBe(false)
  })

  it('preserves explicit true through merge', () => {
    expect(mergeWithDefaults({ musicPaused: true }).musicPaused).toBe(true)
  })

  it('migrates configs without musicPaused to default false', () => {
    const { musicPaused: _omit, ...legacy } = CONFIG_DEFAULTS
    expect(mergeWithDefaults(legacy as Partial<typeof CONFIG_DEFAULTS>).musicPaused).toBe(false)
  })

  it('rejects non-boolean in validateConfig', () => {
    const bad = {
      ...CONFIG_DEFAULTS,
      musicPaused: 'yes' as unknown as boolean,
    }
    expect(validateConfig(bad).some(e => e.includes('musicPaused'))).toBe(true)
  })
})
