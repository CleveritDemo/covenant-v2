import { describe, expect, it, beforeEach } from 'vitest'
import {
  clearActiveParentDelegation,
  peekActiveParentDelegation,
  rememberActiveParentDelegation,
  resetActiveParentDelegationsForTests,
} from '../agent/activeParentDelegation'

describe('activeParentDelegation', () => {
  beforeEach(() => {
    resetActiveParentDelegationsForTests()
  })

  it('remembers and peeks by pane', () => {
    rememberActiveParentDelegation('pane-1', {
      id: 'dlg-1',
      fromPaneId: 'orch',
      toAgentId: 'frontend',
    })
    expect(peekActiveParentDelegation('pane-1')).toEqual({
      id: 'dlg-1',
      fromPaneId: 'orch',
      toAgentId: 'frontend',
    })
    clearActiveParentDelegation('pane-1')
    expect(peekActiveParentDelegation('pane-1')).toBeNull()
  })
})
