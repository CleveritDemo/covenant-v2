/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('whenSplashDismissed', () => {
  beforeEach(() => {
    vi.resetModules()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('resuelve tras el fundido de dismissSplash', async () => {
    vi.useFakeTimers()
    const el = document.createElement('div')
    el.id = 'splash'
    document.body.appendChild(el)

    const {
      dismissSplash,
      markSplashUiReady,
      whenSplashDismissed,
      SPLASH_SETTLE_MS,
    } = await import('../splash')
    vi.spyOn(performance, 'now').mockReturnValue(10_000)

    let settled = false
    void whenSplashDismissed().then(() => {
      settled = true
    })

    markSplashUiReady()
    dismissSplash()
    expect(settled).toBe(false)

    await vi.advanceTimersByTimeAsync(SPLASH_SETTLE_MS)
    expect(settled).toBe(true)
  })

  it('resuelve de inmediato si no hay #splash', async () => {
    const { whenSplashDismissed } = await import('../splash')
    await expect(whenSplashDismissed()).resolves.toBeUndefined()
  })

  it('resuelve de inmediato si el splash ya está oculto', async () => {
    const el = document.createElement('div')
    el.id = 'splash'
    el.classList.add('is-hidden')
    document.body.appendChild(el)

    const { whenSplashDismissed } = await import('../splash')
    await expect(whenSplashDismissed()).resolves.toBeUndefined()
  })
})
