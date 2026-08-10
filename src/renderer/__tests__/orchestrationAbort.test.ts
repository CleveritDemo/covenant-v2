import { describe, expect, it } from 'vitest'
import {
  clearPlaneSendsForOrchestrationAbort,
  clearPlaneSendsForSingleDelegationAbort,
  filterQueuedTurnsAfterOrchestrationAbort,
  filterQueuedTurnsAfterSingleDelegationAbort,
  shouldDiscardAbortedDelegationFifoHead,
} from '../orchestrationAbort'

describe('clearPlaneSendsForOrchestrationAbort', () => {
  it('clears orchestrator follow-up already offered as preferSend', () => {
    const next = clearPlaneSendsForOrchestrationAbort({
      orch: {
        text: 'Batch complete',
        orchestrationFollowUp: true,
      },
      other: { text: 'unrelated' },
    }, 'orch')
    expect(next.orch).toBeUndefined()
    expect(next.other).toEqual({ text: 'unrelated' })
  })

  it('clears specialist preferSend originated by the aborted orchestrator', () => {
    const next = clearPlaneSendsForOrchestrationAbort({
      specialist: {
        text: 'Do QA',
        delegation: {
          fromPaneId: 'orch',
          id: 'd1',
          toAgentId: 'qa',
        },
      },
      other: {
        text: 'Keep me',
        delegation: {
          fromPaneId: 'other-orch',
          id: 'd2',
          toAgentId: 'dev',
        },
      },
    }, 'orch')
    expect(next.specialist).toBeUndefined()
    expect(next.other?.text).toBe('Keep me')
  })
})

describe('shouldDiscardAbortedDelegationFifoHead', () => {
  it('discards specialist heads when orchestrator pending is gone', () => {
    expect(shouldDiscardAbortedDelegationFifoHead(
      { delegation: { fromPaneId: 'orch' } },
      new Set(),
    )).toBe(true)
    expect(shouldDiscardAbortedDelegationFifoHead(
      { delegation: { fromPaneId: 'orch' } },
      new Set(['orch']),
    )).toBe(false)
  })

  it('keeps follow-ups and plain prompts (FIFO/planeSend clear covers abort)', () => {
    expect(shouldDiscardAbortedDelegationFifoHead(
      { orchestrationFollowUp: true },
      new Set(),
    )).toBe(false)
    expect(shouldDiscardAbortedDelegationFifoHead(
      undefined,
      new Set(),
    )).toBe(false)
  })
})

describe('filterQueuedTurnsAfterOrchestrationAbort', () => {
  it('removes delegated subtarea and local follow-up; keeps user prompt', () => {
    const { kept, removed } = filterQueuedTurnsAfterOrchestrationAbort([
      { id: 'u1', text: 'User prompt' },
      {
        id: 'd1',
        text: 'Delegated',
        delegation: { fromPaneId: 'orch' },
      },
      {
        id: 'f1',
        text: 'Local follow-up',
        orchestrationFollowUp: true,
      },
    ], 'orch', 'orch')
    expect(kept.map(item => item.id)).toEqual(['u1'])
    expect(removed.map(item => item.id)).toEqual(['d1', 'f1'])
  })

  it('keeps follow-up on another pane when aborting this orchestrator', () => {
    const { kept, removed } = filterQueuedTurnsAfterOrchestrationAbort([
      {
        id: 'f-other',
        text: 'Other orch follow-up',
        orchestrationFollowUp: true,
      },
      {
        id: 'd-from-orch',
        text: 'Delegated from aborted orch',
        delegation: { fromPaneId: 'orch' },
      },
    ], 'specialist', 'orch')
    expect(kept.map(item => item.id)).toEqual(['f-other'])
    expect(removed.map(item => item.id)).toEqual(['d-from-orch'])
  })
})

describe('filterQueuedTurnsAfterSingleDelegationAbort', () => {
  it('removes only the matching delegationId', () => {
    const { kept, removed } = filterQueuedTurnsAfterSingleDelegationAbort([
      { id: 'u1', text: 'User' },
      {
        id: 'q1',
        text: 'A',
        delegation: { fromPaneId: 'orch', id: 'd1' },
      },
      {
        id: 'q2',
        text: 'B',
        delegation: { fromPaneId: 'orch', id: 'd2' },
      },
    ], 'd1')
    expect(removed.map(item => item.id)).toEqual(['q1'])
    expect(kept.map(item => item.id)).toEqual(['u1', 'q2'])
  })
})

describe('clearPlaneSendsForSingleDelegationAbort', () => {
  it('clears only preferSend for that delegation', () => {
    const next = clearPlaneSendsForSingleDelegationAbort({
      a: { text: 'A', delegation: { fromPaneId: 'orch', id: 'd1' } },
      b: { text: 'B', delegation: { fromPaneId: 'orch', id: 'd2' } },
    }, 'd1')
    expect(next.a).toBeUndefined()
    expect(next.b?.text).toBe('B')
  })
})
