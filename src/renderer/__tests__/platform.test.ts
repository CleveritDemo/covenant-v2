/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest'

type PlatformApi = {
  platform?: string
  setTitleBarOverlay?: (color: string, symbolColor: string) => void
}

function setApi(api: PlatformApi | undefined): void {
  if (api === undefined) {
    delete (window as unknown as { api?: unknown }).api
    return
  }
  ;(window as unknown as { api: PlatformApi }).api = api
}

afterEach(() => {
  setApi(undefined)
  vi.resetModules()
  vi.restoreAllMocks()
})

describe('platform', () => {
  it('reads win32 from window.api.platform', async () => {
    setApi({ platform: 'win32' })
    const mod = await import('../platform')
    expect(mod.platformId).toBe('win32')
    expect(mod.isWindows).toBe(true)
    expect(mod.isMacOS).toBe(false)
  })

  it('reads darwin from window.api.platform', async () => {
    setApi({ platform: 'darwin' })
    const mod = await import('../platform')
    expect(mod.platformId).toBe('darwin')
    expect(mod.isWindows).toBe(false)
    expect(mod.isMacOS).toBe(true)
  })

  it('falls back to empty string when api is absent', async () => {
    setApi(undefined)
    const mod = await import('../platform')
    expect(mod.platformId).toBe('')
    expect(mod.isWindows).toBe(false)
    expect(mod.isMacOS).toBe(false)
  })
})
