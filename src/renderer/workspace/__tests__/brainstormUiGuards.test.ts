import { describe, expect, it } from 'vitest'
import {
  canAdvanceBrainstormInviteStep,
  tryCreateBrainstormSession,
} from '../brainstormUiGuards'

describe('BrainstormRoomModal guards', () => {
  it('does not advance invite step with fewer than 2 agents', () => {
    expect(canAdvanceBrainstormInviteStep([])).toBe(false)
    expect(canAdvanceBrainstormInviteStep(['a'])).toBe(false)
    expect(canAdvanceBrainstormInviteStep(['a', 'b'])).toBe(true)
  })

  it('does not start with empty topic or fewer than 2 agents', () => {
    expect(tryCreateBrainstormSession('', ['a', 'b'])).toBeNull()
    expect(tryCreateBrainstormSession('   ', ['a', 'b'])).toBeNull()
    expect(tryCreateBrainstormSession('topic', ['a'])).toBeNull()
    const room = tryCreateBrainstormSession('Ship UX', ['a', 'b'], 3)
    expect(room).not.toBeNull()
    expect(room?.topic).toBe('Ship UX')
    expect(room?.participantAgentIds).toEqual(['a', 'b'])
  })
})
