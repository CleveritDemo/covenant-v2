import { describe, expect, it } from 'vitest'
import { planPreferSendIntake, type PreferSendIntakeContext } from '../preferSendIntake'
import type { AgentPreferSend } from '../AgentPane'

function ctx(overrides: Partial<PreferSendIntakeContext> = {}): PreferSendIntakeContext {
  return {
    busy: false,
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
      delegation: { id: 'd1', fromPaneId: 'orch', toAgentId: 'spec', orchestrationJobId: 'job-test-1' },
    })
    const p = planPreferSendIntake(send, null, ctx({ busy: true }))
    expect(p).toEqual({ action: 'enqueue', isHumanTurn: false })
  })

  it('ignores empty prompt with no images and does not signal consumption', () => {
    const send = preferSend({
      text: '  ',
      delegation: { id: 'd1', fromPaneId: 'orch', toAgentId: 'spec', orchestrationJobId: 'job-test-1' },
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
      delegation: { id: 'd2', fromPaneId: 'orch', toAgentId: 'spec', orchestrationJobId: 'job-test-2' },
    })
    const p = planPreferSendIntake(send, null, ctx({ busy: true, queuedCount: 10, maxQueued: 10 }))
    expect(p).toEqual({
      action: 'reject',
      reason: 'queue_full',
      delegationId: 'd2',
      orchestrationJobId: undefined,
    })
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

  it('consumes a re-offered send already consumed (no duplicate chip)', () => {
    const send = preferSend({ text: 'con imagen', sendId: 'send-1' })
    const p = planPreferSendIntake(send, null, ctx({
      busy: true,
      consumedSendIds: ['send-1'],
    }))
    expect(p).toEqual({ action: 'consume', reason: 'already_consumed', sendId: 'send-1' })
  })

  it('enqueues a fresh sendId even if another one was consumed before', () => {
    const send = preferSend({ text: 'otro mensaje', sendId: 'send-2' })
    const p = planPreferSendIntake(send, null, ctx({
      busy: true,
      consumedSendIds: ['send-1'],
    }))
    expect(p).toEqual({ action: 'enqueue', isHumanTurn: true })
  })

  it('enqueues a repeated text with a new sendId (no text-based dedupe)', () => {
    const first = preferSend({ text: 'mismo texto', sendId: 'send-1' })
    const second = preferSend({ text: 'mismo texto', sendId: 'send-2' })
    const ctxWithFirstConsumed = ctx({ busy: true, consumedSendIds: ['send-1'] })
    expect(planPreferSendIntake(first, null, ctxWithFirstConsumed).action).toBe('consume')
    expect(planPreferSendIntake(second, null, ctxWithFirstConsumed)).toEqual({
      action: 'enqueue',
      isHumanTurn: true,
    })
  })

  it('dispatches a lane delegation while the pane is busy (own thread)', () => {
    const send = preferSend({
      text: 'lane work',
      delegation: {
        id: 'd3',
        fromPaneId: 'orch',
        toAgentId: 'spec',
        orchestrationJobId: 'job-lane-1',
        threadId: 't7',
      },
    })
    const p = planPreferSendIntake(send, null, ctx({ busy: true }))
    expect(p).toEqual({ action: 'dispatch', isHumanTurn: false })
  })

  it('dispatches a human preferSend in turbo when canStartHumanTurnNow is true', () => {
    const p = planPreferSendIntake(
      preferSend({ orchestrationJobId: 'job-turbo-1' }),
      null,
      ctx({ canStartHumanTurnNow: true, busy: false }),
    )
    expect(p).toEqual({ action: 'dispatch', isHumanTurn: true })
  })
})
