import { describe, expect, it } from 'vitest'
import { mergeQueuedTurns, type MergeableQueuedTurnLike } from '../mergeQueuedTurns'

/** Forma mínima de `AgentPlaneStatus.queuedTurns` para el espejo optimista en App. */
interface PlaneStatusQueuedTurn extends MergeableQueuedTurnLike {
  id: string
  text: string
  images: Array<{ id: string; previewUrl: string; name: string }>
  orchestrationFollowUp?: boolean
  delegation?: { id: string; fromPaneId: string; toAgentId: string }
}

function planeTurn(
  overrides: Partial<PlaneStatusQueuedTurn> & { id: string },
): PlaneStatusQueuedTurn {
  return { text: '', images: [], ...overrides }
}

describe('mergeQueuedTurns plane mirror', () => {
  it('merges three human turns: length 1, first id survives, absorbed ids gone', () => {
    const queue = [
      planeTurn({ id: 't1', text: 'one' }),
      planeTurn({ id: 't2', text: 'two' }),
      planeTurn({ id: 't3', text: 'three' }),
    ]
    const next = mergeQueuedTurns(queue)
    expect(next).toHaveLength(1)
    expect(next[0]?.id).toBe('t1')
    expect(next.map(item => item.id)).toEqual(['t1'])
    expect(next[0]?.text).toBe('one\ntwo\nthree')
  })

  it('App mirror: plane-status-shaped queue drops absorbed entries after merge', () => {
    const queue: PlaneStatusQueuedTurn[] = [
      planeTurn({
        id: 't1',
        text: 'first',
        images: [{ id: 'img-1', previewUrl: 'blob:a', name: 'a.png' }],
      }),
      planeTurn({
        id: 't2',
        text: 'second',
        orchestrationFollowUp: true,
        images: [{ id: 'img-2', previewUrl: 'blob:b', name: 'b.png' }],
      }),
      planeTurn({ id: 't3', text: 'third' }),
    ]
    const next = mergeQueuedTurns(queue)
    expect(next).toHaveLength(1)
    expect(next.map(item => item.id)).toEqual(['t1'])
    expect(next[0]?.images).toHaveLength(2)
  })

  it('two orchestrationFollowUp turns without delegation are mergeable (≥2)', () => {
    const queue = [
      planeTurn({ id: 'f1', text: 'fu one', orchestrationFollowUp: true }),
      planeTurn({ id: 'f2', text: 'fu two', orchestrationFollowUp: true }),
    ]
    const mergeableCount = queue.filter(item => !item.delegation).length
    expect(mergeableCount).toBeGreaterThanOrEqual(2)
    const next = mergeQueuedTurns(queue)
    expect(next).toHaveLength(1)
    expect(next[0]?.id).toBe('f1')
  })
})
