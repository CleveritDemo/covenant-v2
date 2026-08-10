import { describe, expect, it } from 'vitest'
import {
  BRAINSTORM_DEFAULT_ROUNDS,
  BRAINSTORM_MAX_ROUNDS_CAP,
  BRAINSTORM_WORKING_SET_CAP,
  advanceBrainstormCursor,
  brainstormTurnCount,
  buildBrainstormTurnPrompt,
  createBrainstormRoom,
  isBrainstormComplete,
  isFinalBrainstormTurn,
  nextSpeakerAgentId,
  sanitizeBrainstormMaxRounds,
  sanitizeBrainstormWorkingSet,
  shouldSendWorkingSetBodies,
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
  it('includes objective, speaker labels, and brief plain-reply constraints', () => {
    const room = createBrainstormRoom('Latency budget', ['qa', 'fe'], 3)!
    room.messages.push({
      agentId: 'qa',
      agentName: 'QA',
      round: 0,
      text: 'Measure p95 first.',
    })
    const prompt = buildBrainstormTurnPrompt(room, 'fe', 'Frontend', 'UI craft')
    expect(prompt).toContain('Objective: Latency budget')
    expect(prompt).toContain('QA (round 0): Measure p95 first.')
    expect(prompt).not.toContain('### QA')
    expect(prompt).toContain('Your role: UI craft')
    expect(prompt).toMatch(/2–4 short sentences|80–120 words/i)
    expect(prompt).toContain('no headings')
    expect(prompt).toContain('code fences')
    expect(prompt).toContain('Do not delegate')
    expect(prompt).toContain('call tools')
    expect(prompt).toContain('One idea only')
    expect(prompt).toContain('Output only your spoken contribution')
    expect(prompt).not.toMatch(/^## /m)
  })

  it('keeps the prompt free of working-set lines when there is none', () => {
    const room = createBrainstormRoom('Latency budget', ['qa', 'fe'], 3)!
    const prompt = buildBrainstormTurnPrompt(room, 'fe', 'Frontend')
    expect(prompt).not.toContain('Working set')
    expect(prompt).not.toContain('not in the working set')
    expect(prompt).not.toContain('Desired outcome')
  })

  it('lists the working set and grounds claims on it', () => {
    const room = createBrainstormRoom('Tenancy', ['qa', 'fe'], 3, {
      filePaths: ['electron/tenancy.ts'],
      outcome: 'decision',
    })!
    const prompt = buildBrainstormTurnPrompt(room, 'fe', 'Frontend', undefined, {
      labels: ['file electron/tenancy.ts'],
      fileBlocks: ['### electron/tenancy.ts\nexport const schema = 1'],
    })
    expect(prompt).toContain('Desired outcome: one decision')
    expect(prompt).toContain('- file electron/tenancy.ts')
    expect(prompt).toContain('export const schema = 1')
    expect(prompt).toContain('not in the working set')
  })

  it('sends bodies only on the first round', () => {
    const room = createBrainstormRoom('Tenancy', ['qa', 'fe'], 3)!
    expect(shouldSendWorkingSetBodies(room)).toBe(true)
    expect(shouldSendWorkingSetBodies({ ...room, round: 1 })).toBe(false)
  })

  it('marks the last turn of the last round as final', () => {
    const room = createBrainstormRoom('Tenancy', ['qa', 'fe'], 2)!
    expect(isFinalBrainstormTurn({ ...room, round: 0, cursor: 1 })).toBe(false)
    expect(isFinalBrainstormTurn({ ...room, round: 1, cursor: 0 })).toBe(false)
    const final = { ...room, round: 1, cursor: 1 }
    expect(isFinalBrainstormTurn(final)).toBe(true)
    expect(buildBrainstormTurnPrompt(final, 'fe', 'Frontend')).toContain('Final turn')
  })
})

describe('working set', () => {
  it('trims, dedupes and caps', () => {
    expect(sanitizeBrainstormWorkingSet(['a', ' a ', 'b', 7])).toEqual(['a', 'b'])
    expect(sanitizeBrainstormWorkingSet('nope')).toEqual([])
    const many = Array.from({ length: BRAINSTORM_WORKING_SET_CAP + 5 }, (_, i) => `f${i}`)
    expect(sanitizeBrainstormWorkingSet(many)).toHaveLength(BRAINSTORM_WORKING_SET_CAP)
  })

  it('createBrainstormRoom stores the brief sanitized', () => {
    const room = createBrainstormRoom('Tenancy', ['qa', 'fe'], 3, {
      contextIds: ['iaterminal:notes:ct-89', 'iaterminal:notes:ct-89'],
      filePaths: ['a.ts'],
      outcome: 'nonsense',
    })!
    expect(room.contextIds).toEqual(['iaterminal:notes:ct-89'])
    expect(room.filePaths).toEqual(['a.ts'])
    expect(room.outcome).toBeUndefined()
  })

  it('counts turns as participants × rounds', () => {
    expect(brainstormTurnCount({ participantAgentIds: ['a', 'b', 'c'], maxRounds: 3 })).toBe(9)
  })
})
