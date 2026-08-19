import { describe, expect, it } from 'vitest'
import { ONBOARDING_VERSION, type OnboardingCliStatus } from '@shared/onboarding'
import { clisAllMissing, mapCliRows, type OnboardingCliRow } from '../onboardingGate'

describe('ONBOARDING_VERSION', () => {
  it('is 4 after the in-plane port', () => {
    expect(ONBOARDING_VERSION).toBe('4')
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
