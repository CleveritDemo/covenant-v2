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

  it('remembers and peeks by pane + thread runKey', () => {
    rememberActiveParentDelegation('pane-1', 'thread-a', {
      id: 'dlg-1',
      fromPaneId: 'orch',
      toAgentId: 'frontend',
      orchestrationJobId: 'job-1',
    })
    expect(peekActiveParentDelegation('pane-1', 'thread-a')).toEqual({
      id: 'dlg-1',
      fromPaneId: 'orch',
      toAgentId: 'frontend',
      orchestrationJobId: 'job-1',
      threadId: 'thread-a',
    })
    expect(peekActiveParentDelegation('pane-1', 'thread-b')).toBeNull()
    clearActiveParentDelegation('pane-1', 'thread-a')
    expect(peekActiveParentDelegation('pane-1', 'thread-a')).toBeNull()
  })

  it('aisla holds por carril en el mismo pane', () => {
    rememberActiveParentDelegation('pane-1', 'lane-1', {
      id: 'dlg-1',
      fromPaneId: 'orch',
      toAgentId: 'frontend',
      orchestrationJobId: 'job-1',
    })
    rememberActiveParentDelegation('pane-1', 'lane-2', {
      id: 'dlg-2',
      fromPaneId: 'orch',
      toAgentId: 'backend',
      orchestrationJobId: 'job-1',
    })
    expect(peekActiveParentDelegation('pane-1', 'lane-1')?.id).toBe('dlg-1')
    expect(peekActiveParentDelegation('pane-1', 'lane-2')?.id).toBe('dlg-2')
    clearActiveParentDelegation('pane-1', 'lane-1')
    expect(peekActiveParentDelegation('pane-1', 'lane-1')).toBeNull()
    expect(peekActiveParentDelegation('pane-1', 'lane-2')?.id).toBe('dlg-2')
  })
})
