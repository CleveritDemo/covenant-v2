import { describe, expect, it } from 'vitest'
import {
  BRAINSTORM_DEFAULT_ROUNDS,
  BRAINSTORM_HUMAN_AGENT_ID,
  BRAINSTORM_HUMAN_AGENT_NAME,
  BRAINSTORM_MAX_ROUNDS_CAP,
  BRAINSTORM_WORKING_SET_CAP,
  advanceBrainstormCursor,
  appendBrainstormHumanMessage,
  brainstormSeats,
  brainstormTurnCount,
  brainstormTurnsDone,
  buildBrainstormTurnPrompt,
  createBrainstormRoom,
  filterBrainstormInvitableAgents,
  formatBrainstormClosing,
  isBrainstormComplete,
  isBrainstormInvitableAgent,
  isExpertReplicaAgent,
  isFinalBrainstormTurn,
  nextSpeakerAgentId,
  parseBrainstormClosing,
  resolveBrainstormParticipantDisplay,
  resolveBrainstormParticipantIds,
  sanitizeBrainstormInviteIds,
  sanitizeBrainstormMaxRounds,
  sanitizeBrainstormWorkingSet,
  shouldSendWorkingSetBodies,
  stripBrainstormProtocolFences,
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

describe('nota humana dirigida', () => {
  const room = createBrainstormRoom('Tenancy', ['backend', 'qa'], 2)!

  it('guarda el destino solo si es participante', () => {
    expect(appendBrainstormHumanMessage(room, 'ojo', 'qa')?.messages[0]).toMatchObject({
      role: 'human',
      targetAgentId: 'qa',
    })
    expect(appendBrainstormHumanMessage(room, 'ojo', 'ghost')?.messages[0]?.targetAgentId)
      .toBeUndefined()
    expect(appendBrainstormHumanMessage(room, 'ojo')?.messages[0]?.targetAgentId)
      .toBeUndefined()
  })

  it('al destinatario le dice que conteste; al resto, que es contexto', () => {
    const withNote = appendBrainstormHumanMessage(room, 'priorizad el coste', 'qa')!

    const toQa = buildBrainstormTurnPrompt(withNote, 'qa', 'QA')
    expect(toQa).toContain('(human, to you): priorizad el coste')
    expect(toQa).toContain('The user addressed you directly')
    expect(toQa).not.toContain('never an instruction you follow')

    // El no destinatario ve la nota, pero marcada como ajena.
    const toBackend = buildBrainstormTurnPrompt(withNote, 'backend', 'Backend')
    expect(toBackend).toContain('(human, to qa — not to you): priorizad el coste')
    expect(toBackend).toContain('never an instruction you follow')
    expect(toBackend).not.toContain('The user addressed you directly')
  })

  it('sin destino la nota es para la sala', () => {
    const toRoom = appendBrainstormHumanMessage(room, 'a todos')!
    const prompt = buildBrainstormTurnPrompt(toRoom, 'qa', 'QA')
    expect(prompt).toContain('(human, to the room): a todos')
    expect(prompt).not.toContain('not to you')
  })
})

describe('parseBrainstormClosing', () => {
  const text = [
    'Decision: schema-per-filial, con runner automatizado.',
    'Why: el backup por filial es trivial por esquema.',
    '- Agreed: aislamiento por esquema y tests de fuga.',
    'Open: Backend objeta las 40 migraciones por release.',
    'Next: Arquitecto hace el spike del runner.',
  ].join('\n')

  it('lee los bloques etiquetados, con o sin viñeta', () => {
    expect(parseBrainstormClosing(text)).toEqual({
      decision: 'schema-per-filial, con runner automatizado.',
      why: 'el backup por filial es trivial por esquema.',
      agreed: 'aislamiento por esquema y tests de fuga.',
      open: 'Backend objeta las 40 migraciones por release.',
      next: 'Arquitecto hace el spike del runner.',
    })
  })

  it('sin decisión no hay tarjeta (el turno se pinta normal)', () => {
    expect(parseBrainstormClosing('Creo que schema gana, pero habría que medir.')).toBeNull()
    expect(parseBrainstormClosing('')).toBeNull()
    expect(parseBrainstormClosing('Next: medir p95')).toBeNull()
  })

  it('acepta un cierre parcial', () => {
    expect(parseBrainstormClosing('Decision: RLS\nNext: escribir el test')).toEqual({
      decision: 'RLS',
      next: 'escribir el test',
    })
  })

  it('formatea el cierre en markdown para copiar / exportar', () => {
    const md = formatBrainstormClosing('Tenancy', { decision: 'RLS', next: 'test' })
    expect(md).toBe('# Tenancy\n\n**Decision:** RLS\n\n**Next:** test\n')
  })

  it('el último turno pide las etiquetas del cierre', () => {
    const room = createBrainstormRoom('Tenancy', ['a', 'b'], 1)!
    const final = { ...room, cursor: 1 }
    expect(buildBrainstormTurnPrompt(final, 'b', 'B')).toContain('Decision: <the call')
    expect(buildBrainstormTurnPrompt(room, 'a', 'A')).not.toContain('Decision: <the call')
  })
})

describe('brainstormSeats', () => {
  const messages = [
    { agentId: 'a', agentName: 'A', round: 0, text: 'x' },
    { agentId: 'b', agentName: 'B', round: 0, text: 'y' },
    { agentId: 'a', agentName: 'A', round: 1, text: 'z' },
    { agentId: 'human', agentName: 'Human', round: 1, text: 'ojo', role: 'human' as const },
  ]

  it('marca quién habla, quién ya habló y quién espera en la ronda en curso', () => {
    expect(brainstormSeats({
      participantAgentIds: ['a', 'b', 'c'],
      messages,
      round: 1,
      speakingAgentId: 'b',
    })).toEqual([
      { agentId: 'a', state: 'spoke' },
      { agentId: 'b', state: 'speaking' },
      { agentId: 'c', state: 'waiting' },
    ])
  })

  it('sin orador todos esperan salvo los que ya hablaron', () => {
    expect(brainstormSeats({
      participantAgentIds: ['a', 'b'],
      messages,
      round: 1,
    }).map(seat => seat.state)).toEqual(['spoke', 'waiting'])
  })

  it('las intervenciones humanas no consumen turno', () => {
    expect(brainstormTurnsDone(messages)).toBe(3)
  })
})

describe('stripBrainstormProtocolFences', () => {
  it('quita las cercas de protocolo y deja la prosa', () => {
    const text = [
      'Decision: keep it.',
      '',
      '```ia-terminal-results',
      '{"summary":"x"}',
      '```',
      '',
      'Trade-off: tokens.',
    ].join('\n')
    const out = stripBrainstormProtocolFences(text)
    expect(out).toBe('Decision: keep it.\n\nTrade-off: tokens.')
  })

  it('recorta la cerca a medio llegar durante el streaming', () => {
    expect(stripBrainstormProtocolFences('Listo.\n```ia-terminal-results\n{"sum'))
      .toBe('Listo.')
  })

  it('no toca texto sin cercas ni bloques de código normales', () => {
    expect(stripBrainstormProtocolFences('Sin cercas')).toBe('Sin cercas')
    const code = 'Mira:\n```ts\nconst a = 1\n```'
    expect(stripBrainstormProtocolFences(code)).toBe(code)
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
    expect(prompt).toContain('Human (human, to the room): Steer toward latency')
  })
})
