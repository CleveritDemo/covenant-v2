import { describe, expect, it } from 'vitest'
import { shouldResumeCliSessionForTurn } from '../shouldResumeCliSessionForTurn'

describe('shouldResumeCliSessionForTurn', () => {
  it('returns false when orchestrator delegation is present', () => {
    expect(shouldResumeCliSessionForTurn({
      delegation: { id: 'd1', fromPaneId: 'orch', toAgentId: 'spec' },
    })).toBe(false)
  })

  it('returns true for human turns (no delegation)', () => {
    expect(shouldResumeCliSessionForTurn({})).toBe(true)
  })

  it('returns true when delegation is explicitly undefined', () => {
    expect(shouldResumeCliSessionForTurn({ delegation: undefined })).toBe(true)
  })
})
