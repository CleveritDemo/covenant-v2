import { describe, expect, it } from 'vitest'
import {
  BRAINSTORM_DIR,
  brainstormFileName,
  normalizeBrainstormSlug,
  parseBrainstormRoomDefinition,
  serializeBrainstormRoom,
} from '../brainstormCatalog'

describe('brainstormCatalog', () => {
  it('normalizes slugs like agent catalog', () => {
    expect(normalizeBrainstormSlug('  Ship UX!  ')).toBe('ship-ux')
    expect(normalizeBrainstormSlug('')).toBe('brainstorm')
    expect(brainstormFileName('Ship UX')).toBe('ship-ux.json')
    expect(BRAINSTORM_DIR).toBe('brainstorms')
  })

  it('rejects empty topic or fewer than 2 participants', () => {
    expect(parseBrainstormRoomDefinition({
      id: 'r1',
      topic: '',
      participantAgentIds: ['a', 'b'],
    })).toBeNull()
    expect(parseBrainstormRoomDefinition({
      id: 'r1',
      topic: 'T',
      participantAgentIds: ['a'],
    })).toBeNull()
  })

  it('uses hint id when data.id is empty and preserves messages', () => {
    const parsed = parseBrainstormRoomDefinition({
      topic: 'Latency',
      participantAgentIds: ['qa', 'fe', 'qa'],
      maxRounds: 4,
      status: 'done',
      round: 2,
      cursor: 1,
      messages: [
        { agentId: 'qa', agentName: 'QA', round: 0, text: 'Measure p95' },
      ],
    }, 'My Room')
    expect(parsed).toMatchObject({
      id: 'my-room',
      topic: 'Latency',
      participantAgentIds: ['qa', 'fe'],
      maxRounds: 4,
      status: 'done',
      round: 2,
      cursor: 1,
    })
    expect(parsed?.messages).toEqual([
      { agentId: 'qa', agentName: 'QA', round: 0, text: 'Measure p95' },
    ])
  })

  it('normalizes running status to paused on load', () => {
    const parsed = parseBrainstormRoomDefinition({
      id: 'live',
      topic: 'Theme',
      participantAgentIds: ['a', 'b'],
      status: 'running',
      round: 1,
      cursor: 0,
      messages: [],
    })
    expect(parsed?.status).toBe('paused')
  })

  it('serializes with trailing newline', () => {
    const room = parseBrainstormRoomDefinition({
      id: 'r',
      topic: 'T',
      participantAgentIds: ['a', 'b'],
      status: 'idle',
    })!
    const text = serializeBrainstormRoom(room)
    expect(text.endsWith('\n')).toBe(true)
    expect(JSON.parse(text)).toMatchObject({ id: 'r', topic: 'T' })
  })
})
