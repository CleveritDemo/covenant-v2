import { describe, expect, it } from 'vitest'
import {
  buildOrgWorkspaceCatalog,
  catalogForLogin,
  catalogHasWorkspaces,
  isCatalogFresh,
} from '../orgWorkspaceCatalog'

describe('catalogHasWorkspaces', () => {
  it('false si vacío o ausente', () => {
    expect(catalogHasWorkspaces(undefined)).toBe(false)
    expect(catalogHasWorkspaces(null)).toBe(false)
    expect(catalogHasWorkspaces({ login: 'a', entries: [], fetchedAt: 1 })).toBe(false)
  })

  it('true con entries', () => {
    expect(catalogHasWorkspaces({
      login: 'a',
      fetchedAt: 1,
      entries: [{ slug: 'o', orgName: 'O', workspaceId: '1', name: 'W' }],
    })).toBe(true)
  })
})

describe('catalogForLogin', () => {
  const cat = {
    login: 'alice',
    fetchedAt: 10,
    entries: [{ slug: 'o', orgName: 'O', workspaceId: '1', name: 'W' }],
  }

  it('devuelve el catálogo si el login coincide', () => {
    expect(catalogForLogin(cat, 'alice')).toBe(cat)
    expect(catalogForLogin(cat, ' alice ')).toBe(cat)
  })

  it('null si el login no coincide', () => {
    expect(catalogForLogin(cat, 'bob')).toBeNull()
    expect(catalogForLogin(cat, '')).toBeNull()
  })
})

describe('isCatalogFresh', () => {
  const cat = { login: 'a', entries: [], fetchedAt: 1000 }

  it('respeta el TTL', () => {
    expect(isCatalogFresh(cat, 500, 1400)).toBe(true)
    expect(isCatalogFresh(cat, 500, 1600)).toBe(false)
    expect(isCatalogFresh(null, 500, 1000)).toBe(false)
  })
})

describe('buildOrgWorkspaceCatalog', () => {
  it('filtra slug/id/name vacíos', () => {
    const built = buildOrgWorkspaceCatalog(
      'alice',
      [
        { slug: 'acme', name: 'Acme' },
        { slug: '  ', name: 'Bad' },
        { slug: 'other', name: '' },
      ],
      {
        acme: [
          { id: 'w1', name: 'Alpha' },
          { id: '', name: 'NoId' },
          { id: 'w2', name: '  ' },
        ],
        other: [{ id: 'w3', name: 'Beta' }],
      },
      99,
    )
    expect(built.login).toBe('alice')
    expect(built.fetchedAt).toBe(99)
    expect(built.entries).toEqual([
      { slug: 'acme', orgName: 'Acme', workspaceId: 'w1', name: 'Alpha' },
      { slug: 'other', orgName: 'other', workspaceId: 'w3', name: 'Beta' },
    ])
  })
})
