import { describe, expect, it } from 'vitest'
import type { AgentChatEntry } from '@shared/agentCliTypes'
import {
  appendLaneText,
  busyLaneKey,
  endLane,
  getLane,
  setLaneActivity,
  startLane,
  type LaneState,
} from '../paneThreadLanes'

const user: AgentChatEntry = { id: 'u1', role: 'user', content: 'hola' }
const assistant: AgentChatEntry = { id: 'a1', role: 'assistant', content: '' }

describe('paneThreadLanes', () => {
  it('startLane adds a busy lane', () => {
    const lanes = startLane(new Map(), {
      threadId: 't-lane',
      delegationId: 'd1',
      assistantId: 'a1',
      messages: [user, assistant],
    })
    const lane = getLane(lanes, 't-lane')
    expect(lane?.busy).toBe(true)
    expect(lane?.messages).toHaveLength(2)
    expect(lane?.activity).toBe('')
  })

  it('startLane is idempotent for the same threadId', () => {
    const first = startLane(new Map(), {
      threadId: 't-lane',
      delegationId: 'd1',
      assistantId: 'a1',
      messages: [user, assistant],
    })
    const second = startLane(first, {
      threadId: 't-lane',
      delegationId: 'd2',
      assistantId: 'a2',
      messages: [],
    })
    expect(second).toBe(first)
    expect(getLane(second, 't-lane')?.delegationId).toBe('d1')
  })

  it('appendLaneText accumulates on the assistant message', () => {
    let lanes = startLane(new Map(), {
      threadId: 't-lane',
      delegationId: 'd1',
      assistantId: 'a1',
      messages: [user, assistant],
    })
    lanes = appendLaneText(lanes, 't-lane', 'foo')
    lanes = appendLaneText(lanes, 't-lane', 'bar')
    const content = getLane(lanes, 't-lane')?.messages.find(m => m.id === 'a1')?.content
    expect(content).toBe('foobar')
  })

  it('appendLaneText returns the same map when nothing changes', () => {
    const lanes = new Map()
    expect(appendLaneText(lanes, 'missing', 'x')).toBe(lanes)
    expect(appendLaneText(lanes, 'missing', '')).toBe(lanes)
  })

  it('setLaneActivity updates activity', () => {
    let lanes = startLane(new Map(), {
      threadId: 't-lane',
      delegationId: 'd1',
      assistantId: 'a1',
      messages: [user, assistant],
    })
    lanes = setLaneActivity(lanes, 't-lane', 'grep')
    expect(getLane(lanes, 't-lane')?.activity).toBe('grep')
    expect(setLaneActivity(lanes, 't-lane', 'grep')).toBe(lanes)
  })

  it('endLane removes the lane', () => {
    let lanes = startLane(new Map(), {
      threadId: 't-lane',
      delegationId: 'd1',
      assistantId: 'a1',
      messages: [user, assistant],
    })
    lanes = endLane(lanes, 't-lane')
    expect(getLane(lanes, 't-lane')).toBeUndefined()
    expect(endLane(lanes, 't-lane')).toBe(lanes)
  })

  describe('busyLaneKey', () => {
    const lane = (threadId: string, busy: boolean): LaneState => ({
      threadId,
      delegationId: `d-${threadId}`,
      assistantId: `a-${threadId}`,
      messages: [],
      busy,
      activity: '',
    })

    it('no cambia cuando solo cambia el contenido de un carril', () => {
      let lanes = startLane(new Map(), {
        threadId: 't-lane',
        delegationId: 'd1',
        assistantId: 'a1',
        messages: [user, assistant],
      })
      const before = busyLaneKey(lanes)
      lanes = appendLaneText(lanes, 't-lane', 'texto nuevo')
      expect(busyLaneKey(lanes)).toBe(before)
    })

    it('cambia al arrancar y al terminar un carril', () => {
      let lanes = new Map<string, LaneState>()
      expect(busyLaneKey(lanes)).toBe('')
      lanes = startLane(lanes, {
        threadId: 't-lane',
        delegationId: 'd1',
        assistantId: 'a1',
        messages: [],
      })
      expect(busyLaneKey(lanes)).toBe('t-lane')
      expect(busyLaneKey(endLane(lanes, 't-lane'))).toBe('')
    })

    it('ignora los carriles que ya no están busy', () => {
      const lanes = new Map([
        ['t1', lane('t1', true)],
        ['t2', lane('t2', false)],
      ])
      expect(busyLaneKey(lanes)).toBe('t1')
    })

    it('no depende del orden de inserción', () => {
      const a = new Map([['t2', lane('t2', true)], ['t1', lane('t1', true)]])
      const b = new Map([['t1', lane('t1', true)], ['t2', lane('t2', true)]])
      expect(busyLaneKey(a)).toBe(busyLaneKey(b))
    })
  })
})
