import { describe, expect, it } from 'vitest'
import {
  createLoopChainFifoItem,
  enqueueLoopChainFifo,
  dequeueLoopChainFifoHead,
  removeLoopChainFromFifo,
} from '../loopChainFifo'

describe('loopChainFifo', () => {
  it('enqueues uniquely and dequeues FIFO', () => {
    const a = createLoopChainFifoItem({
      tabId: 't',
      chainId: 'c1',
      stepIndex: 0,
      paneId: 'p',
      text: 'one',
    })
    const b = createLoopChainFifoItem({
      tabId: 't',
      chainId: 'c2',
      stepIndex: 0,
      paneId: 'p',
      text: 'two',
    })
    let queue = enqueueLoopChainFifo([], a)
    queue = enqueueLoopChainFifo(queue, a)
    expect(queue).toHaveLength(1)
    queue = enqueueLoopChainFifo(queue, b)
    expect(queue.map(item => item.chainId)).toEqual(['c1', 'c2'])

    const map = new Map([['p', queue]])
    expect(dequeueLoopChainFifoHead(map, 'p')?.chainId).toBe('c1')
    expect(dequeueLoopChainFifoHead(map, 'p')?.chainId).toBe('c2')
    expect(map.has('p')).toBe(false)
  })

  it('removes a whole chain from queues', () => {
    const map = new Map([
      ['p', [
        createLoopChainFifoItem({
          tabId: 't', chainId: 'c1', stepIndex: 0, paneId: 'p', text: 'a',
        }),
        createLoopChainFifoItem({
          tabId: 't', chainId: 'c2', stepIndex: 0, paneId: 'p', text: 'b',
        }),
      ]],
    ])
    removeLoopChainFromFifo(map, 'c1')
    expect(map.get('p')?.map(item => item.chainId)).toEqual(['c2'])
  })
})
