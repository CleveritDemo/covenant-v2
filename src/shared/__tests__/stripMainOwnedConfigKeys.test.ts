import { describe, expect, it } from 'vitest'
import {
  CONFIG_KEYS_OWNED_BY_MAIN,
  stripMainOwnedConfigKeys,
} from '../configSchema'

describe('stripMainOwnedConfigKeys', () => {
  it('githubAccounts:[] y githubDefaultAccountId no viajan; el resto sí', () => {
    const partial = {
      githubAccounts: [] as { id: string; label: string }[],
      githubDefaultAccountId: '',
      jiraAccounts: [] as { id: string; label: string; site: string; email: string }[],
      jiraDefaultAccountId: '',
      themeId: 'dark',
      fontSize: 16,
    }
    const stripped = stripMainOwnedConfigKeys(partial)
    expect(stripped).toEqual({ themeId: 'dark', fontSize: 16 })
    expect('githubAccounts' in stripped).toBe(false)
    expect('githubDefaultAccountId' in stripped).toBe(false)
    expect('jiraAccounts' in stripped).toBe(false)
    expect('jiraDefaultAccountId' in stripped).toBe(false)
  })

  it('no muta la entrada', () => {
    const partial = {
      githubAccounts: [{ id: 'a', label: 'Uno' }],
      githubDefaultAccountId: 'a',
      fontSize: 14,
    }
    const snapshot = structuredClone(partial)
    stripMainOwnedConfigKeys(partial)
    expect(partial).toEqual(snapshot)
  })

  it('CONFIG_KEYS_OWNED_BY_MAIN son las claves del llavero', () => {
    expect([...CONFIG_KEYS_OWNED_BY_MAIN]).toEqual([
      'githubAccounts',
      'githubDefaultAccountId',
      'jiraAccounts',
      'jiraDefaultAccountId',
    ])
  })
})
