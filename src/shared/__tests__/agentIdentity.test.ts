import { describe, expect, it } from 'vitest'
import { buildAgentIdentityPrompt, normalizeAgentRules } from '../agentIdentity'

describe('normalizeAgentRules', () => {
  it('trims, drops empties and caps length/count', () => {
    expect(normalizeAgentRules(undefined)).toEqual([])
    expect(normalizeAgentRules(['  a  ', '', '  ', 'b'])).toEqual(['a', 'b'])
    expect(normalizeAgentRules(['x'.repeat(400)])[0]).toHaveLength(280)
  })
})

describe('buildAgentIdentityPrompt', () => {
  it('returns empty when all fields are blank', () => {
    expect(buildAgentIdentityPrompt({})).toBe('')
    expect(buildAgentIdentityPrompt({ name: '  ', role: '', objective: '\n', rules: ['  '] })).toBe('')
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

  it('appends numbered rules when present', () => {
    const prompt = buildAgentIdentityPrompt({
      name: 'QA',
      rules: ['Always verify in code', '  Reply in Spanish  ', ''],
    })
    expect(prompt).toContain('- Rules:')
    expect(prompt).toContain('  1. Always verify in code')
    expect(prompt).toContain('  2. Reply in Spanish')
    expect(prompt).not.toContain('  3.')
  })
})
