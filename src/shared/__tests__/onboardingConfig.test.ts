import { describe, expect, it } from 'vitest'
import { CONFIG_DEFAULTS, mergeWithDefaults, validateConfig } from '../configSchema'

describe('onboardingCompletedVersion', () => {
  it('default es string vacío', () => {
    expect(CONFIG_DEFAULTS.onboardingCompletedVersion).toBe('')
    expect(mergeWithDefaults({}).onboardingCompletedVersion).toBe('')
  })

  it('preserva un valor válido', () => {
    expect(mergeWithDefaults({ onboardingCompletedVersion: '1' }).onboardingCompletedVersion).toBe('1')
  })

  it('no-string y string de 40 chars → vacío', () => {
    expect(mergeWithDefaults({ onboardingCompletedVersion: 1 as never }).onboardingCompletedVersion)
      .toBe('')
    expect(
      mergeWithDefaults({ onboardingCompletedVersion: 'x'.repeat(40) }).onboardingCompletedVersion,
    ).toBe('')
  })

  it('validateConfig acepta el default y un valor corto', () => {
    expect(validateConfig(mergeWithDefaults({}))).toEqual([])
    expect(validateConfig(mergeWithDefaults({ onboardingCompletedVersion: '1' }))).toEqual([])
  })
})
