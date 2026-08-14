import { describe, expect, it } from 'vitest'
import { ONBOARDING_VERSION, type OnboardingCliStatus } from '@shared/onboarding'
import { mapCliRows, shouldOpenOnboarding } from '../onboardingGate'

describe('shouldOpenOnboarding', () => {
  it('opens when completed version is empty and ready', () => {
    expect(shouldOpenOnboarding('', true)).toBe(true)
  })

  it('does not open when completed version matches ONBOARDING_VERSION', () => {
    expect(shouldOpenOnboarding(ONBOARDING_VERSION, true)).toBe(false)
    expect(shouldOpenOnboarding('1', true)).toBe(false)
  })

  it('never opens when not ready', () => {
    expect(shouldOpenOnboarding('', false)).toBe(false)
    expect(shouldOpenOnboarding('1', false)).toBe(false)
  })

  it('trims completed version before comparing', () => {
    expect(shouldOpenOnboarding(' 1 ', true)).toBe(false)
    expect(shouldOpenOnboarding('  ', true)).toBe(true)
  })
})

describe('mapCliRows', () => {
  it('preserves order and null version', () => {
    const statuses: OnboardingCliStatus[] = [
      {
        provider: 'cursor',
        label: 'Cursor',
        command: 'agent',
        installed: true,
        version: '1.0.0',
      },
      {
        provider: 'claude',
        label: 'Claude',
        command: 'claude',
        installed: false,
        version: null,
      },
    ]
    expect(mapCliRows(statuses)).toEqual([
      {
        provider: 'cursor',
        label: 'Cursor',
        command: 'agent',
        installed: true,
        version: '1.0.0',
      },
      {
        provider: 'claude',
        label: 'Claude',
        command: 'claude',
        installed: false,
        version: null,
      },
    ])
  })
})
