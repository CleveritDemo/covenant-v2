import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ASSISTANT_DELTA_THROTTLE_MS,
  createAssistantDeltaThrottler,
} from '../assistantDeltaThrottle'

describe('createAssistantDeltaThrottler', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('batches rapid deltas into one apply per window', () => {
    vi.useFakeTimers()
    const applyBatch = vi.fn()
    const throttler = createAssistantDeltaThrottler(applyBatch)

    throttler.append('a1', 'h')
    throttler.append('a1', 'o')
    throttler.append('a1', 'la')
    expect(applyBatch).not.toHaveBeenCalled()

    vi.advanceTimersByTime(ASSISTANT_DELTA_THROTTLE_MS)
    expect(applyBatch).toHaveBeenCalledTimes(1)
    expect(applyBatch).toHaveBeenCalledWith('a1', 'hola')
  })

  it('starts a new window after each flush during continuous streaming', () => {
    vi.useFakeTimers()
    const applyBatch = vi.fn()
    const throttler = createAssistantDeltaThrottler(applyBatch)

    throttler.append('a1', '1')
    vi.advanceTimersByTime(ASSISTANT_DELTA_THROTTLE_MS)
    throttler.append('a1', '2')
    vi.advanceTimersByTime(ASSISTANT_DELTA_THROTTLE_MS)

    expect(applyBatch).toHaveBeenCalledTimes(2)
    expect(applyBatch).toHaveBeenNthCalledWith(1, 'a1', '1')
    expect(applyBatch).toHaveBeenNthCalledWith(2, 'a1', '2')
  })

  it('flushes pending text immediately when assistant id changes', () => {
    vi.useFakeTimers()
    const applyBatch = vi.fn()
    const throttler = createAssistantDeltaThrottler(applyBatch)

    throttler.append('a1', 'uno')
    throttler.append('a2', 'dos')

    expect(applyBatch).toHaveBeenCalledTimes(1)
    expect(applyBatch).toHaveBeenCalledWith('a1', 'uno')
  })

  it('flush and dispose apply trailing batches without waiting', () => {
    vi.useFakeTimers()
    const applyBatch = vi.fn()
    const throttler = createAssistantDeltaThrottler(applyBatch)

    throttler.append('a1', 'pend')
    throttler.flush()
    expect(applyBatch).toHaveBeenCalledWith('a1', 'pend')

    throttler.append('a1', 'tail')
    throttler.dispose()
    expect(applyBatch).toHaveBeenLastCalledWith('a1', 'tail')
  })
})
