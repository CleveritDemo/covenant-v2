import { describe, expect, it } from 'vitest'
import { ONBOARDING_VERSION, type OnboardingCliStatus } from '@shared/onboarding'
import { clisAllMissing, mapCliRows, shouldOpenOnboarding } from '../onboardingGate'
import type { OnboardingCliRow } from '../components/onboarding/onboardingTypes'

describe('shouldOpenOnboarding', () => {
  it('opens when completed version is empty and ready', () => {
    expect(shouldOpenOnboarding('', true)).toBe(true)
  })

  it('does not open when completed version matches ONBOARDING_VERSION', () => {
    expect(shouldOpenOnboarding(ONBOARDING_VERSION, true)).toBe(false)
    expect(shouldOpenOnboarding('3', true)).toBe(false)
  })

  it('never opens when not ready', () => {
    expect(shouldOpenOnboarding('', false)).toBe(false)
    expect(shouldOpenOnboarding('3', false)).toBe(false)
  })

  it('trims completed version before comparing', () => {
    expect(shouldOpenOnboarding(' 3 ', true)).toBe(false)
    expect(shouldOpenOnboarding('  ', true)).toBe(true)
  })

  it('opens again when completed version is older than ONBOARDING_VERSION', () => {
    expect(shouldOpenOnboarding('1', true)).toBe(true)
    expect(shouldOpenOnboarding('2', true)).toBe(true)
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

describe('clisAllMissing', () => {
  it('returns false for an empty list', () => {
    expect(clisAllMissing([])).toBe(false)
  })

  it('returns true when every row is not installed', () => {
    const rows: OnboardingCliRow[] = [
      { provider: 'cursor', label: 'Cursor', command: 'agent', installed: false, version: null },
      { provider: 'claude', label: 'Claude', command: 'claude', installed: false, version: null },
    ]
    expect(clisAllMissing(rows)).toBe(true)
  })

  it('returns false when at least one row is installed', () => {
    const rows: OnboardingCliRow[] = [
      { provider: 'cursor', label: 'Cursor', command: 'agent', installed: true, version: '1.0.0' },
      { provider: 'claude', label: 'Claude', command: 'claude', installed: false, version: null },
    ]
    expect(clisAllMissing(rows)).toBe(false)
  })
})
