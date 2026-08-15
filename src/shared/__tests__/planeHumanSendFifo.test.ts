import { describe, expect, it } from 'vitest'
import {
  MAX_HUMAN_SENDS_PER_PANE,
  enqueueHumanSend,
  enqueueHumanSendForThread,
  takeNextHumanSend,
  takeNextHumanSendForThread,
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

  it('takeNextHumanSendForThread picks first matching thread or untagged', () => {
    const queue = [
      { text: 'a', threadId: 't-other' },
      { text: 'b' },
      { text: 'c', threadId: 't-active' },
    ]
    const first = takeNextHumanSendForThread(queue, 't-active')
    expect(first.head?.text).toBe('b')
    expect(first.rest).toEqual([
      { text: 'a', threadId: 't-other' },
      { text: 'c', threadId: 't-active' },
    ])

    const second = takeNextHumanSendForThread(first.rest, 't-active')
    expect(second.head?.text).toBe('c')
    expect(second.rest).toEqual([{ text: 'a', threadId: 't-other' }])
  })

  it('takeNextHumanSendForThread returns null when no eligible item', () => {
    const queue = [
      { text: 'a', threadId: 't-other' },
      { text: 'b', threadId: 't-another' },
    ]
    const { head, rest } = takeNextHumanSendForThread(queue, 't-active')
    expect(head).toBeNull()
    expect(rest).toEqual(queue)
  })

  it('enqueueHumanSendForThread allows enqueue when pane full but thread has room', () => {
    const queue = Array.from({ length: MAX_HUMAN_SENDS_PER_PANE }, (_, i) => ({
      text: `item-${i}`,
      threadId: `thread-a${i}`,
    }))
    const { queue: nextQueue, dropped } = enqueueHumanSendForThread(
      queue,
      { text: 'thread-b', threadId: 'thread-b' },
      'thread-b',
    )
    expect(dropped).toBe(false)
    expect(nextQueue).toHaveLength(MAX_HUMAN_SENDS_PER_PANE + 1)
    expect(nextQueue[MAX_HUMAN_SENDS_PER_PANE]?.text).toBe('thread-b')
  })
})
