import { describe, expect, it } from 'vitest'
import {
  AGENT_NAME_MAX_LENGTH,
  applyAgentIdentityDraft,
  buildAgentIdentityPrompt,
  normalizeAgentRules,
  sanitizeAgentMonogram,
  sanitizeAgentRulesDraft,
  sanitizeAgentTextDraft,
} from '../agentIdentity'

describe('sanitizeAgentTextDraft', () => {
  it('keeps draft spaces and only drops blank values', () => {
    expect(sanitizeAgentTextDraft(undefined, AGENT_NAME_MAX_LENGTH)).toBeUndefined()
    expect(sanitizeAgentTextDraft('   ', AGENT_NAME_MAX_LENGTH)).toBeUndefined()
    expect(sanitizeAgentTextDraft('Hello ', AGENT_NAME_MAX_LENGTH)).toBe('Hello ')
    expect(sanitizeAgentTextDraft('x'.repeat(80), AGENT_NAME_MAX_LENGTH)).toHaveLength(
      AGENT_NAME_MAX_LENGTH,
    )
  })
})

describe('sanitizeAgentRulesDraft', () => {
  it('keeps empty slots for UI drafts and caps length/count', () => {
    expect(sanitizeAgentRulesDraft(undefined)).toEqual([])
    expect(sanitizeAgentRulesDraft(['  a  ', '', '  '])).toEqual(['  a  ', '', '  '])
    expect(sanitizeAgentRulesDraft(['x'.repeat(400)])[0]).toHaveLength(280)
  })
})

describe('sanitizeAgentMonogram', () => {
  it('deja 2 caracteres alfanuméricos en mayúsculas', () => {
    expect(sanitizeAgentMonogram('tl')).toBe('TL')
    expect(sanitizeAgentMonogram('be!')).toBe('BE')
    expect(sanitizeAgentMonogram('Frontend')).toBe('FR')
    expect(sanitizeAgentMonogram('ñ1')).toBe('Ñ1')
  })

  it('descarta lo que no deja glifos usables', () => {
    expect(sanitizeAgentMonogram(undefined)).toBeUndefined()
    expect(sanitizeAgentMonogram('  ')).toBeUndefined()
    expect(sanitizeAgentMonogram('🐛')).toBeUndefined()
    expect(sanitizeAgentMonogram(42)).toBeUndefined()
  })
})

describe('applyAgentIdentityDraft', () => {
  it('trims once on commit and clears blank identity fields', () => {
    expect(applyAgentIdentityDraft(
      { name: 'Old', role: 'Old role', objective: 'Old obj', rules: ['keep'] },
      {
        id: 'scout',
        name: '  Scout  ',
        monogram: '',
        role: '   ',
        objective: ' Ship it ',
        rules: ['  Always verify  ', '', '  '],
      },
    )).toEqual({
      name: 'Scout',
      objective: 'Ship it',
      rules: ['Always verify'],
    })
  })

  it('normaliza el monograma del borrador y lo borra si queda vacío', () => {
    const previous = { name: 'Old', monogram: 'TL' }
    const base = { id: 'tl', role: '', objective: '', rules: [] }
    expect(applyAgentIdentityDraft(previous, {
      ...base,
      name: 'Tech Lead',
      monogram: 'b e',
    })).toEqual({ name: 'Tech Lead', monogram: 'BE' })
    expect(applyAgentIdentityDraft(previous, {
      ...base,
      name: 'Tech Lead',
      monogram: '  ',
    })).toEqual({ name: 'Tech Lead' })
  })
})

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
