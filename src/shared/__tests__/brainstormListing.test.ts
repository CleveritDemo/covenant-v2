import { describe, expect, it } from 'vitest'
import type { BrainstormRoom, BrainstormStatus } from '../brainstormRoom'
import {
  brainstormAge,
  brainstormPrimaryAction,
  brainstormRoomContext,
  brainstormRoundsDone,
  brainstormTone,
  filterBrainstormRooms,
  groupBrainstormRooms,
  type BrainstormRoomListing,
} from '../brainstormListing'

const NOW = 1_760_000_000_000
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function room(over: Partial<BrainstormRoomListing> = {}): BrainstormRoomListing {
  const base: BrainstormRoom = {
    id: 'sala',
    topic: 'Refinar el backlog',
    participantAgentIds: ['tech-lead', 'product-owner'],
    maxRounds: 3,
    status: 'done',
    round: 3,
    cursor: 0,
    messages: [],
  }
  return { ...base, ...over }
}

describe('brainstormPrimaryAction', () => {
  it('offers live for a running room and resume for paused/idle', () => {
    expect(brainstormPrimaryAction('running')).toBe('live')
    expect(brainstormPrimaryAction('paused')).toBe('resume')
    expect(brainstormPrimaryAction('idle')).toBe('resume')
  })

  it('offers open for closed rooms', () => {
    expect(brainstormPrimaryAction('done')).toBe('open')
    expect(brainstormPrimaryAction('stopped')).toBe('open')
  })
})

describe('brainstormTone', () => {
  it('collapses the five states into three visual families', () => {
    const tones = (['running', 'done', 'paused', 'idle', 'stopped'] as BrainstormStatus[])
      .map(brainstormTone)
    expect(tones).toEqual(['run', 'done', 'idle', 'idle', 'idle'])
  })
})

describe('brainstormRoundsDone', () => {
  it('counts the round in flight as started', () => {
    expect(brainstormRoundsDone(room({ status: 'running', round: 1, maxRounds: 4 }))).toBe(2)
  })

  it('never exceeds maxRounds', () => {
    expect(brainstormRoundsDone(room({ status: 'running', round: 9, maxRounds: 3 }))).toBe(3)
    expect(brainstormRoundsDone(room({ status: 'done', round: 3, maxRounds: 3 }))).toBe(3)
  })
})

describe('groupBrainstormRooms', () => {
  it('puts running rooms first regardless of age', () => {
    const groups = groupBrainstormRooms([
      room({ id: 'vieja', updatedAt: NOW - 30 * DAY }),
      room({ id: 'corriendo', status: 'running', updatedAt: NOW - 60 * DAY }),
    ], NOW)
    expect(groups.map(g => g.key)).toEqual(['live', 'older'])
    expect(groups[0].rooms.map(r => r.id)).toEqual(['corriendo'])
  })

  it('splits the rest on the seven-day line and drops empty groups', () => {
    const groups = groupBrainstormRooms([
      room({ id: 'ayer', updatedAt: NOW - DAY }),
      room({ id: 'mes', updatedAt: NOW - 30 * DAY }),
    ], NOW)
    expect(groups.map(g => g.key)).toEqual(['recent', 'older'])
    expect(groups[0].rooms.map(r => r.id)).toEqual(['ayer'])
    expect(groups[1].rooms.map(r => r.id)).toEqual(['mes'])
  })

  it('sorts each group newest first', () => {
    const groups = groupBrainstormRooms([
      room({ id: 'b', updatedAt: NOW - 3 * HOUR }),
      room({ id: 'a', updatedAt: NOW - 1 * HOUR }),
      room({ id: 'c', updatedAt: NOW - 5 * HOUR }),
    ], NOW)
    expect(groups[0].rooms.map(r => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('keeps a room without mtime in recent, not buried in older', () => {
    const groups = groupBrainstormRooms([room({ id: 'sin-fecha' })], NOW)
    expect(groups.map(g => g.key)).toEqual(['recent'])
  })
})

describe('brainstormAge', () => {
  it('walks now → minutes → hours → days', () => {
    expect(brainstormAge(NOW - 5_000, NOW)).toEqual({ unit: 'now' })
    expect(brainstormAge(NOW - 20 * 60_000, NOW)).toEqual({ unit: 'minutes', count: 20 })
    expect(brainstormAge(NOW - 5 * HOUR, NOW)).toEqual({ unit: 'hours', count: 5 })
    expect(brainstormAge(NOW - 3 * DAY, NOW)).toEqual({ unit: 'days', count: 3 })
  })

  it('gives up past a week so the UI shows a date', () => {
    expect(brainstormAge(NOW - 8 * DAY, NOW)).toBeNull()
    expect(brainstormAge(undefined, NOW)).toBeNull()
  })
})

describe('filterBrainstormRooms', () => {
  const rooms = [
    room({ id: 'a', topic: 'Migrar auth' }),
    room({ id: 'b', topic: 'Nombres del modo turbo', participantAgentIds: ['qa', 'frontend'] }),
  ]

  it('matches topic and participant id, case-insensitive', () => {
    expect(filterBrainstormRooms(rooms, 'AUTH').map(r => r.id)).toEqual(['a'])
    expect(filterBrainstormRooms(rooms, 'front').map(r => r.id)).toEqual(['b'])
  })

  it('returns everything for an empty query', () => {
    expect(filterBrainstormRooms(rooms, '   ')).toHaveLength(2)
  })
})

describe('brainstormRoomContext', () => {
  it('builds a notes context the .gravity discover can recognize', () => {
    const context = brainstormRoomContext(room({ id: 'Refinar Backlog', topic: 'Refinar el backlog' }))
    expect(context.kind).toBe('notes')
    expect(context.id).toBe('iaterminal:notes:brainstorm-refinar-backlog')
    expect(context.fileName).toBe('brainstorm-refinar-backlog.md')
    expect(context.name).toBe('Refinar el backlog')
  })
})
