import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const httpFetch = vi.fn()
const loadCovenantSession = vi.fn(() => null)

vi.mock('../httpFetch', () => ({
  httpFetch: (...args: unknown[]) => httpFetch(...args),
  describeFetchError: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
}))

vi.mock('../covenantSession', () => ({
  clearCovenantSession: vi.fn(),
  loadCovenantSession: (...args: unknown[]) => loadCovenantSession(...args),
  persistCovenantSession: vi.fn(),
}))

import {
  CovenantApiError,
  covenantFetch,
  createOrg,
  initCovenantSession,
  listOrgs,
  signOut,
} from '../covenantApi'

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

/** Promesa que nunca resuelve e ignora AbortSignal por completo. */
function stubNeverResolvesIgnoringAbort(): void {
  httpFetch.mockImplementation(() => new Promise<Response>(() => {}))
}

function seedSession(): void {
  loadCovenantSession.mockReturnValue({
    jwt: 'test-jwt',
    login: 'tester',
    avatarUrl: 'https://example.com/a.png',
    githubId: 1,
    githubToken: 'gh-token',
  })
  initCovenantSession()
}

beforeEach(() => {
  httpFetch.mockReset()
  loadCovenantSession.mockReset()
  loadCovenantSession.mockReturnValue(null)
  signOut()
  vi.useRealTimers()
})

afterEach(() => {
  signOut()
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

  it('rechaza a los 30s aunque httpFetch ignore el AbortSignal', async () => {
    vi.useFakeTimers()
    stubNeverResolvesIgnoringAbort()

    const pending = covenantFetch('https://example.com/ignore-abort')
    const expectation = expect(pending).rejects.toThrow('Covenant no respondió en 30s')
    await vi.advanceTimersByTimeAsync(30_000)
    await expectation
  })

  it('libera slots tras timeout aunque httpFetch ignore el signal', async () => {
    vi.useFakeTimers()
    stubNeverResolvesIgnoringAbort()

    const hung = Array.from({ length: 4 }, (_, i) =>
      covenantFetch(`https://example.com/hang/${i}`).catch(() => undefined),
    )
    await Promise.resolve()
    expect(httpFetch).toHaveBeenCalledTimes(4)

    const fifth = covenantFetch('https://example.com/fifth')
    await Promise.resolve()
    expect(httpFetch).toHaveBeenCalledTimes(4)

    httpFetch.mockImplementationOnce(async () => new Response('ok'))
    await vi.advanceTimersByTimeAsync(30_000)
    await Promise.all(hung)
    await expect(fifth).resolves.toBeInstanceOf(Response)
    expect(httpFetch).toHaveBeenCalledTimes(5)
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

describe('authedFetch retry', () => {
  it('GET reintenta 503→503→200 con backoff 400ms y 1200ms', async () => {
    vi.useFakeTimers()
    seedSession()

    httpFetch
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response('[]', { status: 200 }))

    const pending = listOrgs()
    await vi.advanceTimersByTimeAsync(400)
    await vi.advanceTimersByTimeAsync(1200)
    await expect(pending).resolves.toEqual([])
    expect(httpFetch).toHaveBeenCalledTimes(3)
  })

  it('POST con 503 no reintenta', async () => {
    seedSession()

    httpFetch.mockResolvedValueOnce(new Response('{"error":"unavailable"}', { status: 503 }))

    await expect(createOrg('acme', 'Acme')).rejects.toBeInstanceOf(CovenantApiError)
    expect(httpFetch).toHaveBeenCalledTimes(1)
  })
})
