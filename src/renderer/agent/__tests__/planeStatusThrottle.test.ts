import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPlaneStatusThrottler, PLANE_STATUS_THROTTLE_MS } from '../planeStatusThrottle'

describe('createPlaneStatusThrottler', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('publishes immediately on first schedule and on controlKey change', () => {
    const publish = vi.fn()
    const throttler = createPlaneStatusThrottler<string>()

    throttler.schedule({ controlKey: 'idle', value: 'a', publish })
    expect(publish).toHaveBeenCalledTimes(1)
    expect(publish).toHaveBeenLastCalledWith('a')

    throttler.schedule({ controlKey: 'busy', value: 'b', publish })
    expect(publish).toHaveBeenCalledTimes(2)
    expect(publish).toHaveBeenLastCalledWith('b')
  })

  it('throttles same-control updates and flushes the latest value', () => {
    vi.useFakeTimers()
    const publish = vi.fn()
    const throttler = createPlaneStatusThrottler<string>()

    throttler.schedule({ controlKey: 'busy', value: '1', publish })
    expect(publish).toHaveBeenCalledTimes(1)

    throttler.schedule({ controlKey: 'busy', value: '2', publish })
    throttler.schedule({ controlKey: 'busy', value: '3', publish })
    expect(publish).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(PLANE_STATUS_THROTTLE_MS)
    expect(publish).toHaveBeenCalledTimes(2)
    expect(publish).toHaveBeenLastCalledWith('3')
  })

  it('dispose flushes a pending trailing update', () => {
    vi.useFakeTimers()
    const publish = vi.fn()
    const throttler = createPlaneStatusThrottler<string>()

    throttler.schedule({ controlKey: 'busy', value: '1', publish })
    throttler.schedule({ controlKey: 'busy', value: 'pending', publish })
    expect(publish).toHaveBeenCalledTimes(1)

    throttler.dispose()
    expect(publish).toHaveBeenCalledTimes(2)
    expect(publish).toHaveBeenLastCalledWith('pending')
  })
})
