import { describe, expect, it } from 'vitest'
import {
  buildAiAgentDelegateInstruction,
  buildAiAgentProductOwnerInstruction,
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
    const { visibleText, delegations, issues } = extractAiAgentDelegates(
      'Hi\n```ia-terminal-delegate\n{bad}\n```\n',
    )
    expect(delegations).toEqual([])
    expect(visibleText).toContain('Hi')
    expect(visibleText).not.toContain('ia-terminal-delegate')
    expect(issues).toEqual([
      expect.objectContaining({ reason: 'invalid_json' }),
    ])
  })

  it('merges two valid fences up to the per-turn cap', () => {
    const fence = (objective: string) => [
      '```ia-terminal-delegate',
      JSON.stringify({
        delegations: [{ toAgentId: 'qa', objective }],
      }),
      '```',
    ].join('\n')
    const raw = ['First.', fence('task one'), 'Second.', fence('task two')].join('\n')
    const { visibleText, delegations, issues } = extractAiAgentDelegates(raw)
    expect(visibleText).toContain('First.')
    expect(visibleText).toContain('Second.')
    expect(visibleText).not.toContain('ia-terminal-delegate')
    expect(delegations).toHaveLength(2)
    expect(delegations[0]).toMatchObject({ objective: 'task one' })
    expect(delegations[1]).toMatchObject({ objective: 'task two' })
    expect(issues).toEqual([])
  })
})

describe('buildAiAgentDelegateInstruction', () => {
  it('documents the fence name', () => {
    expect(buildAiAgentDelegateInstruction()).toContain('ia-terminal-delegate')
  })

  it('front-loads objective style with a one-line imperative example', () => {
    const text = buildAiAgentDelegateInstruction({ allowedAgentIds: ['qa'] })
    expect(text).toContain('Front-load the objective')
    expect(text).toContain('FIRST LINE = imperative TL;DR')
    expect(text).toContain('long detail')
    expect(text).toContain('4000 chars')
    expect(text).toContain(
      '"objective": "Verify login fails on bad password and report the failing assert."',
    )
  })

  it('includes stop conditions and wave cap', () => {
    const text = buildAiAgentDelegateInstruction({ round: 1, maxRounds: 3 })
    expect(text).toContain('1/3')
    expect(text).toContain('Stop delegating when')
  })

  it('uses unlimited wording when maxRounds is 0', () => {
    const text = buildAiAgentDelegateInstruction({ round: 2, maxRounds: 0 })
    expect(text).toContain('2/∞')
    expect(text).toContain('no host wave cap')
    expect(text).not.toContain('At most 0')
  })

  it('disables fences when allowDelegations is false', () => {
    const text = buildAiAgentDelegateInstruction({ allowDelegations: false })
    expect(text).toContain('DISABLED')
    expect(text).toContain('Do NOT emit')
    expect(text).not.toContain('"delegations"')
  })

  it('documents worktrees and parallel lanes', () => {
    const base = buildAiAgentDelegateInstruction({ allowedAgentIds: ['frontend'] })
    expect(base).toContain('git worktrees')
    expect(base).toContain('Parallel lanes')
    expect(base).toContain('agentId#2')
    const withoutLanes = buildAiAgentDelegateInstruction({
      allowedAgentIds: ['frontend'],
      allowParallelLanes: false,
    })
    expect(withoutLanes).not.toContain('Parallel lanes')
  })

  it('injects turbo job guidance with parallel lane wording', () => {
    const text = buildAiAgentDelegateInstruction({
      allowedAgentIds: ['frontend'],
      workStyle: 'turbo',
      orchestrationJobId: 'job-abc',
      maxRounds: 3,
    })
    expect(text).toContain('Work style: turbo')
    expect(text).toContain('job-abc')
    expect(text).toContain('Parallel lanes')
    expect(text).toContain('per job/user message')
  })
})

describe('buildAiAgentProductOwnerInstruction', () => {
  it('documents continuous delivery of the user request and allowed agent ids', () => {
    const text = buildAiAgentProductOwnerInstruction({
      allowedAgentIds: ['example-tl'],
    })
    expect(text).toContain('ia-terminal-delegate')
    expect(text).toContain('product owner')
    expect(text).toContain('example-tl')
    expect(text).toContain('do NOT write code')
    expect(text).toContain("user's initial request")
    expect(text).toContain('Do not invent unrelated product features')
    expect(text).toContain('toward the user request')
    expect(text).toContain('contexts')
    expect(text).toContain('FORBIDDEN')
    expect(text).toContain('¿seguimos?')
    expect(text).toContain('Front-load the objective')
    expect(text).toContain('FIRST LINE = imperative TL;DR')
    expect(text).toContain('long detail')
    expect(text).toContain('4000 chars')
    expect(text).toContain(
      '"objective": "Ship the next slice of the user request: …"',
    )
    expect(text).not.toContain('Invent and prioritize valuable improvements')
    expect(text).not.toContain('When the goal is met, reply to the user and do NOT emit')
  })

  it('disables fences when allowDelegations is false', () => {
    const text = buildAiAgentProductOwnerInstruction({ allowDelegations: false })
    expect(text).toContain('DISABLED')
    expect(text).toContain('Do NOT emit')
  })

  it('omits host wave cap when maxRounds is unlimited', () => {
    const text = buildAiAgentProductOwnerInstruction({ round: 5, maxRounds: 0 })
    expect(text).toContain('5/∞')
    expect(text).toContain('no host wave cap')
    expect(text).not.toContain('wave cap is reached')
    expect(text).not.toContain('waves remain')
  })
})
