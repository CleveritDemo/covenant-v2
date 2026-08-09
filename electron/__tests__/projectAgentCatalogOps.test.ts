import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  deleteProjectAgent,
  listProjectAgents,
  renameProjectAgent,
  upsertProjectAgent,
} from '../projectAgentCatalogOps'
import { PROJECT_DIR } from '../../src/shared/projectDir'

describe('projectAgentCatalogOps', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      try { rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  })

  it('lists, upserts and deletes agents under <projectDir>/agents', () => {
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
      readFileSync(join(cwd, PROJECT_DIR, 'agents', 'qa-scout.json'), 'utf-8'),
    ) as { id: string }
    expect(disk.id).toBe('qa-scout')

    expect(deleteProjectAgent(cwd, 'qa-scout')).toEqual({ ok: true })
    expect(listProjectAgents(cwd)).toEqual([])
  })

  it('renames agent slug, moves results and remaps other agents', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-agents-rename-'))
    dirs.push(cwd)

    const created = upsertProjectAgent(cwd, {
      id: 'claude',
      provider: 'claude',
      permissionMode: 'auto',
      name: 'Fullstack',
      contextIds: ['iaterminal:result:claude'],
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const qa = upsertProjectAgent(cwd, {
      id: 'qa',
      provider: 'cursor',
      permissionMode: 'auto',
      contextIds: ['iaterminal:result:claude', 'rules'],
    })
    expect(qa.ok).toBe(true)

    const resultsDir = join(cwd, PROJECT_DIR, 'results')
    mkdirSync(resultsDir, { recursive: true })
    writeFileSync(
      join(resultsDir, 'claude.md'),
      [
        '# Fullstack — Results',
        '<!-- iaterminal:context {"version":1,"id":"iaterminal:result:claude","name":"Fullstack","fileName":"results/claude.md","kind":"agentResult"} -->',
        '',
        'ok',
        '',
      ].join('\n'),
      'utf-8',
    )

    const renamed = renameProjectAgent(cwd, 'claude', {
      ...created.agent,
      id: 'fullstack',
    })
    expect(renamed.ok).toBe(true)
    if (!renamed.ok) return
    expect(renamed.fromId).toBe('claude')
    expect(renamed.toId).toBe('fullstack')
    expect(renamed.agent.id).toBe('fullstack')
    // El propio agentResult no se auto-asigna en contextIds.
    expect(renamed.agent.contextIds).toBeUndefined()
    expect(renamed.idRemap).toEqual({
      'iaterminal:result:claude': 'iaterminal:result:fullstack',
    })

    const qaAfter = listProjectAgents(cwd).find(agent => agent.id === 'qa')
    expect(qaAfter?.contextIds).toEqual(['iaterminal:result:fullstack', 'rules'])

    expect(existsSync(join(cwd, PROJECT_DIR, 'agents', 'claude.json'))).toBe(false)
    expect(existsSync(join(cwd, PROJECT_DIR, 'agents', 'fullstack.json'))).toBe(true)
    expect(existsSync(join(resultsDir, 'claude.md'))).toBe(false)
    expect(existsSync(join(resultsDir, 'fullstack.md'))).toBe(true)

    const conflict = upsertProjectAgent(cwd, {
      id: 'other',
      provider: 'cursor',
      permissionMode: 'auto',
    })
    expect(conflict.ok).toBe(true)
    const taken = renameProjectAgent(cwd, 'fullstack', {
      id: 'other',
      provider: 'claude',
      permissionMode: 'auto',
    })
    expect(taken).toEqual({ ok: false, error: 'slug_taken' })
  })
})
