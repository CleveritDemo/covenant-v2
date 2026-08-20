import { describe, expect, it } from 'vitest'
import { parseJiraWorkspaceAccount } from '../jiraWorkspaceAccount'

describe('parseJiraWorkspaceAccount', () => {
  it('lee un accountId no vacío', () => {
    expect(parseJiraWorkspaceAccount({ accountId: '  acc-1  ' })).toEqual({ accountId: 'acc-1' })
  })

  it('JSON roto o sin id → null', () => {
    expect(parseJiraWorkspaceAccount(null)).toBeNull()
    expect(parseJiraWorkspaceAccount('acc-1')).toBeNull()
    expect(parseJiraWorkspaceAccount({ accountId: '  ' })).toBeNull()
    expect(parseJiraWorkspaceAccount({ id: 'acc-1' })).toBeNull()
  })
})
