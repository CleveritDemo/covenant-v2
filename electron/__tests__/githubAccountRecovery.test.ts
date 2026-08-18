import { describe, expect, it } from 'vitest'
import { adoptOrphanAccounts } from '../githubAccountRecovery'

describe('adoptOrphanAccounts', () => {
  it('dos ids huérfanos → Cuenta 1 y Cuenta 2', () => {
    const result = adoptOrphanAccounts([], '', ['id-a', 'id-b'])
    expect(result.accounts).toEqual([
      { id: 'id-a', label: 'Cuenta 1' },
      { id: 'id-b', label: 'Cuenta 2' },
    ])
    expect(result.defaultAccountId).toBe('id-a')
    expect(result.changed).toBe(true)
  })

  it('segunda pasada no cambia nada', () => {
    const first = adoptOrphanAccounts([], '', ['id-a', 'id-b'])
    const second = adoptOrphanAccounts(
      first.accounts,
      first.defaultAccountId,
      ['id-a', 'id-b'],
    )
    expect(second.changed).toBe(false)
    expect(second.accounts).toEqual(first.accounts)
    expect(second.defaultAccountId).toBe(first.defaultAccountId)
  })

  it('default vacío se rellena con la primera cuenta', () => {
    const accounts = [{ id: 'keep', label: 'Work' }]
    const result = adoptOrphanAccounts(accounts, '', [])
    expect(result.accounts).toEqual(accounts)
    expect(result.defaultAccountId).toBe('keep')
    expect(result.changed).toBe(true)
  })

  it('ids ya presentes no se duplican', () => {
    const accounts = [{ id: 'id-a', label: 'Work' }]
    const result = adoptOrphanAccounts(accounts, 'id-a', ['id-a', 'id-b'])
    expect(result.accounts).toEqual([
      { id: 'id-a', label: 'Work' },
      { id: 'id-b', label: 'Cuenta 1' },
    ])
    expect(result.defaultAccountId).toBe('id-a')
    expect(result.changed).toBe(true)
  })
})
