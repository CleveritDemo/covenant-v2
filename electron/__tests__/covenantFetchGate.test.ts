import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const httpFetch = vi.fn()

vi.mock('../httpFetch', () => ({
  httpFetch: (...args: unknown[]) => httpFetch(...args),
  describeFetchError: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
}))

vi.mock('../covenantSession', () => ({
  clearCovenantSession: vi.fn(),
  loadCovenantSession: vi.fn(() => null),
  persistCovenantSession: vi.fn(),
}))

import { covenantFetch } from '../covenantApi'

function stubNeverResolvesUnlessAborted(): void {
  httpFetch.mockImplementation((_url: string, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal
      if (signal?.aborted) {
        reject(new DOMException('The operation was aborted.', 'AbortError'))
        return
      }
      signal?.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted.', 'AbortError'))
      })
    })
  })
}

beforeEach(() => {
  httpFetch.mockReset()
  vi.useRealTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('covenantFetch gate', () => {
  it('nunca supera 4 peticiones en vuelo con 12 llamadas simultáneas', async () => {
    let inFlight = 0
    let peak = 0
    httpFetch.mockImplementation(async () => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 20))
      inFlight -= 1
      return new Response('ok')
    })

    await Promise.all(Array.from({ length: 12 }, (_, i) => covenantFetch(`https://example.com/${i}`)))

    expect(peak).toBeLessThanOrEqual(4)
    expect(peak).toBe(4)
    expect(httpFetch).toHaveBeenCalledTimes(12)
  })

  it('rechaza tras 30s si httpFetch no resuelve', async () => {
    vi.useFakeTimers()
    stubNeverResolvesUnlessAborted()

    const pending = covenantFetch('https://example.com/timeout')
    const expectation = expect(pending).rejects.toThrow('Covenant no respondió en 30s')
    await vi.advanceTimersByTimeAsync(30_000)
    await expectation
  })

  it('libera el slot cuando httpFetch rechaza', async () => {
    httpFetch.mockRejectedValueOnce(new Error('net::ERR_INSUFFICIENT_RESOURCES'))
    await expect(covenantFetch('https://example.com/fail')).rejects.toThrow(
      'net::ERR_INSUFFICIENT_RESOURCES',
    )

    httpFetch.mockResolvedValueOnce(new Response('ok'))
    const second = covenantFetch('https://example.com/ok')
    await expect(second).resolves.toBeInstanceOf(Response)
    expect(httpFetch).toHaveBeenCalledTimes(2)
  })
})
