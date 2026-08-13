import { describe, expect, it } from 'vitest'
import { planPreferSendIntake, type PreferSendIntakeContext } from '../preferSendIntake'
import type { AgentPreferSend } from '../AgentPane'

function ctx(overrides: Partial<PreferSendIntakeContext> = {}): PreferSendIntakeContext {
  return {
    busy: false,
    loopActive: false,
    preferNewThread: false,
    canStartHumanTurnNow: true,
    queuedCount: 0,
    maxQueued: 10,
    ...overrides,
  }
}

function preferSend(overrides: Partial<AgentPreferSend> = {}): AgentPreferSend {
  return { text: 'hi', ...overrides }
}

describe('planPreferSendIntake', () => {
  it('dispatches a human turn when not busy and slot is free', () => {
    const p = planPreferSendIntake(preferSend(), null, ctx())
    expect(p).toEqual({ action: 'dispatch', isHumanTurn: true })
  })

  it('enqueues an incoming delegation while pane is busy (no silent drop)', () => {
    const send = preferSend({
      text: 'do this',
      delegation: { id: 'd1', fromPaneId: 'orch', toAgentId: 'spec' },
    })
    const p = planPreferSendIntake(send, null, ctx({ busy: true }))
    expect(p).toEqual({ action: 'enqueue', isHumanTurn: false })
  })

  it('ignores empty prompt with no images and does not signal consumption', () => {
    const send = preferSend({
      text: '  ',
      delegation: { id: 'd1', fromPaneId: 'orch', toAgentId: 'spec' },
      orchestrationJobId: 'job-9',
    })
    const p = planPreferSendIntake(send, null, ctx({ busy: true }))
    expect(p).toEqual({
      action: 'ignore',
      reason: 'empty_prefer_send',
      delegationId: 'd1',
      orchestrationJobId: 'job-9',
    })
  })

  it('rejects with queue_full when the local queue is at cap', () => {
    const send = preferSend({
      text: 'work',
      delegation: { id: 'd2', fromPaneId: 'orch', toAgentId: 'spec' },
    })
    const p = planPreferSendIntake(send, null, ctx({ busy: true, queuedCount: 10, maxQueued: 10 }))
    expect(p).toEqual({
      action: 'reject',
      reason: 'queue_full',
      delegationId: 'd2',
      orchestrationJobId: undefined,
    })
  })

  it('skips (does not consume) while loopActive so App can retry', () => {
    const p = planPreferSendIntake(preferSend(), null, ctx({ loopActive: true }))
    expect(p).toEqual({ action: 'skip', reason: 'loop_active' })
  })

  it('skips while preferNewThread is on', () => {
    const p = planPreferSendIntake(preferSend(), null, ctx({ preferNewThread: true }))
    expect(p).toEqual({ action: 'skip', reason: 'prefer_new_thread' })
  })

  it('skips when the same preferSend was already handled', () => {
    const send = preferSend()
    const p = planPreferSendIntake(send, send, ctx())
    expect(p).toEqual({ action: 'skip', reason: 'already_handled' })
  })

  it('enqueues a human turn without a free slot even when not busy', () => {
    const p = planPreferSendIntake(preferSend(), null, ctx({ canStartHumanTurnNow: false }))
    expect(p).toEqual({ action: 'enqueue', isHumanTurn: true })
  })

  it('dispatches an image-only turn (no text, images present)', () => {
    const send = preferSend({
      text: '',
      images: [{ mimeType: 'image/png', data: 'x' } as never],
    })
    const p = planPreferSendIntake(send, null, ctx())
    expect(p).toEqual({ action: 'dispatch', isHumanTurn: true })
  })
})
