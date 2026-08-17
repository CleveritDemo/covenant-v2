import { describe, expect, it } from 'vitest'
import { shouldBridgeVisibleLaneEvent } from '../laneEventRouting'

describe('shouldBridgeVisibleLaneEvent', () => {
  it('visible cuando el carril no está ocupado', () => {
    expect(shouldBridgeVisibleLaneEvent({
      laneBusy: false,
      laneHasOwnSubscription: false,
    })).toBe('visible')
  })

  it('skip cuando el carril ocupado ya tiene listener propio', () => {
    expect(shouldBridgeVisibleLaneEvent({
      laneBusy: true,
      laneHasOwnSubscription: true,
    })).toBe('skip')
  })

  it('bridge cuando el carril está ocupado pero aún sin listener', () => {
    expect(shouldBridgeVisibleLaneEvent({
      laneBusy: true,
      laneHasOwnSubscription: false,
    })).toBe('bridge')
  })
})
