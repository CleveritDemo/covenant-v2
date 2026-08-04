import { describe, expect, it } from 'vitest'
import {
  createInitialBrainstormLiveState,
  reduceBrainstormLiveEvent,
} from '../brainstormLiveState'

describe('BrainstormRoomView live state', () => {
  it('accumulates speaker_delta then commits speaker_final', () => {
    let state = createInitialBrainstormLiveState()
    state = reduceBrainstormLiveEvent(state, {
      type: 'speaker_delta',
      agentId: 'a1',
      round: 0,
      text: 'Hello',
    })
    state = reduceBrainstormLiveEvent(state, {
      type: 'speaker_delta',
      agentId: 'a1',
      round: 0,
      text: ' world',
    })
    expect(state.streaming).toEqual({
      agentId: 'a1',
      round: 0,
      text: 'Hello world',
    })
    expect(state.messages).toHaveLength(0)

    state = reduceBrainstormLiveEvent(state, {
      type: 'speaker_final',
      agentId: 'a1',
      agentName: 'Alice',
      round: 0,
      text: 'Hello world',
    })
    expect(state.streaming).toBeNull()
    expect(state.messages).toEqual([
      {
        agentId: 'a1',
        agentName: 'Alice',
        round: 0,
        text: 'Hello world',
      },
    ])
  })

  it('tracks round and status events', () => {
    let state = createInitialBrainstormLiveState()
    state = reduceBrainstormLiveEvent(state, { type: 'round', round: 1 })
    state = reduceBrainstormLiveEvent(state, { type: 'status', status: 'done' })
    expect(state.round).toBe(1)
    expect(state.status).toBe('done')
  })
})
