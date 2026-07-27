import { describe, expect, it } from 'vitest'
import { decideParentDelegationNotify } from '../agent/parentDelegationNotify'

describe('decideParentDelegationNotify', () => {
  it('returns none when nothing is held', () => {
    expect(decideParentDelegationNotify({
      held: false,
      dispatchedNested: true,
    })).toBe('none')
    expect(decideParentDelegationNotify({
      held: false,
      dispatchedNested: false,
      aborted: true,
    })).toBe('none')
  })

  it('holds while nested delegations were dispatched', () => {
    expect(decideParentDelegationNotify({
      held: true,
      dispatchedNested: true,
    })).toBe('hold')
  })

  it('notifies when held and no nested dispatch', () => {
    expect(decideParentDelegationNotify({
      held: true,
      dispatchedNested: false,
    })).toBe('notify')
  })

  it('notifies immediately on abort even if nested were dispatched', () => {
    expect(decideParentDelegationNotify({
      held: true,
      dispatchedNested: true,
      aborted: true,
    })).toBe('notify')
  })
})
