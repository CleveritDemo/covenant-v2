import { describe, expect, it } from 'vitest'
import {
  CONFIG_DEFAULTS,
  CONFIG_KEYS_OWNED_BY_MAIN,
  mergeWithDefaults,
} from '../configSchema'
import { parseJiraAccounts, sanitizeJiraAccountLabel } from '../jiraAccounts'

describe('sanitizeJiraAccountLabel', () => {
  it('recorta espacios y topea a 40 chars', () => {
    expect(sanitizeJiraAccountLabel('  Work  ')).toBe('Work')
    expect(sanitizeJiraAccountLabel('x'.repeat(50))).toBe('x'.repeat(40))
  })

  it('basura → vacío', () => {
    expect(sanitizeJiraAccountLabel(null)).toBe('')
    expect(sanitizeJiraAccountLabel(1)).toBe('')
    expect(sanitizeJiraAccountLabel('   ')).toBe('')
  })
})

describe('parseJiraAccounts', () => {
  it('descarta site http, site inválido, entradas sin email y duplicados por id', () => {
    expect(parseJiraAccounts([
      {
        id: 'a',
        label: 'Uno',
        site: 'https://one.atlassian.net',
        email: 'one@example.com',
      },
      {
        id: 'b',
        label: 'Http',
        site: 'http://bad.atlassian.net',
        email: 'bad@example.com',
      },
      {
        id: 'c',
        label: 'Invalid',
        site: 'no-es-una-url',
        email: 'c@example.com',
      },
      {
        id: 'd',
        label: 'Sin email',
        site: 'https://d.atlassian.net',
        email: '  ',
      },
      {
        id: 'a',
        label: 'Dup',
        site: 'https://dup.atlassian.net',
        email: 'dup@example.com',
      },
    ])).toEqual([
      {
        id: 'a',
        label: 'Uno',
        site: 'https://one.atlassian.net',
        email: 'one@example.com',
      },
    ])
  })

  it('normaliza el site', () => {
    expect(parseJiraAccounts([
      {
        id: 'x',
        label: 'X',
        site: 'HTTPS://X.Atlassian.net/',
        email: '  x@example.com  ',
      },
    ])).toEqual([
      {
        id: 'x',
        label: 'X',
        site: 'https://x.atlassian.net',
        email: 'x@example.com',
      },
    ])
  })

  it('no-array → lista vacía', () => {
    expect(parseJiraAccounts(undefined)).toEqual([])
    expect(parseJiraAccounts({ id: 'a', label: 'x' })).toEqual([])
  })
})

describe('AppConfig jiraAccounts', () => {
  it('defaults vacíos y merge sanea la lista', () => {
    expect(CONFIG_DEFAULTS.jiraAccounts).toEqual([])
    expect(CONFIG_DEFAULTS.jiraDefaultAccountId).toBe('')
    expect([...CONFIG_KEYS_OWNED_BY_MAIN]).toEqual([
      'githubAccounts',
      'githubDefaultAccountId',
      'jiraAccounts',
      'jiraDefaultAccountId',
    ])
    const merged = mergeWithDefaults({
      jiraAccounts: [
        {
          id: 'a',
          label: 'Uno',
          site: 'https://one.atlassian.net',
          email: 'one@example.com',
        },
        {
          id: 'a',
          label: 'Dup',
          site: 'https://dup.atlassian.net',
          email: 'dup@example.com',
        },
        { id: '', label: 'x', site: 'https://x.atlassian.net', email: 'x@example.com' },
      ],
      jiraDefaultAccountId: '  a  ',
    } as never)
    expect(merged.jiraAccounts).toEqual([
      {
        id: 'a',
        label: 'Uno',
        site: 'https://one.atlassian.net',
        email: 'one@example.com',
      },
    ])
    expect(merged.jiraDefaultAccountId).toBe('a')
  })
})
