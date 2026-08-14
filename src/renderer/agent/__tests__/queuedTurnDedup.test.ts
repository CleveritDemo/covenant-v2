import { describe, expect, it, vi } from 'vitest'
import {
  appendQueuedTurnIfRoom,
  isHumanQueuedTurn,
  queuedTurnHumanKey,
  removeQueuedTurnById,
  type HumanQueuedTurnLike,
} from '../queuedTurnDedup'
import { MAX_VISIBLE_QUEUED_TURNS } from '@shared/planeHumanSendFifo'

interface TestTurn extends HumanQueuedTurnLike {
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
    expect(result.turns).toHaveLength(MAX_VISIBLE_QUEUED_TURNS)
    expect(result.turns.map(item => item.id)).toEqual(fullQueue.map(item => item.id))
  })
})
