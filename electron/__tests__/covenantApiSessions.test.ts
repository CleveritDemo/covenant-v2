import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const httpFetch = vi.fn()
const persistCovenantSession = vi.fn()
const clearCovenantSession = vi.fn()
const loadCovenantSessions = vi.fn(() => ({}))

vi.mock('../httpFetch', () => ({
  httpFetch: (...args: unknown[]) => httpFetch(...args),
  describeFetchError: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
}))

vi.mock('../covenantSession', () => ({
  persistCovenantSession: (...args: unknown[]) => persistCovenantSession(...args),
  loadCovenantSessions: (...args: unknown[]) => loadCovenantSessions(...args),
  clearCovenantSession: (...args: unknown[]) => clearCovenantSession(...args),
  clearAllCovenantSessions: vi.fn(),
}))

import { exchange, initCovenantSessions, listOrgs, signOut, status, statusAll } from '../covenantApi'

function exchangeResponse(jwt: string, login: string): Response {
  return new Response(
    JSON.stringify({ jwt, login, avatar_url: `https://av/${login}`, github_id: login }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

beforeEach(() => {
  httpFetch.mockReset()
  persistCovenantSession.mockReset()
  clearCovenantSession.mockReset()
  loadCovenantSessions.mockReset()
  loadCovenantSessions.mockReturnValue({})
  initCovenantSessions()
})

afterEach(() => {
  initCovenantSessions()
})

describe('covenantApi sesiones keyed', () => {
  it('dos cuentas mantienen JWT distintos y signOut de una no toca la otra', async () => {
    httpFetch
      .mockResolvedValueOnce(exchangeResponse('jwt-one', 'one'))
      .mockResolvedValueOnce(exchangeResponse('jwt-two', 'two'))

    await exchange('acc-1', 'tok-1')
    await exchange('acc-2', 'tok-2')

    expect(status('acc-1')).toEqual({
      signedIn: true,
      login: 'one',
      avatarUrl: 'https://av/one',
      githubId: 'one',
    })
    expect(status('acc-2')).toEqual({
      signedIn: true,
      login: 'two',
      avatarUrl: 'https://av/two',
      githubId: 'two',
    })
    expect(statusAll()['acc-1']?.login).toBe('one')
    expect(statusAll()['acc-2']?.login).toBe('two')

    signOut('acc-1')
    expect(status('acc-1')).toEqual({ signedIn: false })
    expect(status('acc-2').signedIn).toBe(true)
    expect(status('acc-2').login).toBe('two')
    expect(clearCovenantSession).toHaveBeenCalledWith('acc-1')
    expect(statusAll()['acc-1']).toBeUndefined()
    expect(statusAll()['acc-2']?.login).toBe('two')
  })

  it('401 re-exchange usa el githubToken de ESA cuenta', async () => {
    httpFetch
      .mockResolvedValueOnce(exchangeResponse('jwt-one', 'one'))
      .mockResolvedValueOnce(exchangeResponse('jwt-two', 'two'))

    await exchange('acc-1', 'tok-1')
    await exchange('acc-2', 'tok-2')

    httpFetch
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(exchangeResponse('jwt-one-b', 'one'))
      .mockResolvedValueOnce(new Response('[]', { status: 200 }))

    await expect(listOrgs('acc-1')).resolves.toEqual([])

    const bodies = httpFetch.mock.calls.map(call => {
      const init = call[1] as RequestInit | undefined
      return typeof init?.body === 'string' ? init.body : null
    })
    expect(bodies).toContain(JSON.stringify({ github_access_token: 'tok-1' }))
    expect(bodies.filter(b => b === JSON.stringify({ github_access_token: 'tok-2' }))).toHaveLength(1)
    expect(status('acc-1').signedIn).toBe(true)
    expect(status('acc-2').login).toBe('two')
  })
})
