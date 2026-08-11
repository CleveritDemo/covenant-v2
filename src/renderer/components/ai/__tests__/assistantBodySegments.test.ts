import { describe, expect, it } from 'vitest'
import {
  splitAssistantBody,
  stripAgentControlFences,
} from '../assistantBodySegments'

const OPEN_DELEGATE = [
  'Visible.',
  '```ia-terminal-delegate',
  '{"delegations":[{"agentId":"a1","prompt":"do it"}]}',
].join('\n')

describe('stripAgentControlFences', () => {
  it('keeps open ia-terminal-delegate when keepDelegateFences is true', () => {
    const stripped = stripAgentControlFences(OPEN_DELEGATE, { keepDelegateFences: true })
    expect(stripped).toContain('```ia-terminal-delegate')
    expect(stripped).toContain('"delegations"')
    const segments = splitAssistantBody(stripped)
    const code = segments.find((s) => s.type === 'code')
    expect(code).toEqual({
      type: 'code',
      lang: 'ia-terminal-delegate',
      content: '{"delegations":[{"agentId":"a1","prompt":"do it"}]}',
    })
  })

  it('strips ia-terminal-delegate when keepDelegateFences is false/absent', () => {
    expect(stripAgentControlFences(OPEN_DELEGATE)).not.toContain('ia-terminal-delegate')
    expect(stripAgentControlFences(OPEN_DELEGATE)).not.toContain('"delegations"')
    expect(
      stripAgentControlFences(OPEN_DELEGATE, { keepDelegateFences: false }),
    ).not.toContain('ia-terminal-delegate')
  })

  it('still strips ia-terminal-results when keepDelegateFences is true', () => {
    const mixed = [
      'Hi',
      '```ia-terminal-results',
      '{"summary":"hidden"}',
      '```',
      '```ia-terminal-delegate',
      '{"delegations":[]}',
    ].join('\n')
    const stripped = stripAgentControlFences(mixed, { keepDelegateFences: true })
    expect(stripped).not.toContain('ia-terminal-results')
    expect(stripped).not.toContain('"summary":"hidden"')
    expect(stripped).toContain('```ia-terminal-delegate')
    expect(stripped).toContain('"delegations":[]')
  })
})
