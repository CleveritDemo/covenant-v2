import { describe, expect, it } from 'vitest'
import {
  hasCovenantWorkspaceReposApi,
  type CovenantApi,
} from '../covenantApi'

function stubReposApi(overrides: Partial<CovenantApi> = {}): CovenantApi {
  return {
    workspaceReposList: async () => ({ ok: true, data: [] }),
    workspaceRepoAdd: async () => ({
      ok: true,
      data: {
        id: '1',
        repoFullName: 'a/b',
        cloneUrl: 'https://github.com/a/b.git',
        position: 0,
        createdAt: 0,
        updatedAt: 0,
      },
    }),
    workspaceRepoUpdate: async () => ({
      ok: true,
      data: {
        id: '1',
        repoFullName: 'a/b',
        cloneUrl: 'https://github.com/a/b.git',
        position: 0,
        createdAt: 0,
        updatedAt: 0,
      },
    }),
    workspaceRepoDelete: async () => ({ ok: true, data: null }),
    ...overrides,
  } as CovenantApi
}

describe('hasCovenantWorkspaceReposApi', () => {
  it('exige list/add/update/delete', () => {
    expect(hasCovenantWorkspaceReposApi(stubReposApi())).toBe(true)
  })

  it('falla sin workspaceRepoUpdate', () => {
    const api = stubReposApi()
    delete (api as Partial<CovenantApi>).workspaceRepoUpdate
    expect(hasCovenantWorkspaceReposApi(api)).toBe(false)
  })

  it('falla sin api', () => {
    expect(hasCovenantWorkspaceReposApi(undefined)).toBe(false)
  })
})
