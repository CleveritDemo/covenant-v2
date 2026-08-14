import { describe, expect, it, vi } from 'vitest'
import {
  appendQueuedTurnIfRoom,
  isHumanQueuedTurn,
  queuedTurnHumanKey,
  queuedTurnSourceSendIds,
  removeQueuedTurnById,
  shouldClearPlaneSendForRemovedQueuedTurn,
  type QueuedTurnWithSource,
} from '../queuedTurnDedup'
import { MAX_VISIBLE_QUEUED_TURNS } from '@shared/planeHumanSendFifo'

interface TestTurn extends QueuedTurnWithSource {
  id: string
}

function turn(overrides: Partial<TestTurn> & { id: string }): TestTurn {
  return { text: '', images: [], ...overrides }
}

function image(previewUrl: string): { previewUrl: string } {
  return { previewUrl }
}

describe('queuedTurnDedup', () => {
  it('isHumanQueuedTurn is true without delegation or orchestrationFollowUp', () => {
    expect(isHumanQueuedTurn(turn({ id: 'h1', text: 'hi' }))).toBe(true)
    expect(isHumanQueuedTurn(turn({
      id: 'd1',
      text: 'sub',
      delegation: {
        id: 'd1',
        fromPaneId: 'p',
        toAgentId: 'qa',
        orchestrationJobId: 'job-1',
      },
    }))).toBe(false)
    expect(isHumanQueuedTurn(turn({
      id: 'f1',
      text: 'fu',
      orchestrationFollowUp: true,
    }))).toBe(false)
  })

  it('queuedTurnHumanKey uses trimmed text and image count', () => {
    expect(queuedTurnHumanKey(turn({
      id: 't1',
      text: '  haz X  ',
      images: [image('a'), image('b')],
    }))).toBe(`haz X${'\0'}2`)
  })

  it('appendQueuedTurnIfRoom enqueues two human turns with the same text in order', () => {
    const first = turn({ id: 't1', text: 'haz X', images: [] })
    const second = turn({ id: 't2', text: 'haz X', images: [] })
    const firstEnqueue = appendQueuedTurnIfRoom([], first, MAX_VISIBLE_QUEUED_TURNS)
    expect(firstEnqueue.didEnqueue).toBe(true)
    const secondEnqueue = appendQueuedTurnIfRoom(
      firstEnqueue.turns,
      second,
      MAX_VISIBLE_QUEUED_TURNS,
    )
    expect(secondEnqueue.didEnqueue).toBe(true)
    expect(secondEnqueue.turns.map(item => item.id)).toEqual(['t1', 't2'])
  })

  it('removeQueuedTurnById drops one queued turn and keeps a sibling with the same text', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const first = turn({ id: 't1', text: 'haz X', images: [] })
    const second = turn({ id: 't2', text: 'haz X', images: [] })
    const queue = [first, second]
    const result = removeQueuedTurnById(queue, 't1')
    expect(result.map(item => item.id)).toEqual(['t2'])
    expect(revoke).not.toHaveBeenCalled()
    revoke.mockRestore()
  })

  it('removeQueuedTurnById revokes preview URLs for the removed turn', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const match = turn({
      id: 'm1',
      text: 'haz X',
      images: [image('blob:match')],
    })
    const result = removeQueuedTurnById([match], 'm1')
    expect(result).toHaveLength(0)
    expect(revoke).toHaveBeenCalledWith('blob:match')
    revoke.mockRestore()
  })

  it('appendQueuedTurnIfRoom returns false when the visible queue is full', () => {
    const fullQueue = Array.from({ length: MAX_VISIBLE_QUEUED_TURNS }, (_, i) =>
      turn({ id: `q-${i}`, text: `msg-${i}` }),
    )
    const next = turn({ id: 'overflow', text: 'one more' })
    const result = appendQueuedTurnIfRoom(fullQueue, next, MAX_VISIBLE_QUEUED_TURNS)
    expect(result.didEnqueue).toBe(false)
    expect(result.outcome).toBe('full')
    expect(result.turns).toHaveLength(MAX_VISIBLE_QUEUED_TURNS)
    expect(result.turns.map(item => item.id)).toEqual(fullQueue.map(item => item.id))
  })

  it('appendQueuedTurnIfRoom rejects a second turn from the same sendId as duplicate', () => {
    const first = turn({ id: 't1', text: 'continua haciendo más test', sourceSendId: 's1' })
    const again = turn({ id: 't2', text: 'continua haciendo más test', sourceSendId: 's1' })
    const queued = appendQueuedTurnIfRoom([], first, MAX_VISIBLE_QUEUED_TURNS)
    expect(queued.outcome).toBe('enqueued')
    const repeat = appendQueuedTurnIfRoom(queued.turns, again, MAX_VISIBLE_QUEUED_TURNS)
    expect(repeat.outcome).toBe('duplicate')
    expect(repeat.didEnqueue).toBe(false)
    expect(repeat.turns.map(item => item.id)).toEqual(['t1'])
  })

  it('appendQueuedTurnIfRoom enqueues the same text with a different sendId', () => {
    const first = turn({ id: 't1', text: 'mismo texto', sourceSendId: 's1' })
    const other = turn({ id: 't2', text: 'mismo texto', sourceSendId: 's2' })
    const queued = appendQueuedTurnIfRoom([], first, MAX_VISIBLE_QUEUED_TURNS)
    const second = appendQueuedTurnIfRoom(queued.turns, other, MAX_VISIBLE_QUEUED_TURNS)
    expect(second.outcome).toBe('enqueued')
    expect(second.turns.map(item => item.id)).toEqual(['t1', 't2'])
  })

  it('appendQueuedTurnIfRoom keeps enqueueing turns without sendId (pane composer)', () => {
    const first = turn({ id: 't1', text: 'sin id' })
    const second = turn({ id: 't2', text: 'sin id' })
    const queued = appendQueuedTurnIfRoom([], first, MAX_VISIBLE_QUEUED_TURNS)
    const next = appendQueuedTurnIfRoom(queued.turns, second, MAX_VISIBLE_QUEUED_TURNS)
    expect(next.outcome).toBe('enqueued')
    expect(next.turns.map(item => item.id)).toEqual(['t1', 't2'])
  })

  it('appendQueuedTurnIfRoom detects duplicate against merged turn sourceSendIds', () => {
    const merged = turn({
      id: 't1',
      text: 'one\ntwo',
      sourceSendId: 's1',
      sourceSendIds: ['s1', 's2'],
    })
    const again = turn({ id: 't2', text: 'two', sourceSendId: 's2' })
    const repeat = appendQueuedTurnIfRoom([merged], again, MAX_VISIBLE_QUEUED_TURNS)
    expect(repeat.outcome).toBe('duplicate')
    expect(repeat.turns.map(item => item.id)).toEqual(['t1'])
  })

  it('shouldClearPlaneSendForRemovedQueuedTurn matches pending sendId in sourceSendIds', () => {
    const removed = turn({
      id: 't2',
      text: 'mismo texto',
      sourceSendId: 's2',
    })
    expect(shouldClearPlaneSendForRemovedQueuedTurn(removed, 's2')).toBe(true)
    expect(shouldClearPlaneSendForRemovedQueuedTurn(removed, 's1')).toBe(false)
    expect(shouldClearPlaneSendForRemovedQueuedTurn(removed, undefined)).toBe(false)
    expect(shouldClearPlaneSendForRemovedQueuedTurn(
      turn({ id: 't3', text: 'sin id' }),
      's1',
    )).toBe(false)
  })

  it('queuedTurnSourceSendIds dedupes sourceSendId and sourceSendIds', () => {
    expect(queuedTurnSourceSendIds({
      sourceSendId: 's1',
      sourceSendIds: ['s1', 's2', 's2'],
    })).toEqual(['s1', 's2'])
  })
})
