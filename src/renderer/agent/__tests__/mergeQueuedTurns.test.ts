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

  it('merges three consecutive human turns into one chip', () => {
    const result = mergeQueuedTurns([
      turn({ id: 't1', text: 'one' }),
      turn({ id: 't2', text: 'two' }),
      turn({ id: 't3', text: 'three' }),
    ])
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('t1')
    expect(result[0]?.text).toBe('one\ntwo\nthree')
  })

  it('merges orchestrationFollowUp with adjacent human turns', () => {
    const result = mergeQueuedTurns([
      turn({ id: 't1', text: 'one' }),
      turn({ id: 't2', text: 'two', orchestrationFollowUp: true }),
      turn({ id: 't3', text: 'three' }),
    ])
    expect(result).toHaveLength(1)
    expect(result[0]?.text).toBe('one\ntwo\nthree')
  })

  it('keeps the id and position of the first mergeable turn in a run', () => {
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

  it('[h1,h2,deleg,h3] merges only consecutive runs before and after delegation', () => {
    const delegated = turn({
      id: 'd1',
      text: 'subtask',
      delegation: { fromPaneId: 'p-orch' },
    })
    const result = mergeQueuedTurns([
      turn({ id: 't1', text: 'one' }),
      turn({ id: 't2', text: 'two' }),
      delegated,
      turn({ id: 't3', text: 'three' }),
    ])
    expect(result).toHaveLength(3)
    expect(result[0]?.id).toBe('t1')
    expect(result[0]?.text).toBe('one\ntwo')
    expect(result[1]).toBe(delegated)
    expect(result[2]?.id).toBe('t3')
    expect(result[2]?.text).toBe('three')
  })

  it('[h1,deleg,h2] does not merge humans separated by delegation', () => {
    const delegated = turn({
      id: 'd1',
      text: 'subtask',
      delegation: { fromPaneId: 'p-orch' },
    })
    const h1 = turn({ id: 't1', text: 'one' })
    const h2 = turn({ id: 't2', text: 'two' })
    const result = mergeQueuedTurns([h1, delegated, h2])
    expect(result).toHaveLength(3)
    expect(result[0]).toBe(h1)
    expect(result[1]).toBe(delegated)
    expect(result[2]).toBe(h2)
  })

  it('[h1,h2,deleg] merges humans before delegation into two chips', () => {
    const delegated = turn({
      id: 'd1',
      text: 'subtask',
      delegation: { fromPaneId: 'p-orch' },
    })
    const result = mergeQueuedTurns([
      turn({ id: 't1', text: 'one' }),
      turn({ id: 't2', text: 'two' }),
      delegated,
    ])
    expect(result).toHaveLength(2)
    expect(result[0]?.text).toBe('one\ntwo')
    expect(result[1]).toBe(delegated)
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

  it('returns the original array reference with fewer than 2 mergeable turns in any run', () => {
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
