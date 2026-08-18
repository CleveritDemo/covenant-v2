import { describe, expect, it } from 'vitest'
import { CONFIG_DEFAULTS, mergeWithDefaults } from '../configSchema'
import { parseGithubAccounts, sanitizeAccountLabel } from '../githubAccounts'

describe('sanitizeAccountLabel', () => {
  it('recorta espacios y topea a 40 chars', () => {
    expect(sanitizeAccountLabel('  Work  ')).toBe('Work')
    expect(sanitizeAccountLabel('x'.repeat(50))).toBe('x'.repeat(40))
  })

  it('basura → vacío', () => {
    expect(sanitizeAccountLabel(null)).toBe('')
    expect(sanitizeAccountLabel(1)).toBe('')
    expect(sanitizeAccountLabel('   ')).toBe('')
  })
})

describe('parseGithubAccounts', () => {
  it('descarta entradas sin id o sin label tras trim', () => {
    expect(parseGithubAccounts([
      { id: 'a', label: 'Uno' },
      { id: '', label: 'Vacío' },
      { id: 'b', label: '  ' },
      { id: '  c  ', label: '  Tres  ' },
      { label: 'sin id' },
      { id: 'd' },
      null,
      'x',
    ])).toEqual([
      { id: 'a', label: 'Uno' },
      { id: 'c', label: 'Tres' },
    ])
  })

  it('dedupe por id conservando el primero', () => {
    expect(parseGithubAccounts([
      { id: 'a', label: 'Primero' },
      { id: 'a', label: 'Segundo' },
      { id: 'b', label: 'Otro' },
    ])).toEqual([
      { id: 'a', label: 'Primero' },
      { id: 'b', label: 'Otro' },
    ])
  })

  it('no-array → lista vacía', () => {
    expect(parseGithubAccounts(undefined)).toEqual([])
    expect(parseGithubAccounts({ id: 'a', label: 'x' })).toEqual([])
  })
})

describe('AppConfig githubAccounts', () => {
  it('defaults vacíos y merge sanea la lista', () => {
    expect(CONFIG_DEFAULTS.githubAccounts).toEqual([])
    expect(CONFIG_DEFAULTS.githubDefaultAccountId).toBe('')
    const merged = mergeWithDefaults({
      githubAccounts: [{ id: 'a', label: 'Uno' }, { id: 'a', label: 'Dup' }, { id: '', label: 'x' }],
      githubDefaultAccountId: '  a  ',
    } as never)
    expect(merged.githubAccounts).toEqual([{ id: 'a', label: 'Uno' }])
    expect(merged.githubDefaultAccountId).toBe('a')
    expect(merged.githubToken).toBe('')
  })
})
