import { describe, expect, it } from 'vitest'
import {
  buildOrgWorkspaceCatalog,
  canRenameOrgWorkspace,
  catalogForLogin,
  catalogHasWorkspaces,
  findOrgWorkspaceCatalogEntry,
  isCatalogFresh,
  patchOrgWorkspaceCatalogName,
  syncTabTitlesFromOrgWorkspaceCatalog,
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

describe('canRenameOrgWorkspace', () => {
  it('permite owner, org-admin, creator y workspace-admin', () => {
    expect(canRenameOrgWorkspace({
      login: 'alice',
      orgRole: 'owner',
      isOrgAdmin: false,
    })).toBe(true)
    expect(canRenameOrgWorkspace({
      login: 'bob',
      orgRole: 'member',
      isOrgAdmin: true,
    })).toBe(true)
    expect(canRenameOrgWorkspace({
      login: 'carol',
      orgRole: 'member',
      isOrgAdmin: false,
      createdBy: 'carol',
    })).toBe(true)
    expect(canRenameOrgWorkspace({
      login: 'dave',
      orgRole: 'member',
      isOrgAdmin: false,
      admins: ['dave'],
    })).toBe(true)
  })

  it('niega assignees sin rol de manager', () => {
    expect(canRenameOrgWorkspace({
      login: 'erin',
      orgRole: 'member',
      isOrgAdmin: false,
      createdBy: 'alice',
      admins: ['bob'],
    })).toBe(false)
  })
})

describe('buildOrgWorkspaceCatalog', () => {
  it('filtra slug/id/name vacíos y propaga canRename', () => {
    const built = buildOrgWorkspaceCatalog(
      'alice',
      [
        { slug: 'acme', name: 'Acme' },
        { slug: '  ', name: 'Bad' },
        { slug: 'other', name: '' },
      ],
      {
        acme: [
          { id: 'w1', name: 'Alpha', canRename: true },
          { id: '', name: 'NoId' },
          { id: 'w2', name: '  ' },
        ],
        other: [{ id: 'w3', name: 'Beta', canRename: false }],
      },
      99,
    )
    expect(built.login).toBe('alice')
    expect(built.fetchedAt).toBe(99)
    expect(built.entries).toEqual([
      { slug: 'acme', orgName: 'Acme', workspaceId: 'w1', name: 'Alpha', canRename: true },
      { slug: 'other', orgName: 'other', workspaceId: 'w3', name: 'Beta', canRename: false },
    ])
  })
})

describe('syncTabTitlesFromOrgWorkspaceCatalog', () => {
  const catalog = {
    login: 'a',
    fetchedAt: 1,
    entries: [{ slug: 'acme', orgName: 'Acme', workspaceId: 'w1', name: 'Alpha', canRename: true }],
  }

  it('actualiza título de tabs org y marca titleLocked', () => {
    const tabs = [
      { id: '1', title: 'Old', orgWorkspace: { slug: 'acme', workspaceId: 'w1' } },
      { id: '2', title: 'Personal' },
    ]
    const next = syncTabTitlesFromOrgWorkspaceCatalog(tabs, catalog)
    expect(next).toEqual([
      {
        id: '1',
        title: 'Alpha',
        titleLocked: true,
        orgWorkspace: { slug: 'acme', workspaceId: 'w1' },
      },
      { id: '2', title: 'Personal' },
    ])
  })

  it('null si ya está sincronizado', () => {
    const tabs = [{
      id: '1',
      title: 'Alpha',
      titleLocked: true,
      orgWorkspace: { slug: 'acme', workspaceId: 'w1' },
    }]
    expect(syncTabTitlesFromOrgWorkspaceCatalog(tabs, catalog)).toBeNull()
  })
})

describe('patchOrgWorkspaceCatalogName', () => {
  it('renombra la entrada coincidente', () => {
    const cat = {
      login: 'a',
      fetchedAt: 1,
      entries: [
        { slug: 'acme', orgName: 'Acme', workspaceId: 'w1', name: 'Alpha', canRename: true },
        { slug: 'acme', orgName: 'Acme', workspaceId: 'w2', name: 'Beta' },
      ],
    }
    const next = patchOrgWorkspaceCatalogName(cat, 'acme', 'w1', 'Gamma')
    expect(findOrgWorkspaceCatalogEntry(next, 'acme', 'w1')?.name).toBe('Gamma')
    expect(findOrgWorkspaceCatalogEntry(next, 'acme', 'w2')?.name).toBe('Beta')
  })
})
