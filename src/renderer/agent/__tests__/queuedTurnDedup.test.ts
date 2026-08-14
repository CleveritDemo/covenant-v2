import { describe, expect, it, vi } from 'vitest'
import {
  dedupeHumanQueuedTurnOnEnqueue,
  isHumanQueuedTurn,
  queuedTurnHumanKey,
  removeMatchingHumanQueuedTurns,
  type HumanQueuedTurnLike,
} from '../queuedTurnDedup'

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
      delegation: { fromPaneId: 'p' },
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

  it('dedupeHumanQueuedTurnOnEnqueue keeps one human with same text', () => {
    const first = turn({ id: 't1', text: 'haz X', images: [] })
    const second = turn({ id: 't2', text: 'haz X', images: [] })
    const result = dedupeHumanQueuedTurnOnEnqueue([first], second)
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('t1')
  })

  it('two back-to-back enqueues with the same key leave one human turn', () => {
    const first = turn({ id: 't1', text: 'haz X', images: [] })
    const second = turn({ id: 't2', text: 'haz X', images: [] })
    let queue: TestTurn[] = []
    queue = dedupeHumanQueuedTurnOnEnqueue(queue, first)
    queue = dedupeHumanQueuedTurnOnEnqueue(queue, second)
    expect(queue).toHaveLength(1)
    expect(queue[0]?.id).toBe('t1')
  })

  it('dedupeHumanQueuedTurnOnEnqueue does not dedupe human vs follow-up with same text', () => {
    const human = turn({ id: 'h1', text: 'haz X', images: [] })
    const followUp = turn({
      id: 'f1',
      text: 'haz X',
      images: [],
      orchestrationFollowUp: true,
    })
    const delegation = turn({
      id: 'd1',
      text: 'haz X',
      images: [],
      delegation: { fromPaneId: 'p' },
    })
    expect(dedupeHumanQueuedTurnOnEnqueue([human], followUp)).toHaveLength(2)
    expect(dedupeHumanQueuedTurnOnEnqueue([human], delegation)).toHaveLength(2)
  })

  it('removeMatchingHumanQueuedTurns removes only matching human turns and revokes URLs', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const keep = turn({ id: 'k1', text: 'other', images: [] })
    const match = turn({
      id: 'm1',
      text: 'haz X',
      images: [image('blob:match')],
    })
    const followUp = turn({
      id: 'f1',
      text: 'haz X',
      images: [image('blob:follow')],
      orchestrationFollowUp: true,
    })
    const result = removeMatchingHumanQueuedTurns(
      [keep, match, followUp],
      'haz X',
      1,
    )
    expect(result.map(item => item.id)).toEqual(['k1', 'f1'])
    expect(revoke).toHaveBeenCalledWith('blob:match')
    expect(revoke).not.toHaveBeenCalledWith('blob:follow')
    revoke.mockRestore()
  })

  it('dedupeHumanQueuedTurnOnEnqueue appends non-human turns without key check', () => {
    const human = turn({ id: 'h1', text: 'same', images: [] })
    const followUp = turn({
      id: 'f1',
      text: 'same',
      images: [],
      orchestrationFollowUp: true,
    })
    const result = dedupeHumanQueuedTurnOnEnqueue([human], followUp)
    expect(result).toHaveLength(2)
  })
})
