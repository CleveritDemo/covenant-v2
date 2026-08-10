import { describe, expect, it } from 'vitest'
import {
  BRAINSTORM_DEFAULT_ROUNDS,
  BRAINSTORM_HUMAN_AGENT_ID,
  BRAINSTORM_HUMAN_AGENT_NAME,
  BRAINSTORM_MAX_ROUNDS_CAP,
  advanceBrainstormCursor,
  appendBrainstormHumanMessage,
  buildBrainstormTurnPrompt,
  createBrainstormRoom,
  filterBrainstormInvitableAgents,
  isBrainstormComplete,
  isBrainstormInvitableAgent,
  isExpertReplicaAgent,
  nextSpeakerAgentId,
  resolveBrainstormParticipantDisplay,
  resolveBrainstormParticipantIds,
  sanitizeBrainstormInviteIds,
  sanitizeBrainstormMaxRounds,
} from '../brainstormRoom'
import type { ProjectAgentDefinition } from '../projectAgentCatalog'

function agent(
  id: string,
  overrides: Partial<ProjectAgentDefinition> = {},
): ProjectAgentDefinition {
  return {
    id,
    provider: 'claude',
    permissionMode: 'auto',
    ...overrides,
  }
}

describe('sanitizeBrainstormMaxRounds', () => {
  it('defaults and clamps to 1..cap', () => {
    expect(sanitizeBrainstormMaxRounds(undefined)).toBe(BRAINSTORM_DEFAULT_ROUNDS)
    expect(sanitizeBrainstormMaxRounds(0)).toBe(1)
    expect(sanitizeBrainstormMaxRounds(99)).toBe(BRAINSTORM_MAX_ROUNDS_CAP)
    expect(sanitizeBrainstormMaxRounds(4.7)).toBe(4)
  })
})

describe('brainstorm invite filter (expert replicas)', () => {
  it('treats localOnly as expert replica and keeps normal agents', () => {
    const normal = agent('frontend', { name: 'Frontend' })
    const replica = agent('frontend-2', { name: 'Frontend (replica)', localOnly: true })
    expect(isExpertReplicaAgent(replica)).toBe(true)
    expect(isExpertReplicaAgent(normal)).toBe(false)
    expect(isBrainstormInvitableAgent(normal)).toBe(true)
    expect(isBrainstormInvitableAgent(replica)).toBe(false)
    expect(filterBrainstormInvitableAgents([normal, replica])).toEqual([normal])
  })

  it('strips replica and unknown ids; keeps only invitable catalog agents', () => {
    const catalog = [
      agent('frontend'),
      agent('frontend-2', { localOnly: true }),
      agent('qa'),
    ]
    expect(sanitizeBrainstormInviteIds(
      ['frontend', 'frontend-2', 'qa', 'frontend-2', 'ghost'],
      catalog,
    )).toEqual(['frontend', 'qa'])
  })

  it('blocks create when selection only has a normal + replica pair', () => {
    const catalog = [
      agent('frontend'),
      agent('frontend-2', { localOnly: true }),
    ]
    const cleaned = sanitizeBrainstormInviteIds(
      ['frontend', 'frontend-2'],
      catalog,
    )
    expect(cleaned).toEqual(['frontend'])
    expect(createBrainstormRoom('Ship UX', cleaned)).toBeNull()
  })
})

describe('resolveBrainstormParticipantDisplay', () => {
  it('prefers catalog name and marks technical orphans as unknown', () => {
    const catalog = [
      agent('david', { name: 'David' }),
      agent('qa', { name: 'QA' }),
    ]
    expect(resolveBrainstormParticipantDisplay('david', catalog)).toEqual({
      agentId: 'david',
      label: 'David',
      known: true,
    })
    expect(resolveBrainstormParticipantDisplay('frontend', catalog)).toEqual({
      agentId: 'frontend',
      label: 'frontend',
      known: false,
    })
  })

  it('remaps orphan id to unique catalog agent by name slug', () => {
    const catalog = [
      agent('david', { name: 'Frontend' }),
      agent('qa', { name: 'QA' }),
    ]
    expect(resolveBrainstormParticipantDisplay('frontend', catalog)).toEqual({
      agentId: 'david',
      label: 'Frontend',
      known: true,
    })
  })

  it('does not remap when several agents match the same slug', () => {
    const catalog = [
      agent('a', { name: 'Frontend' }),
      agent('b', { role: 'frontend' }),
    ]
    expect(resolveBrainstormParticipantDisplay('frontend', catalog).known).toBe(false)
  })
})

describe('resolveBrainstormParticipantIds', () => {
  it('drops orphan technical ids and keeps real catalog agents', () => {
    const catalog = [
      agent('fullstack', { name: 'fullstack' }),
      agent('qa', { name: 'QA' }),
    ]
    expect(resolveBrainstormParticipantIds(
      ['frontend', 'qa', 'fullstack'],
      catalog,
    )).toEqual({
      resolvedIds: ['qa', 'fullstack'],
      orphanIds: ['frontend'],
    })
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
  it('includes topic, speaker labels, and brief plain-reply constraints', () => {
    const room = createBrainstormRoom('Latency budget', ['qa', 'fe'], 3)!
    room.messages.push({
      agentId: 'qa',
      agentName: 'QA',
      round: 0,
      text: 'Measure p95 first.',
    })
    const prompt = buildBrainstormTurnPrompt(room, 'fe', 'Frontend', 'UI craft')
    expect(prompt).toContain('Topic: Latency budget')
    expect(prompt).toContain('QA (round 0): Measure p95 first.')
    expect(prompt).not.toContain('### QA')
    expect(prompt).toContain('Your role: UI craft')
    expect(prompt).toMatch(/≤50 words|<=50 words/i)
    expect(prompt).toContain('never truncate or retry')
    expect(prompt).toContain('No headings')
    expect(prompt).toContain('code fences')
    expect(prompt).toContain('Do not delegate')
    expect(prompt).toContain('call tools')
    expect(prompt).toContain('One idea only')
    expect(prompt).toContain('Output only your spoken contribution')
    expect(prompt).not.toMatch(/80–120 words|80-120 words/i)
    expect(prompt).not.toMatch(/^## /m)
  })
})

describe('appendBrainstormHumanMessage', () => {
  it('appends human voice without advancing cursor', () => {
    const room = createBrainstormRoom('t', ['a', 'b'], 2)!
    expect(appendBrainstormHumanMessage(room, '  ')).toBeNull()
    const next = appendBrainstormHumanMessage(room, '  Steer toward latency  ')
    expect(next).toMatchObject({
      cursor: 0,
      round: 0,
      messages: [{
        agentId: BRAINSTORM_HUMAN_AGENT_ID,
        agentName: BRAINSTORM_HUMAN_AGENT_NAME,
        round: 0,
        text: 'Steer toward latency',
        role: 'human',
      }],
    })
    const prompt = buildBrainstormTurnPrompt(next!, 'a', 'A')
    expect(prompt).toContain('Human (human): Steer toward latency')
  })
})
