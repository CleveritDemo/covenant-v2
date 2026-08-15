import { describe, expect, it } from 'vitest'
import {
  MAX_REMEMBERED_SEND_IDS,
  rememberConsumedSendId,
  wasSendIdConsumed,
} from '../consumedSendIds'

describe('consumedSendIds', () => {
  it('remembers a sendId and recognizes it later', () => {
    const seen = rememberConsumedSendId([], 'send-1')
    expect(seen).toEqual(['send-1'])
    expect(wasSendIdConsumed(seen, 'send-1')).toBe(true)
    expect(wasSendIdConsumed(seen, 'send-2')).toBe(false)
  })

  it('ignores empty ids (a send without identity never blocks another)', () => {
    expect(rememberConsumedSendId([], undefined)).toEqual([])
    expect(rememberConsumedSendId([], '   ')).toEqual([])
    expect(wasSendIdConsumed([''], undefined)).toBe(false)
    expect(wasSendIdConsumed([], '  ')).toBe(false)
  })

  it('does not duplicate an id already remembered', () => {
    const once = rememberConsumedSendId([], 'send-1')
    expect(rememberConsumedSendId(once, 'send-1')).toEqual(['send-1'])
  })

  it('drops the oldest ids past the cap', () => {
    let seen: string[] = []
    for (let i = 0; i < MAX_REMEMBERED_SEND_IDS + 5; i += 1) {
      seen = rememberConsumedSendId(seen, `send-${i}`)
    }
    expect(seen).toHaveLength(MAX_REMEMBERED_SEND_IDS)
    expect(wasSendIdConsumed(seen, 'send-0')).toBe(false)
    expect(wasSendIdConsumed(seen, `send-${MAX_REMEMBERED_SEND_IDS + 4}`)).toBe(true)
  })

  it('never mutates the array it receives', () => {
    const seen = ['send-1']
    const next = rememberConsumedSendId(seen, 'send-2')
    expect(seen).toEqual(['send-1'])
    expect(next).toEqual(['send-1', 'send-2'])
  })
})
