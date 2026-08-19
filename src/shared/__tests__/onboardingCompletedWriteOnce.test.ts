import { describe, expect, it } from 'vitest'
import { shouldPersistOnboardingCompleted } from '../onboardingFlow'

const NEXT = '0.98.7'

describe('shouldPersistOnboardingCompleted', () => {
  it('returns true when current is undefined', () => {
    expect(shouldPersistOnboardingCompleted(undefined, NEXT)).toBe(true)
  })

  it('returns true when current is null', () => {
    expect(shouldPersistOnboardingCompleted(null, NEXT)).toBe(true)
  })

  it('returns true when current is empty string', () => {
    expect(shouldPersistOnboardingCompleted('', NEXT)).toBe(true)
  })

  it('returns false when current equals next', () => {
    expect(shouldPersistOnboardingCompleted(NEXT, NEXT)).toBe(false)
  })

  it('returns false when current equals next with surrounding spaces', () => {
    expect(shouldPersistOnboardingCompleted(`  ${NEXT}  `, NEXT)).toBe(false)
  })

  it('returns true when current differs from next', () => {
    expect(shouldPersistOnboardingCompleted('0.90.0', NEXT)).toBe(true)
  })
})
