import { describe, expect, it } from 'vitest'
import { CONFIG_DEFAULTS, mergeWithDefaults, validateConfig } from '../configSchema'

describe('autoUpdatesEnabled', () => {
  it('defaults to true on fresh install', () => {
    expect(CONFIG_DEFAULTS.autoUpdatesEnabled).toBe(true)
    expect(mergeWithDefaults({}).autoUpdatesEnabled).toBe(true)
  })

  it('preserves explicit false through merge', () => {
    expect(mergeWithDefaults({ autoUpdatesEnabled: false }).autoUpdatesEnabled).toBe(false)
  })

  it('rejects non-boolean in validateConfig', () => {
    const bad = {
      ...CONFIG_DEFAULTS,
      autoUpdatesEnabled: 'yes' as unknown as boolean,
    }
    expect(validateConfig(bad).some(e => e.includes('autoUpdatesEnabled'))).toBe(true)
  })
})
