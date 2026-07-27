import { describe, expect, it } from 'vitest'
import {
  buildOrchestratorAgentsBlock,
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
  orchestrationRoundsAtCap,
  parseDelegatePayload,
  resolveOrchestrationMaxRounds,
  sanitizeAgentCoordination,
  sanitizeDelegateRequest,
  sanitizeOrchestrationMaxRounds,
  shouldWakeOrchestratorOnDelegationComplete,
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
})

describe('buildOrchestratorAgentsBlock', () => {
  it('lists agents with roles', () => {
    const block = buildOrchestratorAgentsBlock([
      { agentId: 'qa', paneId: 'p1', name: 'QA', role: 'Tester' },
    ])
    expect(block).toContain('agentId: qa')
    expect(block).toContain('Tester')
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

describe('formatDelegationRoundCapFollowUp', () => {
  it('forbids further delegate fences', () => {
    const text = formatDelegationRoundCapFollowUp(3)
    expect(text).toContain('3/3')
    expect(text).toContain('Do NOT emit')
  })
})
