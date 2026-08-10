import { describe, expect, it } from 'vitest'
import { mapWorkspaceRepoRecord } from '../covenantApi'

describe('mapWorkspaceRepoRecord', () => {
  it('mapea camelCase con folderName', () => {
    const mapped = mapWorkspaceRepoRecord({
      id: 'r1',
      repoFullName: 'acme/app',
      cloneUrl: 'https://github.com/acme/app.git',
      folderName: 'custom-dir',
      position: 1,
      createdAt: 10,
      updatedAt: 20,
    })
    expect(mapped).toEqual({
      id: 'r1',
      repoFullName: 'acme/app',
      cloneUrl: 'https://github.com/acme/app.git',
      folderName: 'custom-dir',
      position: 1,
      createdAt: 10,
      updatedAt: 20,
    })
  })

  it('mapea snake_case folder_name', () => {
    const mapped = mapWorkspaceRepoRecord({
      id: 'r2',
      repo_full_name: 'acme/api',
      clone_url: 'git@github.com:acme/api.git',
      folder_name: 'api-local',
      position: 0,
      created_at: 1,
      updated_at: 2,
    })
    expect(mapped?.folderName).toBe('api-local')
    expect(mapped?.repoFullName).toBe('acme/api')
  })

  it('omite folderName vacío tras limpiar', () => {
    const mapped = mapWorkspaceRepoRecord({
      id: 'r3',
      repoFullName: 'acme/app',
      cloneUrl: 'https://github.com/acme/app.git',
      folderName: '',
      folder_name: '',
      position: 0,
      createdAt: 1,
      updatedAt: 1,
    })
    expect(mapped).not.toBeNull()
    expect(mapped).not.toHaveProperty('folderName')
  })

  it('rechaza payload inválido', () => {
    expect(mapWorkspaceRepoRecord(null)).toBeNull()
    expect(mapWorkspaceRepoRecord({ id: 'x' })).toBeNull()
  })
})
