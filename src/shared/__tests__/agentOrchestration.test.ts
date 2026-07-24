import { describe, expect, it } from 'vitest'
import {
  buildOrchestratorAgentsBlock,
  formatDelegationResultFollowUp,
  formatDelegationRoundCapFollowUp,
  MAX_ORCHESTRATION_ROUNDS,
  ORCHESTRATION_MAX_ROUNDS_CAP,
  parseDelegatePayload,
  resolveOrchestrationMaxRounds,
  sanitizeAgentCoordination,
  sanitizeDelegateRequest,
  sanitizeOrchestrationMaxRounds,
} from '../agentOrchestration'

describe('sanitizeOrchestrationMaxRounds', () => {
  it('defaults, clamps, and truncates', () => {
    expect(sanitizeOrchestrationMaxRounds(undefined)).toBe(MAX_ORCHESTRATION_ROUNDS)
    expect(sanitizeOrchestrationMaxRounds('')).toBe(MAX_ORCHESTRATION_ROUNDS)
    expect(sanitizeOrchestrationMaxRounds(0)).toBe(1)
    expect(sanitizeOrchestrationMaxRounds(99)).toBe(ORCHESTRATION_MAX_ROUNDS_CAP)
    expect(sanitizeOrchestrationMaxRounds(4.9)).toBe(4)
    expect(resolveOrchestrationMaxRounds(7)).toBe(7)
  })
})

describe('sanitizeAgentCoordination', () => {
  it('accepts orchestrator and defaults to none', () => {
    expect(sanitizeAgentCoordination('orchestrator')).toBe('orchestrator')
    expect(sanitizeAgentCoordination('none')).toBe('none')
    expect(sanitizeAgentCoordination(undefined)).toBe('none')
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

  it('asks to wait when specialists remain in the batch', () => {
    const text = formatDelegationResultFollowUp(
      { id: 'd1', status: 'ok', summary: 'done' },
      { batchRemaining: 2 },
    )
    expect(text).toContain('pendingInBatch: 2')
    expect(text).toContain('Wait for the remaining')
  })
})

describe('formatDelegationRoundCapFollowUp', () => {
  it('forbids further delegate fences', () => {
    const text = formatDelegationRoundCapFollowUp(3)
    expect(text).toContain('3/3')
    expect(text).toContain('Do NOT emit')
  })
})
