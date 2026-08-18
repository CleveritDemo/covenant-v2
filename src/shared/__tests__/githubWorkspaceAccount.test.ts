import { describe, expect, it } from 'vitest'
import { parseWorkspaceAccount } from '../githubWorkspaceAccount'

describe('parseWorkspaceAccount', () => {
  it('lee un accountId no vacío', () => {
    expect(parseWorkspaceAccount({ accountId: '  acc-1  ' })).toEqual({ accountId: 'acc-1' })
  })

  it('JSON roto o sin id → null', () => {
    expect(parseWorkspaceAccount(null)).toBeNull()
    expect(parseWorkspaceAccount('acc-1')).toBeNull()
    expect(parseWorkspaceAccount({ accountId: '  ' })).toBeNull()
    expect(parseWorkspaceAccount({ id: 'acc-1' })).toBeNull()
  })
})
