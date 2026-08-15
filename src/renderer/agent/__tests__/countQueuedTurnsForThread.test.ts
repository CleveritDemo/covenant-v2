import { describe, expect, it } from 'vitest'
import {
  countQueuedTurnsForThread,
  resolvePreferSendTargetThreadId,
} from '../countQueuedTurnsForThread'

describe('countQueuedTurnsForThread', () => {
  it('counts only turns for the requested thread', () => {
    const turns = [
      { id: '1', threadId: 't1' },
      { id: '2', threadId: 't2' },
      { id: '3' },
      { id: '4', threadId: 't1' },
    ]
    expect(countQueuedTurnsForThread(turns, 't1')).toBe(3)
    expect(countQueuedTurnsForThread(turns, 't2')).toBe(1)
    expect(countQueuedTurnsForThread(turns, 't9')).toBe(0)
  })
})

describe('resolvePreferSendTargetThreadId', () => {
  it('prefers delegation thread over active thread', () => {
    expect(resolvePreferSendTargetThreadId('t7', 't1')).toBe('t7')
    expect(resolvePreferSendTargetThreadId('  ', 't1')).toBe('t1')
    expect(resolvePreferSendTargetThreadId(undefined, 't1')).toBe('t1')
  })
})
