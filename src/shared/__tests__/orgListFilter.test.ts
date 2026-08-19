import { describe, expect, it } from 'vitest'
import { filterOrgsByQuery, filterWorkspacesByQuery } from '../orgListFilter'

const orgs = [
  { name: 'Acme Corp', slug: 'acme' },
  { name: 'Beta Labs', slug: 'beta-labs' },
]

const workspaces = [
  { name: 'covenant' },
  { name: 'Pulse board' },
]

describe('filterOrgsByQuery', () => {
  it('devuelve la lista si la query está vacía o es solo espacios', () => {
    expect(filterOrgsByQuery(orgs, '')).toBe(orgs)
    expect(filterOrgsByQuery(orgs, '   ')).toBe(orgs)
  })

  it('compara name y slug sin distinguir mayúsculas', () => {
    expect(filterOrgsByQuery(orgs, 'ACME')).toEqual([orgs[0]])
    expect(filterOrgsByQuery(orgs, 'Beta-Labs')).toEqual([orgs[1]])
    expect(filterOrgsByQuery(orgs, 'labs')).toEqual([orgs[1]])
  })

  it('devuelve vacío si nada coincide', () => {
    expect(filterOrgsByQuery(orgs, 'zzz')).toEqual([])
  })
})

describe('filterWorkspacesByQuery', () => {
  it('devuelve la lista si la query está vacía o es solo espacios', () => {
    expect(filterWorkspacesByQuery(workspaces, '')).toBe(workspaces)
    expect(filterWorkspacesByQuery(workspaces, '\t  ')).toBe(workspaces)
  })

  it('compara name sin distinguir mayúsculas', () => {
    expect(filterWorkspacesByQuery(workspaces, 'PULSE')).toEqual([workspaces[1]])
  })

  it('devuelve vacío si nada coincide', () => {
    expect(filterWorkspacesByQuery(workspaces, 'zzz')).toEqual([])
  })
})
