import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_HEARTBEAT_BUCKET_MS,
  shouldBumpActivityHeartbeat,
} from '../activityHeartbeat'

describe('shouldBumpActivityHeartbeat', () => {
  it('bumps when prevMs is zero', () => {
    expect(shouldBumpActivityHeartbeat(0, 100)).toBe(true)
  })

  it('does not bump within the bucket window', () => {
    expect(shouldBumpActivityHeartbeat(1000, 1999)).toBe(false)
  })

  it('bumps when the bucket window elapses', () => {
    expect(shouldBumpActivityHeartbeat(1000, 2000)).toBe(true)
  })

  it('bumps when the clock moves backwards', () => {
    expect(shouldBumpActivityHeartbeat(5000, 4000)).toBe(true)
  })

  it('uses ACTIVITY_HEARTBEAT_BUCKET_MS by default', () => {
    const base = 10_000
    expect(shouldBumpActivityHeartbeat(base, base + ACTIVITY_HEARTBEAT_BUCKET_MS - 1)).toBe(false)
    expect(shouldBumpActivityHeartbeat(base, base + ACTIVITY_HEARTBEAT_BUCKET_MS)).toBe(true)
  })
})
