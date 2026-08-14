import { describe, expect, it } from 'vitest'
import { CONFIG_DEFAULTS, mergeWithDefaults } from '../configSchema'

describe('wikiCurator in AppConfig', () => {
  it('defaults to empty config', () => {
    expect(CONFIG_DEFAULTS.wikiCurator).toEqual({})
    expect(mergeWithDefaults({}).wikiCurator).toEqual({})
  })

  it('sanitizes wikiCurator on merge', () => {
    const merged = mergeWithDefaults({
      wikiCurator: {
        name: '  Curador  ',
        provider: 'cursor',
        model: 'auto',
        rules: ['  regla uno  ', '', 'x'.repeat(300)],
      },
    })
    expect(merged.wikiCurator).toEqual({
      name: 'Curador',
      provider: 'cursor',
      model: 'auto',
      rules: ['regla uno', 'x'.repeat(200)],
    })
  })

  it('drops invalid provider and empty fields', () => {
    const merged = mergeWithDefaults({
      wikiCurator: {
        provider: 'unknown-cli',
        name: '',
        rules: [],
      },
    })
    expect(merged.wikiCurator).toEqual({})
  })
})
