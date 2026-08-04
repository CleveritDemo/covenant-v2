import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  deleteBrainstormRoom,
  exportBrainstormRoomMarkdown,
  listBrainstormRooms,
  pruneBrainstormRooms,
  upsertBrainstormRoom,
} from '../brainstormCatalogOps'
import type { BrainstormRoom } from '../../src/shared/brainstormRoom'

function sampleRoom(partial: Partial<BrainstormRoom> = {}): BrainstormRoom {
  return {
    id: 'Ship Ideas',
    topic: 'Latency budget',
    participantAgentIds: ['qa', 'fe'],
    maxRounds: 3,
    status: 'running',
    round: 1,
    cursor: 0,
    messages: [
      { agentId: 'qa', agentName: 'QA', round: 0, text: 'Measure first' },
    ],
    ...partial,
  }
}

describe('brainstormCatalogOps', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      try { rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  })

  it('lists, upserts and deletes rooms under .iaterminal/brainstorms', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-brainstorms-'))
    dirs.push(cwd)

    expect(listBrainstormRooms(cwd)).toEqual([])
    expect(listBrainstormRooms('')).toEqual([])
    expect(upsertBrainstormRoom('', sampleRoom())).toEqual({
      ok: false,
      error: 'missing_cwd',
    })

    const written = upsertBrainstormRoom(cwd, sampleRoom())
    expect(written.ok).toBe(true)
    if (!written.ok) return
    expect(written.room.id).toBe('ship-ideas')
    expect(written.room.status).toBe('running')

    const listed = listBrainstormRooms(cwd)
    expect(listed).toHaveLength(1)
    // En carga, running → paused
    expect(listed[0]).toMatchObject({
      id: 'ship-ideas',
      topic: 'Latency budget',
      participantAgentIds: ['qa', 'fe'],
      status: 'paused',
      round: 1,
      messages: [
        { agentId: 'qa', agentName: 'QA', round: 0, text: 'Measure first' },
      ],
    })

    const disk = JSON.parse(
      readFileSync(join(cwd, '.iaterminal', 'brainstorms', 'ship-ideas.json'), 'utf-8'),
    ) as { id: string; status: string }
    expect(disk.id).toBe('ship-ideas')
    expect(disk.status).toBe('running')

    expect(deleteBrainstormRoom(cwd, 'ship-ideas')).toEqual({ ok: true })
    expect(listBrainstormRooms(cwd)).toEqual([])
  })

  it('exports transcript markdown next to the json file', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-brainstorms-md-'))
    dirs.push(cwd)

    const written = upsertBrainstormRoom(cwd, sampleRoom({
      status: 'paused',
      messages: [
        { agentId: 'qa', agentName: 'QA', round: 0, text: 'Measure first' },
        { agentId: 'fe', agentName: 'FE', round: 0, text: 'Ship the meter' },
      ],
    }))
    expect(written.ok).toBe(true)

    const exported = exportBrainstormRoomMarkdown(cwd, 'ship-ideas')
    expect(exported.ok).toBe(true)
    if (!exported.ok) return
    expect(exported.path).toBe(join(cwd, '.iaterminal', 'brainstorms', 'ship-ideas.md'))

    const md = readFileSync(exported.path, 'utf-8')
    expect(md).toContain('# Latency budget')
    expect(md).toContain('### QA (ronda 1)')
    expect(md).toContain('Measure first')
    expect(md).toContain('### FE (ronda 1)')
    expect(md).toContain('Ship the meter')
  })

  it('ignores corrupt json files', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-brainstorms-corrupt-'))
    dirs.push(cwd)
    const dir = join(cwd, '.iaterminal', 'brainstorms')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'broken.json'), '{not json', 'utf-8')
    writeFileSync(
      join(dir, 'ok.json'),
      JSON.stringify({
        id: 'ok',
        topic: 'T',
        participantAgentIds: ['a', 'b'],
        status: 'done',
        round: 0,
        cursor: 0,
        messages: [],
        maxRounds: 3,
      }),
      'utf-8',
    )

    const listed = listBrainstormRooms(cwd)
    expect(listed).toHaveLength(1)
    expect(listed[0]?.id).toBe('ok')
  })

  it('prunes old done/stopped rooms and keeps running/paused/recent', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-brainstorms-prune-'))
    dirs.push(cwd)
    const dir = join(cwd, '.iaterminal', 'brainstorms')
    mkdirSync(dir, { recursive: true })

    expect(pruneBrainstormRooms('')).toEqual({ ok: false, error: 'missing_cwd' })

    const oldDone = upsertBrainstormRoom(cwd, sampleRoom({
      id: 'old-done',
      status: 'done',
      messages: [],
    }))
    const oldStopped = upsertBrainstormRoom(cwd, sampleRoom({
      id: 'old-stopped',
      status: 'stopped',
      messages: [],
    }))
    const recentDone = upsertBrainstormRoom(cwd, sampleRoom({
      id: 'recent-done',
      status: 'done',
      messages: [],
    }))
    const paused = upsertBrainstormRoom(cwd, sampleRoom({
      id: 'keep-paused',
      status: 'paused',
      messages: [],
    }))
    const running = upsertBrainstormRoom(cwd, sampleRoom({
      id: 'keep-running',
      status: 'running',
      messages: [],
    }))
    expect(oldDone.ok && oldStopped.ok && recentDone.ok && paused.ok && running.ok).toBe(true)

    const stale = Date.now() / 1000 - 40 * 24 * 60 * 60
    utimesSync(join(dir, 'old-done.json'), stale, stale)
    utimesSync(join(dir, 'old-stopped.json'), stale, stale)
    utimesSync(join(dir, 'keep-paused.json'), stale, stale)
    utimesSync(join(dir, 'keep-running.json'), stale, stale)

    const pruned = pruneBrainstormRooms(cwd, 30)
    expect(pruned).toEqual({ ok: true, removed: 2 })

    const ids = listBrainstormRooms(cwd).map(room => room.id).sort()
    expect(ids).toEqual(['keep-paused', 'keep-running', 'recent-done'])
  })
})
