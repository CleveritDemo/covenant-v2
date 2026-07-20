import { describe, expect, it } from 'vitest'
import { buildAgentIdentityPrompt } from '../agentIdentity'

describe('buildAgentIdentityPrompt', () => {
  it('returns empty when all fields are blank', () => {
    expect(buildAgentIdentityPrompt({})).toBe('')
    expect(buildAgentIdentityPrompt({ name: '  ', role: '', objective: '\n' })).toBe('')
  })

  it('includes only set fields', () => {
    expect(buildAgentIdentityPrompt({ name: 'Architect' })).toContain('- Name: Architect')
    expect(buildAgentIdentityPrompt({ name: 'Architect' })).not.toContain('- Role:')
    expect(buildAgentIdentityPrompt({
      name: 'Reviewer',
      role: 'Code review',
      objective: 'Catch regressions',
    })).toBe([
      '## Agent identity',
      'You are this agent. Follow this identity in every reply and action.',
      '- Name: Reviewer',
      '- Role: Code review',
      '- Objective: Catch regressions',
    ].join('\n'))
  })
})
