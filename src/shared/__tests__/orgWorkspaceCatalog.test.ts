import { describe, expect, it } from 'vitest'
import { mergeWithDefaults } from '../configSchema'
import {
  accountIdsInCatalogMap,
  buildOrgWorkspaceCatalog,
  canAccessOrgWorkspace,
  canRenameOrgWorkspace,
  canUploadOrgWorkspaceFromCatalog,
  catalogForAccount,
  catalogForLogin,
  catalogHasWorkspaces,
  findOrgWorkspaceCatalogEntry,
  findOrgWorkspaceCatalogEntryInMap,
  isCatalogFresh,
  orgWorkspaceTokenMissing,
  parseOrgWorkspaceCatalogMap,
  patchOrgWorkspaceCatalogName,
  syncTabTitlesFromOrgWorkspaceCatalog,
  upsertAccountCatalog,
} from '../orgWorkspaceCatalog'

describe('orgWorkspaceTokenMissing', () => {
  it('false si githubToken vacío y hay cuentas en el llavero', () => {
    expect(orgWorkspaceTokenMissing({
      githubToken: '',
      githubAccounts: [{ id: 'acc-1', label: 'Personal' }],
    })).toBe(false)
  })

  it('true si githubToken vacío y el llavero vacío', () => {
    expect(orgWorkspaceTokenMissing({
      githubToken: '',
      githubAccounts: [],
    })).toBe(true)
  })

  it('false si githubToken tiene valor y el llavero vacío', () => {
    expect(orgWorkspaceTokenMissing({
      githubToken: 'ghp_legacy',
      githubAccounts: [],
    })).toBe(false)
  })
})

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
    expect(catalogForLogin(cat, 'Alice')).toBe(cat)
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
      orgRole: 'admin',
      isOrgAdmin: false,
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

  it('compara creator y workspace-admins sin importar casing', () => {
    expect(canRenameOrgWorkspace({
      login: 'RodrigoAnti',
      orgRole: 'member',
      isOrgAdmin: false,
      createdBy: 'rodrigoanti',
    })).toBe(true)
    expect(canRenameOrgWorkspace({
      login: 'rodrigoanti',
      orgRole: 'member',
      isOrgAdmin: false,
      admins: ['RodrigoAnti'],
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
    expect(canRenameOrgWorkspace({
      login: 'Erin',
      orgRole: 'member',
      isOrgAdmin: false,
      createdBy: 'alice',
      admins: ['bob'],
    })).toBe(false)
  })
})

describe('canAccessOrgWorkspace', () => {
  it('permite managers de org y participantes del workspace', () => {
    expect(canAccessOrgWorkspace({
      login: 'owner',
      orgRole: 'owner',
      isOrgAdmin: false,
    })).toBe(true)
    expect(canAccessOrgWorkspace({
      login: 'orgadmin',
      orgRole: 'admin',
      isOrgAdmin: false,
    })).toBe(true)
    expect(canAccessOrgWorkspace({
      login: 'admin',
      orgRole: 'member',
      isOrgAdmin: true,
    })).toBe(true)
    expect(canAccessOrgWorkspace({
      login: 'creator',
      orgRole: 'member',
      isOrgAdmin: false,
      createdBy: 'creator',
    })).toBe(true)
    expect(canAccessOrgWorkspace({
      login: 'lead',
      orgRole: 'member',
      isOrgAdmin: false,
      admins: ['lead'],
    })).toBe(true)
    expect(canAccessOrgWorkspace({
      login: 'dev',
      orgRole: 'member',
      isOrgAdmin: false,
      assignees: ['dev'],
    })).toBe(true)
  })

  it('compara creator, admins y assignees sin importar casing', () => {
    expect(canAccessOrgWorkspace({
      login: 'Alice',
      orgRole: 'member',
      isOrgAdmin: false,
      createdBy: 'alice',
    })).toBe(true)
    expect(canAccessOrgWorkspace({
      login: 'bob',
      orgRole: 'member',
      isOrgAdmin: false,
      admins: ['Bob'],
    })).toBe(true)
    expect(canAccessOrgWorkspace({
      login: 'Carol',
      orgRole: 'member',
      isOrgAdmin: false,
      assignees: ['carol'],
    })).toBe(true)
  })

  it('niega miembros de org no asignados al workspace', () => {
    expect(canAccessOrgWorkspace({
      login: 'outsider',
      orgRole: 'member',
      isOrgAdmin: false,
      createdBy: 'creator',
      admins: ['lead'],
      assignees: ['dev'],
    })).toBe(false)
  })
})

describe('buildOrgWorkspaceCatalog', () => {
  it('filtra slug/id/name vacíos, no accesibles y propaga canRename', () => {
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
          { id: 'hidden', name: 'Hidden', canAccess: false },
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

describe('canUploadOrgWorkspaceFromCatalog', () => {
  const cat = {
    login: 'alice',
    fetchedAt: 1,
    entries: [
      { slug: 'acme', orgName: 'Acme', workspaceId: 'w1', name: 'Alpha', canRename: true },
      { slug: 'acme', orgName: 'Acme', workspaceId: 'w2', name: 'Beta', canRename: false },
    ],
  }

  it('false si el catálogo aún no cargó', () => {
    expect(canUploadOrgWorkspaceFromCatalog(null, 'acme', 'w1')).toBe(false)
    expect(canUploadOrgWorkspaceFromCatalog(undefined, 'acme', 'w1')).toBe(false)
  })

  it('true si la entrada tiene canRename true', () => {
    expect(canUploadOrgWorkspaceFromCatalog(cat, 'acme', 'w1')).toBe(true)
  })

  it('false si la entrada tiene canRename false', () => {
    expect(canUploadOrgWorkspaceFromCatalog(cat, 'acme', 'w2')).toBe(false)
  })

  it('true si el catálogo no conoce ese workspace (segunda cuenta Covenant)', () => {
    const otherOrgCatalog = {
      login: 'cleverit',
      fetchedAt: 1,
      entries: [
        { slug: 'acme', orgName: 'Acme', workspaceId: 'w1', name: 'Alpha', canRename: true },
      ],
    }
    expect(canUploadOrgWorkspaceFromCatalog(otherOrgCatalog, 'credicorp', 'ws-99')).toBe(true)
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

const sampleEntry = {
  slug: 'acme',
  orgName: 'Acme',
  workspaceId: 'w1',
  name: 'Alpha',
}

function sampleCatalog(login = 'alice') {
  return {
    login,
    fetchedAt: 100,
    entries: [sampleEntry],
  }
}

describe('parseOrgWorkspaceCatalogMap', () => {
  it('migra la forma legacy a la clave vacía', () => {
    const legacy = sampleCatalog()
    const parsed = parseOrgWorkspaceCatalogMap(legacy)
    expect(parsed).toEqual({ byAccount: { '': legacy } })
  })

  it('acepta la forma nueva con dos cuentas', () => {
    const acc1 = sampleCatalog('alice')
    const acc2 = sampleCatalog('bob')
    const parsed = parseOrgWorkspaceCatalogMap({
      byAccount: { 'acc-1': acc1, 'acc-2': acc2 },
    })
    expect(parsed).toEqual({ byAccount: { 'acc-1': acc1, 'acc-2': acc2 } })
    expect(accountIdsInCatalogMap(parsed)).toEqual(['acc-1', 'acc-2'])
  })

  it('descarta una cuenta con entries corruptas y conserva la buena', () => {
    const good = sampleCatalog()
    const parsed = parseOrgWorkspaceCatalogMap({
      byAccount: {
        good: good,
        bad: { login: '', fetchedAt: 1, entries: [] },
      },
    })
    expect(parsed).toEqual({ byAccount: { good: good } })
  })

  it('devuelve null con basura', () => {
    expect(parseOrgWorkspaceCatalogMap(null)).toBeNull()
    expect(parseOrgWorkspaceCatalogMap({ foo: 'bar' })).toBeNull()
    expect(parseOrgWorkspaceCatalogMap({ byAccount: {} })).toBeNull()
    expect(parseOrgWorkspaceCatalogMap({ byAccount: { bad: { login: '' } } })).toBeNull()
  })
})

describe('catalogForAccount', () => {
  const map = {
    byAccount: {
      '': sampleCatalog('default'),
      'acc-2': sampleCatalog('second'),
    },
  }

  it('encuentra por accountId', () => {
    expect(catalogForAccount(map, 'acc-2')?.login).toBe('second')
  })

  it('devuelve null para una cuenta ausente', () => {
    expect(catalogForAccount(map, 'missing')).toBeNull()
    expect(catalogForAccount(null, 'acc-2')).toBeNull()
  })

  it('trata la cadena vacía como la cuenta por defecto', () => {
    expect(catalogForAccount(map, '')?.login).toBe('default')
    expect(catalogForAccount(map, '   ')?.login).toBe('default')
  })
})

describe('findOrgWorkspaceCatalogEntryInMap', () => {
  it('encuentra la entrada en la cuenta correcta del mapa', () => {
    const entry = { slug: 'acme', orgName: 'Acme', workspaceId: 'w1', name: 'Alpha' }
    const map = {
      byAccount: {
        '': { login: 'a', fetchedAt: 1, entries: [] },
        'acc-2': { login: 'b', fetchedAt: 1, entries: [entry] },
      },
    }
    expect(findOrgWorkspaceCatalogEntryInMap(map, 'acme', 'w1')).toEqual(entry)
    expect(findOrgWorkspaceCatalogEntryInMap(map, 'acme', 'missing')).toBeUndefined()
    expect(findOrgWorkspaceCatalogEntryInMap(null, 'acme', 'w1')).toBeUndefined()
  })
})

describe('upsertAccountCatalog', () => {
  it('no muta el mapa de entrada y reemplaza solo esa cuenta', () => {
    const original = {
      byAccount: { 'acc-1': sampleCatalog('keep') },
    }
    const replacement = sampleCatalog('new')
    const next = upsertAccountCatalog(original, 'acc-2', replacement)
    expect(original.byAccount).toEqual({ 'acc-1': sampleCatalog('keep') })
    expect(next.byAccount['acc-1']?.login).toBe('keep')
    expect(next.byAccount['acc-2']).toEqual(replacement)
    expect(next).not.toBe(original)
  })
})

describe('mergeWithDefaults orgWorkspaceCatalogCache', () => {
  it('migra la forma legacy al leer config', () => {
    const legacy = sampleCatalog()
    const merged = mergeWithDefaults({
      orgWorkspaceCatalogCache: legacy as unknown as Parameters<typeof mergeWithDefaults>[0]['orgWorkspaceCatalogCache'],
    })
    expect(merged.orgWorkspaceCatalogCache).toEqual({ byAccount: { '': legacy } })
  })

  it('elimina la clave si el valor es basura', () => {
    const merged = mergeWithDefaults({
      orgWorkspaceCatalogCache: { foo: 'bar' } as unknown as Parameters<typeof mergeWithDefaults>[0]['orgWorkspaceCatalogCache'],
    })
    expect(merged.orgWorkspaceCatalogCache).toBeUndefined()
    expect(Object.prototype.hasOwnProperty.call(merged, 'orgWorkspaceCatalogCache')).toBe(false)
  })
})
