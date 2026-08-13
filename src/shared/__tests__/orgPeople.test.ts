import { describe, expect, it } from 'vitest'
import { orgPeopleRows, workspacePeopleRows } from '../orgPeople'
import { matchesWorkspaceQuery } from '../orgWorkspaceCatalog'

describe('orgPeopleRows', () => {
  it('resuelve el rol y ordena owner → admin → member', () => {
    const rows = orgPeopleRows(
      [
        { login: 'zoe' },
        { login: 'karluiz' },
        { login: 'rodrigoanti', role: 'owner' },
        { login: 'ana' },
      ],
      ['karluiz'],
    )
    expect(rows.map(r => [r.login, r.role])).toEqual([
      ['rodrigoanti', 'owner'],
      ['karluiz', 'admin'],
      ['ana', 'member'],
      ['zoe', 'member'],
    ])
  })

  it('no degrada al owner aunque también esté en orgAdmins', () => {
    const rows = orgPeopleRows([{ login: 'Rodrigo', role: 'owner' }], ['rodrigo'])
    expect(rows).toEqual([{ login: 'Rodrigo', role: 'owner' }])
  })

  it('descarta logins vacíos y duplicados case-insensitive', () => {
    const rows = orgPeopleRows([{ login: 'ana' }, { login: 'ANA' }, { login: '  ' }], [])
    expect(rows).toEqual([{ login: 'ana', role: 'member' }])
  })

  it('conserva el avatar cuando viene', () => {
    const rows = orgPeopleRows([{ login: 'ana', avatarUrl: 'https://x/a.png' }], [])
    expect(rows[0]?.avatarUrl).toBe('https://x/a.png')
  })
})

describe('workspacePeopleRows', () => {
  it('quien está en ambas listas aparece una vez, como admin', () => {
    const rows = workspacePeopleRows(['ana', 'karluiz'], ['karluiz'])
    expect(rows).toEqual([
      { login: 'karluiz', role: 'admin' },
      { login: 'ana', role: 'assignee' },
    ])
  })

  it('devuelve vacío sin personas', () => {
    expect(workspacePeopleRows([], [])).toEqual([])
  })
})

describe('matchesWorkspaceQuery', () => {
  const entry = { orgName: 'Rodrigo Anti', slug: 'rodrigoanti', name: 'covenant' }

  it('sin query pasa todo', () => {
    expect(matchesWorkspaceQuery(entry, '   ')).toBe(true)
  })

  it('busca en org, slug y nombre sin importar mayúsculas', () => {
    expect(matchesWorkspaceQuery(entry, 'COVE')).toBe(true)
    expect(matchesWorkspaceQuery(entry, 'rigo a')).toBe(true)
    expect(matchesWorkspaceQuery(entry, 'anti')).toBe(true)
    expect(matchesWorkspaceQuery(entry, 'groow')).toBe(false)
  })
})
