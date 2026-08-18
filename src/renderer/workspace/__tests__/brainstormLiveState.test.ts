import { describe, expect, it } from 'vitest'
import {
  createBrainstormLiveSummary,
  createInitialBrainstormLiveState,
  reduceBrainstormLiveEvent,
  tabIdsWithRunningBrainstorm,
} from '../brainstormLiveState'

describe('BrainstormRoomView live state', () => {
  it('createBrainstormLiveSummary deriva summary 1-based desde la sala', () => {
    const summary = createBrainstormLiveSummary({
      id: 'r1',
      topic: 'Tenancy',
      participantAgentIds: ['a', 'b'],
      maxRounds: 3,
      round: 1,
      cursor: 0,
      status: 'paused',
      messages: [
        { agentId: 'a', agentName: 'A', round: 0, text: 'one' },
        { agentId: 'b', agentName: 'B', round: 0, text: 'two' },
      ],
    })
    expect(summary).toMatchObject({
      roomId: 'r1',
      topic: 'Tenancy',
      status: 'paused',
      round: 2,
      maxRounds: 3,
      turnsDone: 2,
      totalTurns: 6,
      speakingAgentId: null,
      speakerName: '',
      participantAgentIds: ['a', 'b'],
    })
    expect(createBrainstormLiveSummary({
      id: 'r2',
      topic: 'Done',
      participantAgentIds: ['a', 'b'],
      maxRounds: 2,
      round: 2,
      cursor: 0,
      status: 'done',
      messages: [],
    }).round).toBe(2)
  })
})

describe('BrainstormRoomView live reduce', () => {
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

  it('appends human_message to transcript', () => {
    let state = createInitialBrainstormLiveState()
    state = reduceBrainstormLiveEvent(state, {
      type: 'human_message',
      text: 'Steer left',
      round: 0,
    })
    expect(state.messages).toEqual([
      {
        agentId: 'human',
        agentName: 'Human',
        round: 0,
        text: 'Steer left',
        role: 'human',
      },
    ])
    state = reduceBrainstormLiveEvent(state, {
      type: 'human_message',
      text: 'Steer left',
      round: 0,
    })
    expect(state.messages).toHaveLength(1)
  })
})

describe('tabIdsWithRunningBrainstorm', () => {
  it('incluye el tab si alguna sala está running', () => {
    expect(tabIdsWithRunningBrainstorm(
      { t1: [{ id: 'r1', status: 'running' }] },
      {},
    )).toEqual(new Set(['t1']))
  })

  it('no incluye el tab si las salas solo están paused o done', () => {
    expect(tabIdsWithRunningBrainstorm(
      {
        t1: [{ id: 'r1', status: 'paused' }],
        t2: [{ id: 'r2', status: 'done' }],
      },
      {},
    )).toEqual(new Set())
  })

  it('el estado vivo pisa al persistido en ambos sentidos', () => {
    expect(tabIdsWithRunningBrainstorm(
      { t1: [{ id: 'r1', status: 'paused' }] },
      { r1: { status: 'running' } },
    )).toEqual(new Set(['t1']))
    expect(tabIdsWithRunningBrainstorm(
      { t1: [{ id: 'r1', status: 'running' }] },
      { r1: { status: 'paused' } },
    )).toEqual(new Set())
  })

  it('no incluye el tab sin salas', () => {
    expect(tabIdsWithRunningBrainstorm({ t1: [] }, {})).toEqual(new Set())
  })
})
