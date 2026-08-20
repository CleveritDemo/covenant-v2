/**
 * @vitest-environment jsdom
 *
 * Reproduce el invariante de contextBridge: propiedades data no configurables
 * ni escribibles. Un Proxy con trap get que envuelve funciones viola eso.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getCovenantApi,
  hasCovenantMemberLoginsApi,
  hasCovenantOrgAdminsApi,
  hasCovenantOrgDeleteApi,
  hasCovenantStatusAllApi,
  hasCovenantWorkspacesApi,
  type CovenantApi,
} from '../covenantApi'

const METHOD_NAMES = [
  'statusAll',
  'memberLoginsList',
  'orgAdminsList',
  'orgAdminAdd',
  'orgAdminRemove',
  'workspacesList',
  'workspaceCreate',
  'workspaceRename',
  'workspaceDelete',
  'workspaceAssigneeAdd',
  'workspaceAssigneeRemove',
  'workspaceAdminAdd',
  'workspaceAdminRemove',
] as const

function installContextBridgeLike(
  spies: Record<string, ReturnType<typeof vi.fn>>,
): void {
  const obj = {} as CovenantApi
  for (const name of METHOD_NAMES) {
    Object.defineProperty(obj, name, {
      value: spies[name],
      writable: false,
      configurable: false,
      enumerable: true,
    })
  }
  ;(window as unknown as { api: { covenant: CovenantApi } }).api = { covenant: obj }
}

function spiesFor(methods: readonly string[]): Record<string, ReturnType<typeof vi.fn>> {
  return Object.fromEntries(methods.map(name => [name, vi.fn().mockResolvedValue({ ok: true })]))
}

beforeEach(() => {
  ;(window as unknown as { api: { covenant?: CovenantApi } }).api = {}
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getCovenantApi sobre un target estilo contextBridge', () => {
  it('no lanza al leer typeof, pasa los guards, inyecta accountId y memoiza por id', async () => {
    const spies = spiesFor(METHOD_NAMES)
    installContextBridgeLike(spies)

    let api: CovenantApi | undefined
    expect(() => {
      api = getCovenantApi('x')
      void typeof api?.workspacesList
    }).not.toThrow()

    expect(typeof api?.workspacesList).toBe('function')
    expect(hasCovenantStatusAllApi(api)).toBe(true)
    expect(hasCovenantMemberLoginsApi(api)).toBe(true)
    expect(hasCovenantOrgAdminsApi(api)).toBe(true)
    expect(hasCovenantWorkspacesApi(api)).toBe(true)

    await api!.workspacesList('org')
    await api!.statusAll()
    expect(spies.workspacesList).toHaveBeenCalledWith('x', 'org')
    expect(spies.statusAll).toHaveBeenCalledWith('x')

    expect(getCovenantApi('a')).not.toBe(getCovenantApi('b'))
    expect(getCovenantApi('a')).toBe(getCovenantApi('a'))
  })
})

describe('hasCovenantOrgDeleteApi', () => {
  it('es false sin orgDelete y true cuando el preload lo expone', () => {
    expect(hasCovenantOrgDeleteApi(undefined)).toBe(false)
    expect(hasCovenantOrgDeleteApi({} as CovenantApi)).toBe(false)

    const api = { orgDelete: vi.fn() } as unknown as CovenantApi
    expect(hasCovenantOrgDeleteApi(api)).toBe(true)
  })
})
