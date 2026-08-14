import { describe, expect, it } from 'vitest'
import {
  CONFIG_DEFAULTS,
  mergeWithDefaults,
  sanitizeTerminalLineHeight,
  validateConfig,
} from '../configSchema'

describe('terminalLineHeight', () => {
  it('defaults to 1.2 on fresh install', () => {
    expect(CONFIG_DEFAULTS.terminalLineHeight).toBe(1.2)
    expect(mergeWithDefaults({}).terminalLineHeight).toBe(1.2)
  })

  it('preserves an explicit preset through merge', () => {
    expect(mergeWithDefaults({ terminalLineHeight: 1.4 }).terminalLineHeight).toBe(1.4)
  })

  it('migrates configs without the key to default 1.2', () => {
    const { terminalLineHeight: _omit, ...legacy } = CONFIG_DEFAULTS
    expect(
      mergeWithDefaults(legacy as Partial<typeof CONFIG_DEFAULTS>).terminalLineHeight,
    ).toBe(1.2)
  })

  it('clamps garbage and out-of-range values', () => {
    expect(sanitizeTerminalLineHeight('nope')).toBe(1.2)
    expect(sanitizeTerminalLineHeight(0.5)).toBe(1)
    expect(sanitizeTerminalLineHeight(2)).toBe(1.6)
    expect(sanitizeTerminalLineHeight(1.25)).toBe(1.3)
  })

  it('validate rejects non-numbers and out of range', () => {
    const badType = {
      ...CONFIG_DEFAULTS,
      terminalLineHeight: 'tall' as unknown as number,
    }
    expect(validateConfig(badType).some(e => e.includes('terminalLineHeight'))).toBe(true)

    const tooHigh = { ...CONFIG_DEFAULTS, terminalLineHeight: 3 }
    expect(validateConfig(tooHigh).some(e => e.includes('terminalLineHeight'))).toBe(true)
  })
})
