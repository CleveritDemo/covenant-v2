import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { ProjectAgentDefinition } from '../../src/shared/projectAgentCatalog'
import {
  clearBrainstormRoomsForTests,
  pauseBrainstormRoom,
  runBrainstormSequence,
  startBrainstormRoom,
  stopBrainstormRoom,
  type BrainstormEvent,
  type BrainstormSpeakerTurnResult,
} from '../brainstormRoom'
import { upsertBrainstormRoom } from '../brainstormCatalogOps'
import type { AppConfig } from '../../src/shared/configSchema'
import { createBrainstormRoom } from '../../src/shared/brainstormRoom'

const baseConfig = { agentCliCommands: {} } as AppConfig

function agent(id: string, name: string): ProjectAgentDefinition {
  return {
    id,
    name,
    provider: 'claude',
    permissionMode: 'auto',
    role: `${name} role`,
  }
}

function fakeWindow(id = 1): import('electron').BrowserWindow {
  return {
    id,
    isDestroyed: () => false,
    webContents: { send: () => undefined },
  } as unknown as import('electron').BrowserWindow
}

afterEach(() => {
  clearBrainstormRoomsForTests()
})

describe('runBrainstormSequence', () => {
  it('speaks in round-robin order and stops at maxRounds', async () => {
    const room = createBrainstormRoom('Theme', ['alpha', 'beta'], 2)!
    const agents = new Map([
      ['alpha', agent('alpha', 'Alpha')],
      ['beta', agent('beta', 'Beta')],
    ])
    const events: BrainstormEvent[] = []
    const speakers: string[] = []

    const final = await runBrainstormSequence(room, {
      roomId: room.id,
      isStale: () => false,
      resolveAgent: id => agents.get(id) ?? null,
      emit: event => events.push(event),
      runSpeakerTurn: async input => {
        speakers.push(input.agent.id)
        input.onDelta(`${input.agent.id}-delta`)
        return { ok: true, text: `${input.agent.id} says hi` }
      },
    })

    expect(speakers).toEqual(['alpha', 'beta', 'alpha', 'beta'])
    expect(final.status).toBe('done')
    expect(final.round).toBe(2)
    expect(final.messages).toHaveLength(4)
    expect(final.messages.map(m => `${m.agentId}:${m.round}`)).toEqual([
      'alpha:0',
      'beta:0',
      'alpha:1',
      'beta:1',
    ])
    expect(events.filter(e => e.type === 'speaker_final')).toHaveLength(4)
    expect(events.some(e => e.type === 'status' && e.status === 'done')).toBe(true)
    expect(events.filter(e => e.type === 'round').map(e => (
      e.type === 'round' ? e.round : -1
    ))).toEqual([0, 1, 2])
  })

  it('stop/isStale cancels mid-flight and does not revive', async () => {
    const room = createBrainstormRoom('Theme', ['alpha', 'beta'], 3)!
    const agents = new Map([
      ['alpha', agent('alpha', 'Alpha')],
      ['beta', agent('beta', 'Beta')],
    ])
    const events: BrainstormEvent[] = []
    let stale = false
    let releaseTurn: ((result: BrainstormSpeakerTurnResult) => void) | null = null

    const sequence = runBrainstormSequence(room, {
      roomId: room.id,
      isStale: () => stale,
      resolveAgent: id => agents.get(id) ?? null,
      emit: event => events.push(event),
      runSpeakerTurn: () => new Promise(resolve => {
        releaseTurn = resolve
      }),
    })

    await new Promise<void>(resolve => {
      const tick = (): void => {
        if (releaseTurn) resolve()
        else setTimeout(tick, 0)
      }
      tick()
    })

    stale = true
    releaseTurn?.({ ok: true, text: 'should be ignored' })
    const final = await sequence

    expect(final.status).toBe('running')
    expect(final.messages).toHaveLength(0)
    expect(events.some(e => e.type === 'speaker_final')).toBe(false)
    expect(events.some(e => e.type === 'status' && e.status === 'stopped')).toBe(false)
  })
})

describe('startBrainstormRoom + stop', () => {
  it('validates participants against catalog and stops in-flight turn', async () => {
    const win = fakeWindow(1)
    const events: BrainstormEvent[] = []
    win.webContents.send = ((_channel: string, _roomId: string, event: BrainstormEvent) => {
      events.push(event)
    }) as typeof win.webContents.send

    let release: ((result: BrainstormSpeakerTurnResult) => void) | null = null
    const started = startBrainstormRoom(
      win,
      {
        roomId: 'room-1',
        topic: 'Latency',
        participantAgentIds: ['alpha', 'beta'],
        maxRounds: 2,
        cwd: '/tmp/project',
      },
      baseConfig,
      '/tmp',
      {
        listAgents: () => [agent('alpha', 'Alpha'), agent('beta', 'Beta')],
        runSpeakerTurn: () => new Promise(resolve => {
          release = resolve
        }),
      },
    )
    expect(started.ok).toBe(true)

    await new Promise<void>(resolve => {
      const tick = (): void => {
        if (release) resolve()
        else setTimeout(tick, 0)
      }
      tick()
    })

    stopBrainstormRoom('room-1', { win, notify: true })
    release?.({ ok: true, text: 'late' })

    await new Promise(r => setTimeout(r, 20))
    expect(events.some(e => e.type === 'status' && e.status === 'stopped')).toBe(true)
    expect(events.some(e => e.type === 'speaker_final')).toBe(false)
  })

  it('rejects unknown participants', () => {
    const result = startBrainstormRoom(
      fakeWindow(2),
      {
        roomId: 'room-2',
        topic: 'X',
        participantAgentIds: ['alpha', 'missing'],
        maxRounds: 2,
        cwd: '/tmp/project',
      },
      baseConfig,
      '/tmp',
      {
        listAgents: () => [agent('alpha', 'Alpha')],
      },
    )
    expect(result).toEqual({ ok: false, error: 'Participante desconocido: missing' })
  })
})

describe('startBrainstormRoom resume', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      try { rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  })

  it('resumes from disk without resetting transcript and includes prior messages in prompt', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-brainstorm-resume-'))
    dirs.push(cwd)
    const saved = upsertBrainstormRoom(cwd, {
      id: 'resume-room',
      topic: 'Ship UX',
      participantAgentIds: ['alpha', 'beta'],
      maxRounds: 2,
      status: 'paused',
      round: 0,
      cursor: 1,
      messages: [
        { agentId: 'alpha', agentName: 'Alpha', round: 0, text: 'Prior alpha point' },
      ],
    })
    expect(saved.ok).toBe(true)

    const prompts: string[] = []
    const speakers: string[] = []
    let turns = 0
    const started = startBrainstormRoom(
      fakeWindow(3),
      {
        roomId: 'resume-room',
        topic: 'Ship UX',
        participantAgentIds: ['alpha', 'beta'],
        maxRounds: 2,
        cwd,
        resume: true,
      },
      baseConfig,
      '/tmp',
      {
        listAgents: () => [agent('alpha', 'Alpha'), agent('beta', 'Beta')],
        runSpeakerTurn: async input => {
          turns += 1
          speakers.push(input.agent.id)
          prompts.push(input.prompt)
          return { ok: true, text: `${input.agent.id} continues` }
        },
      },
    )
    expect(started).toEqual({ ok: true })

    await new Promise(r => setTimeout(r, 40))
    expect(turns).toBeGreaterThanOrEqual(1)
    expect(speakers[0]).toBe('beta')
    expect(prompts[0]).toContain('Prior alpha point')
    expect(prompts[0]).toContain('### Alpha (round 0)')
  })

  it('reuses prior cliSessions for the same roomId on resume', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-brainstorm-cli-'))
    dirs.push(cwd)
    const win = fakeWindow(4)

    let releaseFirst: ((result: BrainstormSpeakerTurnResult) => void) | null = null
    const first = startBrainstormRoom(
      win,
      {
        roomId: 'cli-room',
        topic: 'Sessions',
        participantAgentIds: ['alpha', 'beta'],
        maxRounds: 2,
        cwd,
      },
      baseConfig,
      '/tmp',
      {
        listAgents: () => [agent('alpha', 'Alpha'), agent('beta', 'Beta')],
        runSpeakerTurn: async input => {
          input.onSession?.('sess-alpha-1')
          return new Promise(resolve => {
            releaseFirst = resolve
          })
        },
      },
    )
    expect(first.ok).toBe(true)

    await new Promise<void>(resolve => {
      const tick = (): void => {
        if (releaseFirst) resolve()
        else setTimeout(tick, 0)
      }
      tick()
    })

    pauseBrainstormRoom('cli-room', { win, notify: true })
    releaseFirst?.({ ok: false, aborted: true })
    await new Promise(r => setTimeout(r, 20))

    const sessionIds: Array<string | undefined> = []
    let releaseResume: ((result: BrainstormSpeakerTurnResult) => void) | null = null
    const resumed = startBrainstormRoom(
      win,
      {
        roomId: 'cli-room',
        topic: 'Sessions',
        participantAgentIds: ['alpha', 'beta'],
        maxRounds: 2,
        cwd,
        resume: true,
      },
      baseConfig,
      '/tmp',
      {
        listAgents: () => [agent('alpha', 'Alpha'), agent('beta', 'Beta')],
        runSpeakerTurn: async input => {
          sessionIds.push(input.cliSessionId)
          return new Promise(resolve => {
            releaseResume = resolve
          })
        },
      },
    )
    expect(resumed.ok).toBe(true)

    await new Promise<void>(resolve => {
      const tick = (): void => {
        if (releaseResume) resolve()
        else setTimeout(tick, 0)
      }
      tick()
    })

    expect(sessionIds[0]).toBe('sess-alpha-1')
    stopBrainstormRoom('cli-room')
    releaseResume?.({ ok: false, aborted: true })
  })

  it('fails resume when room is missing from disk and memory', () => {
    const result = startBrainstormRoom(
      fakeWindow(5),
      {
        roomId: 'ghost-room',
        topic: 'Missing',
        participantAgentIds: ['alpha', 'beta'],
        maxRounds: 2,
        cwd: '/tmp/no-brainstorm-disk',
        resume: true,
      },
      baseConfig,
      '/tmp',
      {
        listAgents: () => [agent('alpha', 'Alpha'), agent('beta', 'Beta')],
      },
    )
    expect(result).toEqual({ ok: false, error: 'No se pudo reanudar la sala' })
  })
})
