/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getCovenantApi,
  hasCovenantStatusAllApi,
  type CovenantApi,
} from '../covenantApi'

function installRaw(raw: Partial<CovenantApi> | undefined): void {
  ;(window as unknown as { api: { covenant?: Partial<CovenantApi> } }).api = {
    ...(raw ? { covenant: raw } : {}),
  }
}

beforeEach(() => {
  installRaw(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getCovenantApi facade', () => {
  it('inyecta accountId como primer argumento en métodos distintos', async () => {
    const status = vi.fn().mockResolvedValue({ ok: true, data: { signedIn: false } })
    const orgsList = vi.fn().mockResolvedValue({ ok: true, data: [] })
    installRaw({ status, orgsList } as Partial<CovenantApi>)

    const api = getCovenantApi('acc-1')
    expect(api).toBeDefined()
    await api!.status()
    await api!.orgsList()

    expect(status).toHaveBeenCalledWith('acc-1')
    expect(orgsList).toHaveBeenCalledWith('acc-1')
  })

  it('devuelve facades distintos por accountId y los memoiza', () => {
    const status = vi.fn()
    const orgsList = vi.fn()
    installRaw({ status, orgsList } as Partial<CovenantApi>)

    const a = getCovenantApi('a')
    const aAgain = getCovenantApi('a')
    const b = getCovenantApi('b')

    expect(a).toBe(aAgain)
    expect(a).not.toBe(b)
  })

  it('sin window.api.covenant devuelve undefined', () => {
    installRaw(undefined)
    expect(getCovenantApi('x')).toBeUndefined()
  })
})

describe('hasCovenantStatusAllApi', () => {
  it('es true sólo si statusAll es función', () => {
    expect(hasCovenantStatusAllApi(undefined)).toBe(false)
    expect(hasCovenantStatusAllApi({} as CovenantApi)).toBe(false)
    expect(hasCovenantStatusAllApi({
      statusAll: async () => ({ ok: true, data: {} }),
    } as CovenantApi)).toBe(true)
  })
})
