import { describe, expect, it } from 'vitest'
import { resolveCovenantAccountId } from '../covenantAccountId'

describe('resolveCovenantAccountId', () => {
  it('vacío o solo espacios → githubDefaultAccountId', () => {
    const accounts = [{ id: 'acc-1', label: 'Uno' }]
    expect(resolveCovenantAccountId('', { githubDefaultAccountId: 'acc-1', githubAccounts: accounts })).toEqual({
      ok: true,
      accountId: 'acc-1',
    })
    expect(resolveCovenantAccountId('  ', { githubDefaultAccountId: 'acc-1', githubAccounts: accounts })).toEqual({
      ok: true,
      accountId: 'acc-1',
    })
  })

  it("default sin llavero → literal 'default'", () => {
    expect(resolveCovenantAccountId('', { githubDefaultAccountId: '', githubAccounts: [] })).toEqual({
      ok: true,
      accountId: 'default',
    })
    expect(resolveCovenantAccountId('default', { githubDefaultAccountId: '', githubAccounts: [] })).toEqual({
      ok: true,
      accountId: 'default',
    })
  })

  it('id que no está en githubAccounts → unknown-account', () => {
    expect(
      resolveCovenantAccountId('ghost', {
        githubDefaultAccountId: 'acc-1',
        githubAccounts: [{ id: 'acc-1', label: 'Uno' }],
      }),
    ).toEqual({ ok: false, error: 'unknown-account' })
  })
})
