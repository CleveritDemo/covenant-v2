import { describe, expect, it } from 'vitest'
import { mergeQueuedTurns, type MergeableQueuedTurnLike } from '../mergeQueuedTurns'

interface TestTurn extends MergeableQueuedTurnLike {
  id: string
  text: string
  images: unknown[]
}

function turn(overrides: Partial<TestTurn> & { id: string }): TestTurn {
  return { text: '', images: [], ...overrides }
}

describe('mergeQueuedTurns', () => {
  it('merges two simple turns joining texts with \\n and concatenating images in order', () => {
    const imgA = { name: 'a.png' }
    const imgB = { name: 'b.png' }
    const result = mergeQueuedTurns([
      turn({ id: 't1', text: 'first', images: [imgA] }),
      turn({ id: 't2', text: 'second', images: [imgB] }),
    ])
    expect(result).toHaveLength(1)
    expect(result[0]?.text).toBe('first\nsecond')
    expect(result[0]?.images).toEqual([imgA, imgB])
  })

  it('keeps the id and position of the first mergeable turn', () => {
    const delegated = turn({
      id: 'd1',
      text: 'delegated',
      delegation: { fromPaneId: 'p-orch' },
    })
    const result = mergeQueuedTurns([
      delegated,
      turn({ id: 't1', text: 'one' }),
      turn({ id: 't2', text: 'two' }),
    ])
    expect(result).toHaveLength(2)
    expect(result[0]).toBe(delegated)
    expect(result[1]?.id).toBe('t1')
    expect(result[1]?.text).toBe('one\ntwo')
  })

  it('does not merge delegation or orchestrationFollowUp turns and preserves relative order', () => {
    const delegated = turn({
      id: 'd1',
      text: 'subtask',
      delegation: { fromPaneId: 'p-orch' },
    })
    const followUp = turn({
      id: 'f1',
      text: 'follow-up',
      orchestrationFollowUp: true,
    })
    const result = mergeQueuedTurns([
      turn({ id: 't1', text: 'one' }),
      delegated,
      turn({ id: 't2', text: 'two' }),
      followUp,
    ])
    expect(result).toHaveLength(3)
    expect(result.map(item => item.id)).toEqual(['t1', 'd1', 'f1'])
    expect(result[0]?.text).toBe('one\ntwo')
    expect(result[1]).toBe(delegated)
    expect(result[2]).toBe(followUp)
  })

  it('skips empty texts (image-only turns) without extra newlines', () => {
    const img = { name: 'only.png' }
    const result = mergeQueuedTurns([
      turn({ id: 't1', text: 'start' }),
      turn({ id: 't2', text: '', images: [img] }),
      turn({ id: 't3', text: '  ' }),
      turn({ id: 't4', text: 'end' }),
    ])
    expect(result).toHaveLength(1)
    expect(result[0]?.text).toBe('start\nend')
    expect(result[0]?.images).toEqual([img])
  })

  it('returns the original array reference with fewer than 2 mergeable turns', () => {
    const single = [turn({ id: 't1', text: 'alone' })]
    expect(mergeQueuedTurns(single)).toBe(single)

    const withFlags = [
      turn({ id: 't1', text: 'human' }),
      turn({ id: 'd1', text: 'sub', delegation: { fromPaneId: 'p' } }),
      turn({ id: 'f1', text: 'fu', orchestrationFollowUp: true }),
    ]
    expect(mergeQueuedTurns(withFlags)).toBe(withFlags)

    const empty: ReturnType<typeof turn>[] = []
    expect(mergeQueuedTurns(empty)).toBe(empty)
  })
})
