import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  deleteProjectAgent,
  listProjectAgents,
  upsertProjectAgent,
} from '../projectAgentCatalogOps'

describe('projectAgentCatalogOps', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      try { rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  })

  it('lists, upserts and deletes agents under .iaterminal/agents', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-agents-'))
    dirs.push(cwd)

    expect(listProjectAgents(cwd)).toEqual([])

    const written = upsertProjectAgent(cwd, {
      id: 'QA Scout',
      provider: 'cursor',
      permissionMode: 'auto',
      name: 'QA Scout',
      contextIds: ['rules'],
      emitResults: true,
    })
    expect(written.ok).toBe(true)
    if (!written.ok) return

    const listed = listProjectAgents(cwd)
    expect(listed).toHaveLength(1)
    expect(listed[0]).toMatchObject({
      id: 'qa-scout',
      provider: 'cursor',
      name: 'QA Scout',
      contextIds: ['rules'],
      emitResults: true,
    })

    const disk = JSON.parse(
      readFileSync(join(cwd, '.iaterminal', 'agents', 'qa-scout.json'), 'utf-8'),
    ) as { id: string }
    expect(disk.id).toBe('qa-scout')

    expect(deleteProjectAgent(cwd, 'qa-scout')).toEqual({ ok: true })
    expect(listProjectAgents(cwd)).toEqual([])
  })
})
