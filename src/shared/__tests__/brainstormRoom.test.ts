import { describe, expect, it } from 'vitest'
import {
  BRAINSTORM_DEFAULT_ROUNDS,
  BRAINSTORM_MAX_ROUNDS_CAP,
  advanceBrainstormCursor,
  buildBrainstormTurnPrompt,
  createBrainstormRoom,
  isBrainstormComplete,
  nextSpeakerAgentId,
  sanitizeBrainstormMaxRounds,
} from '../brainstormRoom'

describe('sanitizeBrainstormMaxRounds', () => {
  it('defaults and clamps to 1..cap', () => {
    expect(sanitizeBrainstormMaxRounds(undefined)).toBe(BRAINSTORM_DEFAULT_ROUNDS)
    expect(sanitizeBrainstormMaxRounds(0)).toBe(1)
    expect(sanitizeBrainstormMaxRounds(99)).toBe(BRAINSTORM_MAX_ROUNDS_CAP)
    expect(sanitizeBrainstormMaxRounds(4.7)).toBe(4)
  })
})

describe('createBrainstormRoom', () => {
  it('returns null for empty topic or fewer than 2 participants', () => {
    expect(createBrainstormRoom('', ['a', 'b'])).toBeNull()
    expect(createBrainstormRoom('topic', ['a'])).toBeNull()
  })

  it('dedupes participants preserving order and starts idle', () => {
    const room = createBrainstormRoom('  Ship UX  ', ['b', 'a', 'b', 'c'], 2)
    expect(room).toMatchObject({
      topic: 'Ship UX',
      participantAgentIds: ['b', 'a', 'c'],
      maxRounds: 2,
      status: 'idle',
      round: 0,
      cursor: 0,
      messages: [],
    })
    expect(room?.id).toBeTruthy()
  })
})

describe('nextSpeaker / complete / advance', () => {
  it('round-robins speakers and completes after maxRounds', () => {
    const room = createBrainstormRoom('t', ['a', 'b'], 2)!
    expect(nextSpeakerAgentId(room)).toBe('a')
    expect(isBrainstormComplete(room)).toBe(false)

    let next = advanceBrainstormCursor(room)
    expect(next.cursor).toBe(1)
    expect(next.round).toBe(0)
    expect(nextSpeakerAgentId(next)).toBe('b')

    next = advanceBrainstormCursor(next)
    expect(next.cursor).toBe(0)
    expect(next.round).toBe(1)
    expect(isBrainstormComplete(next)).toBe(false)

    next = advanceBrainstormCursor(advanceBrainstormCursor(next))
    expect(next.round).toBe(2)
    expect(isBrainstormComplete(next)).toBe(true)
  })
})

describe('buildBrainstormTurnPrompt', () => {
  it('includes topic, speaker labels, and no-delegate instruction', () => {
    const room = createBrainstormRoom('Latency budget', ['qa', 'fe'], 3)!
    room.messages.push({
      agentId: 'qa',
      agentName: 'QA',
      round: 0,
      text: 'Measure p95 first.',
    })
    const prompt = buildBrainstormTurnPrompt(room, 'fe', 'Frontend', 'UI craft')
    expect(prompt).toContain('Topic: Latency budget')
    expect(prompt).toContain('### QA (round 0)')
    expect(prompt).toContain('Measure p95 first.')
    expect(prompt).toContain('Your role: UI craft')
    expect(prompt).toContain('Do not delegate')
    expect(prompt).toContain('Do not ask for approval')
  })
})
