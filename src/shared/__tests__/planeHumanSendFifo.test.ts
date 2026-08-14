import { describe, expect, it } from 'vitest'
import {
  MAX_HUMAN_SENDS_PER_PANE,
  enqueueHumanSend,
  takeNextHumanSend,
} from '../planeHumanSendFifo'

describe('planeHumanSendFifo', () => {
  it('enqueues in FIFO order', () => {
    let queue: string[] = []
    ;({ queue } = enqueueHumanSend(queue, 'a'))
    ;({ queue } = enqueueHumanSend(queue, 'b'))
    expect(queue).toEqual(['a', 'b'])

    const first = takeNextHumanSend(queue)
    expect(first.head).toBe('a')
    expect(first.rest).toEqual(['b'])

    const second = takeNextHumanSend(first.rest)
    expect(second.head).toBe('b')
    expect(second.rest).toEqual([])
  })

  it('respects cap without dropping existing items', () => {
    let queue: string[] = []
    for (let i = 0; i < MAX_HUMAN_SENDS_PER_PANE; i += 1) {
      ;({ queue } = enqueueHumanSend(queue, `item-${i}`))
    }
    const full = enqueueHumanSend(queue, 'overflow')
    expect(full.dropped).toBe(true)
    expect(full.queue).toHaveLength(MAX_HUMAN_SENDS_PER_PANE)
    expect(full.queue).toEqual(queue)
  })

  it('returns undefined head for empty queue', () => {
    const { head, rest } = takeNextHumanSend([])
    expect(head).toBeUndefined()
    expect(rest).toEqual([])
  })
})
