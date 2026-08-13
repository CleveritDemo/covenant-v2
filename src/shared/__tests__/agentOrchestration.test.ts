import { describe, expect, it } from 'vitest'
import {
  buildOrchestratorAgentsBlock,
  buildOrchestratorTurboWorkStyleBlock,
  buildBatchedDelegationFollowUp,
  coordinationCanDelegate,
  formatDelegationResultFollowUp,
  formatDelegationRoundCapFollowUp,
  formatOrchestrationRoundLabel,
  isOrchestrator,
  isProductOwner,
  isOrchestrationRoundsUnlimited,
  listProductOwnerTargets,
  listDelegationTargets,
  defaultDelegateToPolicy,
  sanitizeDelegateToPolicy,
  persistableDelegateTo,
  resolveDelegateToPolicy,
  MAX_ORCHESTRATION_ROUNDS,
  ORCHESTRATION_MAX_ROUNDS_CAP,
  ORCHESTRATION_UNLIMITED_ROUNDS,
  orchestrationFollowUpKey,
  orchestrationRoundsAtCap,
  parseDelegatePayload,
  resolveOrchestrationMaxRounds,
  sanitizeAgentCoordination,
  sanitizeDelegateRequest,
  sanitizeOrchestrationMaxRounds,
  shouldWakeOrchestratorOnDelegationComplete,
  DELEGATE_OBJECTIVE_MAX_LENGTH,
} from '../agentOrchestration'

describe('sanitizeOrchestrationMaxRounds', () => {
  it('defaults, clamps, truncates, and keeps unlimited sentinel 0', () => {
    expect(sanitizeOrchestrationMaxRounds(undefined)).toBe(MAX_ORCHESTRATION_ROUNDS)
    expect(sanitizeOrchestrationMaxRounds('')).toBe(MAX_ORCHESTRATION_ROUNDS)
    expect(sanitizeOrchestrationMaxRounds(0)).toBe(ORCHESTRATION_UNLIMITED_ROUNDS)
    expect(sanitizeOrchestrationMaxRounds('0')).toBe(ORCHESTRATION_UNLIMITED_ROUNDS)
    expect(sanitizeOrchestrationMaxRounds(-2)).toBe(MAX_ORCHESTRATION_ROUNDS)
    expect(sanitizeOrchestrationMaxRounds(99)).toBe(ORCHESTRATION_MAX_ROUNDS_CAP)
    expect(sanitizeOrchestrationMaxRounds(4.9)).toBe(4)
    expect(resolveOrchestrationMaxRounds(7)).toBe(7)
    expect(isOrchestrationRoundsUnlimited(0)).toBe(true)
    expect(isOrchestrationRoundsUnlimited(3)).toBe(false)
  })
})

describe('orchestrationRoundsAtCap', () => {
  it('is never at cap when unlimited', () => {
    expect(orchestrationRoundsAtCap(1, 0)).toBe(false)
    expect(orchestrationRoundsAtCap(99, ORCHESTRATION_UNLIMITED_ROUNDS)).toBe(false)
  })

  it('uses round >= maxRounds for finite caps', () => {
    expect(orchestrationRoundsAtCap(2, 3)).toBe(false)
    expect(orchestrationRoundsAtCap(3, 3)).toBe(true)
    expect(orchestrationRoundsAtCap(4, 3)).toBe(true)
  })
})

describe('sanitizeAgentCoordination', () => {
  it('accepts orchestrator, productOwner, and defaults to none', () => {
    expect(sanitizeAgentCoordination('orchestrator')).toBe('orchestrator')
    expect(sanitizeAgentCoordination('productOwner')).toBe('productOwner')
    expect(sanitizeAgentCoordination('none')).toBe('none')
    expect(sanitizeAgentCoordination(undefined)).toBe('none')
  })
})

describe('coordination helpers', () => {
  it('detects orchestrator and product owner', () => {
    expect(isOrchestrator('orchestrator')).toBe(true)
    expect(isProductOwner('productOwner')).toBe(true)
    expect(coordinationCanDelegate('orchestrator')).toBe(true)
    expect(coordinationCanDelegate('productOwner')).toBe(true)
    expect(coordinationCanDelegate('none')).toBe(false)
  })
})

describe('listProductOwnerTargets', () => {
  it('includes only orchestrators; excludes specialists and PO', () => {
    const targets = listProductOwnerTargets([
      {
        paneId: 'p-po',
        meta: { id: 'po', coordination: 'productOwner', name: 'PO' },
      },
      {
        paneId: 'p-tl',
        meta: {
          id: 'example-tl',
          coordination: 'orchestrator',
          name: 'TL',
          role: 'Tech lead',
        },
      },
      {
        paneId: 'p-pd',
        meta: { id: 'product-designer', name: 'Designer' },
      },
      {
        paneId: 'p-fs',
        meta: { id: 'fullstack', name: 'Fullstack' },
      },
      {
        paneId: 'p-qa',
        meta: { id: 'qa', name: 'QA' },
      },
      {
        paneId: 'p-pd-off',
        meta: {
          id: 'product-designer',
          name: 'Designer off',
          acceptDelegations: false,
        },
      },
    ], 'p-po')
    expect(targets).toEqual([
      {
        agentId: 'example-tl',
        paneId: 'p-tl',
        name: 'TL',
        role: 'Tech lead',
      },
    ])
  })
})

describe('delegateTo policy', () => {
  it('defaults and omits equals-default on persist', () => {
    expect(defaultDelegateToPolicy('orchestrator')).toEqual({ agentIds: ['*'] })
    expect(defaultDelegateToPolicy('productOwner')).toEqual({
      coordinations: ['orchestrator'],
    })
    expect(persistableDelegateTo('orchestrator', { agentIds: ['*'] })).toBeUndefined()
    expect(persistableDelegateTo('productOwner', {
      agentIds: ['qa'],
      coordinations: ['orchestrator'],
    })).toBeUndefined()
    expect(sanitizeDelegateToPolicy({ agentIds: ['QA', 'qa'] })?.agentIds).toEqual(['QA'])
  })

  it('productOwner resolve ignores override', () => {
    expect(resolveDelegateToPolicy('productOwner', { agentIds: ['*'] })).toEqual({
      coordinations: ['orchestrator'],
    })
  })

  it('listDelegationTargets honors custom agentIds for orchestrator', () => {
    const targets = listDelegationTargets(
      [
        { paneId: 'p1', meta: { id: 'qa', name: 'QA' } },
        { paneId: 'p2', meta: { id: 'fullstack', name: 'FS' } },
      ],
      { coordination: 'orchestrator', delegateTo: { agentIds: ['qa'] } },
      'p0',
    )
    expect(targets).toEqual([{ agentId: 'qa', paneId: 'p1', name: 'QA' }])
  })

  it('orchestrator star matches specialists only', () => {
    const panes = [
      { paneId: 'p-tl', meta: { id: 'tl', coordination: 'orchestrator' as const, name: 'TL' } },
      { paneId: 'p-qa', meta: { id: 'qa', name: 'QA' } },
      { paneId: 'p-fs', meta: { id: 'fullstack', name: 'FS' } },
    ]
    const targets = listDelegationTargets(
      panes,
      { coordination: 'orchestrator', delegateTo: { agentIds: ['*'] } },
      'p0',
    )
    expect(targets.map(t => t.agentId).sort()).toEqual(['fullstack', 'qa'])
  })
})

describe('parseDelegatePayload', () => {
  it('parses delegations array and caps count', () => {
    const parsed = parseDelegatePayload({
      delegations: [
        { toAgentId: 'qa', objective: ' Check tests ' },
        { agentId: 'fullstack', objective: 'Implement feature' },
        { toAgentId: 'x', objective: '' },
      ],
    })
    expect(parsed).toHaveLength(2)
    expect(parsed[0]).toMatchObject({ toAgentId: 'qa', objective: 'Check tests' })
    expect(parsed[1]?.toAgentId).toBe('fullstack')
    expect(parsed[0]?.id).toBeTruthy()
  })

  it('accepts a bare array', () => {
    expect(parseDelegatePayload([
      { toAgentId: 'qa', objective: 'Go' },
    ])).toEqual([
      expect.objectContaining({ toAgentId: 'qa', objective: 'Go' }),
    ])
  })
})

describe('sanitizeDelegateRequest', () => {
  it('rejects incomplete payloads', () => {
    expect(sanitizeDelegateRequest({})).toBeNull()
    expect(sanitizeDelegateRequest({ toAgentId: 'qa' })).toBeNull()
  })

  it('trims and truncates objective to DELEGATE_OBJECTIVE_MAX_LENGTH (4000)', () => {
    expect(DELEGATE_OBJECTIVE_MAX_LENGTH).toBe(4000)
    const long = `  ${'x'.repeat(4500)}  `
    const sanitized = sanitizeDelegateRequest({ toAgentId: 'qa', objective: long })
    expect(sanitized?.objective).toHaveLength(4000)
    expect(sanitized?.objective).toBe('x'.repeat(4000))
    expect(sanitized?.objective.startsWith(' ')).toBe(false)
    expect(sanitized?.objective.endsWith(' ')).toBe(false)
  })
})

describe('buildOrchestratorAgentsBlock', () => {
  it('lists agents with roles', () => {
    const block = buildOrchestratorAgentsBlock([
      { agentId: 'qa', paneId: 'p1', name: 'QA', role: 'Tester' },
    ])
    expect(block).toContain('agentId: qa')
    expect(block).toContain('Tester')
    expect(block).toContain('git worktree')
  })

  it('documents expert replicas when enabled', () => {
    const block = buildOrchestratorAgentsBlock(
      [{ agentId: 'frontend', paneId: 'p1', name: 'Frontend' }],
      { allowExpertReplicas: true },
    )
    expect(block).toContain('Expert replicas')
    expect(block).toContain('frontend#2')
  })
})

describe('turbo work style prompt', () => {
  it('builds turbo instruction block with per-job wave cap', () => {
    const text = buildOrchestratorTurboWorkStyleBlock({
      jobId: 'job-1',
      maxRounds: 3,
    })
    expect(text).toContain('Work style: turbo')
    expect(text).toContain('job-1')
    expect(text).toContain('per job/user message')
    expect(text).toContain('without waiting for prior specialist waves')
    expect(text).toContain('working tree')
  })

  it('annotates batched follow-up with concurrent job guidance', () => {
    const text = buildBatchedDelegationFollowUp(
      [{ id: 'd1', status: 'ok', summary: 'done' }],
      { round: 1, maxRounds: 3, orchestrationJobId: 'job-9', workStyle: 'turbo' },
    )
    expect(text).toContain('orchestrationJobId: job-9')
    expect(text).toContain('Concurrent jobs (turbo)')
    expect(text).toContain('job-9')
    expect(text).toContain('do not assume')
  })
})

describe('formatDelegationResultFollowUp', () => {
  it('includes status and summary', () => {
    const text = formatDelegationResultFollowUp({
      id: 'd1',
      status: 'ok',
      summary: 'All green',
      toAgentId: 'qa',
    })
    expect(text).toContain('status: ok')
    expect(text).toContain('All green')
  })

  it('adds stop conditions when the batch is clear', () => {
    const text = formatDelegationResultFollowUp(
      { id: 'd1', status: 'ok', summary: 'done' },
      { round: 2, maxRounds: 3, batchRemaining: 0 },
    )
    expect(text).toContain('orchestrationRound: 2/3')
    expect(text).toContain('Do NOT emit')
    expect(text).toContain('Stop condition')
  })

  it('asks continuous PO to emit next slice without asking the user', () => {
    const text = formatDelegationResultFollowUp(
      { id: 'd1', status: 'ok', summary: 'PASS' },
      { round: 1, maxRounds: 5, batchRemaining: 0, continuousProductOwner: true },
    )
    expect(text).toContain('next slice toward the user request')
    expect(text).toContain('ia-terminal-delegate')
    expect(text).toContain('do not ask the user')
    expect(text).toContain('round>=maxRounds')
    expect(text).not.toContain('Stop condition')
    expect(text).not.toContain('next valuable slice')
  })

  it('uses unlimited wording and N/∞ when maxRounds is 0', () => {
    const text = formatDelegationResultFollowUp(
      { id: 'd1', status: 'ok', summary: 'PASS' },
      { round: 4, maxRounds: 0, batchRemaining: 0, continuousProductOwner: true },
    )
    expect(text).toContain(`orchestrationRound: ${formatOrchestrationRoundLabel(4, 0)}`)
    expect(text).toContain('4/∞')
    expect(text).toContain('no host wave cap')
    expect(text).toContain('unlimited')
    expect(text).not.toContain('round>=maxRounds')
    expect(text).not.toContain('At most 0')
  })

  it('asks to wait when specialists remain in the batch', () => {
    const text = formatDelegationResultFollowUp(
      { id: 'd1', status: 'ok', summary: 'done' },
      { batchRemaining: 2 },
    )
    expect(text).toContain('pendingInBatch: 2')
    expect(text).toContain('Wait for the remaining')
  })
})

describe('shouldWakeOrchestratorOnDelegationComplete', () => {
  it('does not wake mid-batch', () => {
    expect(shouldWakeOrchestratorOnDelegationComplete(2)).toBe(false)
    expect(shouldWakeOrchestratorOnDelegationComplete(1)).toBe(false)
  })

  it('wakes only when the batch is clear', () => {
    expect(shouldWakeOrchestratorOnDelegationComplete(0)).toBe(true)
  })
})

describe('buildBatchedDelegationFollowUp', () => {
  it('includes all specialist summaries when the batch completes', () => {
    const text = buildBatchedDelegationFollowUp(
      [
        { id: 'd1', status: 'ok', summary: 'Auth done', toAgentId: 'fullstack' },
        { id: 'd2', status: 'fail', summary: 'QA blocked', toAgentId: 'qa' },
      ],
      { round: 1, maxRounds: 5 },
    )
    expect(text).toContain('Auth done')
    expect(text).toContain('QA blocked')
    expect(text).toContain('id: d1')
    expect(text).toContain('id: d2')
    expect(text).not.toContain('pendingInBatch')
    expect(text).not.toContain('Wait for the remaining')
  })

  it('passes continuousProductOwner guidance only on the last result', () => {
    const text = buildBatchedDelegationFollowUp(
      [
        { id: 'd1', status: 'ok', summary: 'first' },
        { id: 'd2', status: 'ok', summary: 'second' },
      ],
      { round: 1, maxRounds: 5, continuousProductOwner: true },
    )
    const blocks = text.split('\n\n## Delegation result')
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).not.toContain('next slice toward the user request')
    expect(blocks[1]).toContain('next slice toward the user request')
    expect(blocks[1]).toContain('do not ask the user')
  })
})

describe('orchestrationFollowUpKey', () => {
  it('da la misma clave para el mismo job y texto', () => {
    const key = orchestrationFollowUpKey({ text: 'result', orchestrationJobId: 'job-1' })
    expect(orchestrationFollowUpKey({ text: 'result', orchestrationJobId: 'job-1' })).toBe(key)
  })

  it('trimea el jobId y trata su ausencia como vacío', () => {
    expect(orchestrationFollowUpKey({ text: 'a', orchestrationJobId: '  job-1  ' }))
      .toBe(orchestrationFollowUpKey({ text: 'a', orchestrationJobId: 'job-1' }))
    expect(orchestrationFollowUpKey({ text: 'a' }))
      .toBe(orchestrationFollowUpKey({ text: 'a', orchestrationJobId: '   ' }))
  })

  it('separa por texto y por job', () => {
    const base = orchestrationFollowUpKey({ text: 'a', orchestrationJobId: 'job-1' })
    expect(orchestrationFollowUpKey({ text: 'b', orchestrationJobId: 'job-1' })).not.toBe(base)
    expect(orchestrationFollowUpKey({ text: 'a', orchestrationJobId: 'job-2' })).not.toBe(base)
  })
})

describe('formatDelegationRoundCapFollowUp', () => {
  it('forbids further delegate fences', () => {
    const text = formatDelegationRoundCapFollowUp(3)
    expect(text).toContain('3/3')
    expect(text).toContain('Do NOT emit')
  })
})
