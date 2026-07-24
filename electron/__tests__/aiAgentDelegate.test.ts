import { describe, expect, it } from 'vitest'
import {
  buildAiAgentDelegateInstruction,
  extractAiAgentDelegates,
} from '../aiAgentDelegate'

describe('extractAiAgentDelegates', () => {
  it('strips fence and returns sanitized delegations', () => {
    const raw = [
      'I will ask QA to verify.',
      '```ia-terminal-delegate',
      JSON.stringify({
        delegations: [
          { toAgentId: 'qa', objective: ' Run the suite ' },
        ],
      }),
      '```',
      'Waiting.',
    ].join('\n')
    const { visibleText, delegations } = extractAiAgentDelegates(raw)
    expect(visibleText).toContain('I will ask QA')
    expect(visibleText).not.toContain('ia-terminal-delegate')
    expect(delegations).toHaveLength(1)
    expect(delegations[0]).toMatchObject({
      toAgentId: 'qa',
      objective: 'Run the suite',
    })
  })

  it('ignores invalid JSON fences', () => {
    const { visibleText, delegations } = extractAiAgentDelegates(
      'Hi\n```ia-terminal-delegate\n{bad}\n```\n',
    )
    expect(delegations).toEqual([])
    expect(visibleText).toContain('Hi')
  })
})

describe('buildAiAgentDelegateInstruction', () => {
  it('documents the fence name', () => {
    expect(buildAiAgentDelegateInstruction()).toContain('ia-terminal-delegate')
  })

  it('includes stop conditions and wave cap', () => {
    const text = buildAiAgentDelegateInstruction({ round: 1, maxRounds: 3 })
    expect(text).toContain('1/3')
    expect(text).toContain('Stop delegating when')
  })

  it('disables fences when allowDelegations is false', () => {
    const text = buildAiAgentDelegateInstruction({ allowDelegations: false })
    expect(text).toContain('DISABLED')
    expect(text).toContain('Do NOT emit')
    expect(text).not.toContain('"delegations"')
  })
})
