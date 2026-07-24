import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  agentResultContextId,
  agentResultFileName,
  ensureAiAgentResults,
  extractAiAgentResults,
  migrateLegacyAgentResults,
  resolveAiAgentResultsPath,
  upsertAiAgentResults,
} from '../aiAgentResults'
import { upsertProjectAgent } from '../projectAgentCatalogOps'

describe('AI agent results', () => {
  const dirs: string[] = []
  const tempCwd = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'ia-terminal-results-'))
    dirs.push(dir)
    return dir
  }
  afterEach(() => dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })))

  it('extracts and hides structured results from the final answer', () => {
    const result = extractAiAgentResults([
      'Listo.',
      '```ia-terminal-results',
      '{"summary":"API lista","entries":["Añadí el endpoint /health"]}',
      '```',
    ].join('\n'))

    expect(result.visibleText).toBe('Listo.')
    expect(result.payload).toEqual({
      summary: 'API lista',
      entries: ['Añadí el endpoint /health'],
    })
  })

  const seedAgent = (cwd: string, id: string, name: string) => {
    upsertProjectAgent(cwd, {
      id,
      name,
      provider: 'cursor',
      permissionMode: 'default',
    })
  }

  it('writes Latest and prepends Log entries under results/<agentId>.md', () => {
    const cwd = tempCwd()
    seedAgent(cwd, 'ops-bot', 'Ops Bot')
    upsertAiAgentResults(cwd, 'ops-bot', {
      summary: 'Primera entrega',
      entries: ['Creé el scaffold'],
    }, { agentName: 'Ops Bot', timestamp: '2026-01-01T00:00:00.000Z' })
    upsertAiAgentResults(cwd, 'ops-bot', {
      summary: 'Segunda entrega',
      entries: ['Ajusté tests'],
    }, { agentName: 'Ops Bot', timestamp: '2026-01-02T00:00:00.000Z' })

    const filePath = resolveAiAgentResultsPath(cwd, 'ops-bot')
    expect(filePath).toBe(join(cwd, '.iaterminal', 'results', 'ops-bot.md'))
    expect(existsSync(filePath)).toBe(true)
    const raw = readFileSync(filePath, 'utf8')
    expect(raw).toContain('## Latest')
    expect(raw).toContain('Segunda entrega')
    expect(raw).toContain('`2026-01-02T00:00:00.000Z` — Ajusté tests')
    expect(raw).toContain('`2026-01-01T00:00:00.000Z` — Creé el scaffold')
    expect(raw).toContain(`"fileName":"${agentResultFileName('ops-bot')}"`)
    expect(raw).toContain(`"id":"${agentResultContextId('ops-bot')}"`)
    expect(raw).toContain('"name":"Ops Bot"')
    expect(raw).toContain('"kind":"agentResult"')
  })

  it('ensure creates agentResult file and second call keeps Latest/Log', () => {
    const cwd = tempCwd()
    seedAgent(cwd, 'qa', 'QA')
    const created = ensureAiAgentResults(cwd, 'qa', 'QA')
    expect(created).toBe(resolveAiAgentResultsPath(cwd, 'qa'))
    expect(existsSync(created)).toBe(true)
    const initial = readFileSync(created, 'utf8')
    expect(initial).toContain('"kind":"agentResult"')
    expect(initial).toContain('(no results yet)')

    upsertAiAgentResults(cwd, 'qa', {
      summary: 'Suite verde',
      entries: ['Corrí vitest'],
    }, { agentName: 'QA', timestamp: '2026-01-03T00:00:00.000Z' })
    const afterUpsert = readFileSync(created, 'utf8')
    expect(afterUpsert).toContain('Suite verde')
    expect(afterUpsert).toContain('Corrí vitest')

    ensureAiAgentResults(cwd, 'qa', 'QA')
    const afterEnsure = readFileSync(created, 'utf8')
    expect(afterEnsure).toContain('Suite verde')
    expect(afterEnsure).toContain('`2026-01-03T00:00:00.000Z` — Corrí vitest')
    expect(afterEnsure).not.toContain('(no results yet)')
  })

  it('rename display name does not move results path or id', () => {
    const cwd = tempCwd()
    seedAgent(cwd, 'fullstack', 'Fullstack')
    ensureAiAgentResults(cwd, 'fullstack', 'Fullstack')
    const before = resolveAiAgentResultsPath(cwd, 'fullstack')
    expect(existsSync(before)).toBe(true)
    seedAgent(cwd, 'fullstack', 'Fullstack Expert')
    ensureAiAgentResults(cwd, 'fullstack', 'Fullstack Expert')
    const after = resolveAiAgentResultsPath(cwd, 'fullstack')
    expect(after).toBe(before)
    const raw = readFileSync(after, 'utf8')
    expect(raw).toContain('"id":"iaterminal:result:fullstack"')
    expect(raw).toContain('"fileName":"results/fullstack.md"')
    expect(raw).toContain('"name":"Fullstack Expert"')
    expect(existsSync(join(cwd, '.iaterminal', 'results', 'Fullstack-Expert.md'))).toBe(false)
  })

  it('deletes legacy nameSlug file when canonical agentId file already exists', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, '.iaterminal', 'results'), { recursive: true })
    writeFileSync(
      join(cwd, '.iaterminal', 'results', 'fullstack.md'),
      [
        '# fullstack — Results',
        '<!-- iaterminal:context {"version":1,"id":"iaterminal:result:fullstack","name":"fullstack","fileName":"results/fullstack.md","kind":"agentResult"} -->',
        '',
        '<!-- iaterminal:auto -->',
        '## Latest',
        'Legacy name slug',
        '<!-- /iaterminal:auto -->',
        '',
      ].join('\n'),
      'utf8',
    )
    writeFileSync(
      join(cwd, '.iaterminal', 'results', 'example2.md'),
      [
        '# example2 — Results',
        '<!-- iaterminal:context {"version":1,"id":"iaterminal:result:example2","name":"fullstack","fileName":"results/example2.md","kind":"agentResult"} -->',
        '',
        '<!-- iaterminal:auto -->',
        '## Latest',
        'Canonical',
        '<!-- /iaterminal:auto -->',
        '',
      ].join('\n'),
      'utf8',
    )
    seedAgent(cwd, 'example2', 'fullstack')

    const { idRemap, migrated } = migrateLegacyAgentResults(cwd)
    expect(migrated).toBe(true)
    expect(idRemap['iaterminal:result:fullstack']).toBe('iaterminal:result:example2')
    expect(existsSync(join(cwd, '.iaterminal', 'results', 'fullstack.md'))).toBe(false)
    expect(existsSync(join(cwd, '.iaterminal', 'results', 'example2.md'))).toBe(true)
    ensureAiAgentResults(cwd, 'example2', 'fullstack')
    expect(existsSync(join(cwd, '.iaterminal', 'results', 'fullstack.md'))).toBe(false)
    expect(existsSync(join(cwd, '.iaterminal', 'results', 'example2.md'))).toBe(true)
  })

  it('resolves display-name agentId to catalog id on upsert and ensure', () => {
    const cwd = tempCwd()
    seedAgent(cwd, 'example2', 'fullstack')
    mkdirSync(join(cwd, '.iaterminal', 'results'), { recursive: true })
    writeFileSync(
      join(cwd, '.iaterminal', 'results', 'fullstack.md'),
      '# orphan\n',
      'utf8',
    )

    upsertAiAgentResults(cwd, 'fullstack', {
      summary: 'From display name id',
      entries: ['mapped'],
    }, { agentName: 'fullstack', timestamp: '2026-01-04T00:00:00.000Z' })

    expect(existsSync(join(cwd, '.iaterminal', 'results', 'fullstack.md'))).toBe(false)
    expect(existsSync(join(cwd, '.iaterminal', 'results', 'example2.md'))).toBe(true)
    const raw = readFileSync(join(cwd, '.iaterminal', 'results', 'example2.md'), 'utf8')
    expect(raw).toContain('"id":"iaterminal:result:example2"')
    expect(raw).toContain('From display name id')

    upsertAiAgentResults(cwd, 'example2', {
      summary: 'From catalog id',
      entries: ['direct'],
    }, { agentName: 'fullstack', timestamp: '2026-01-05T00:00:00.000Z' })
    expect(existsSync(join(cwd, '.iaterminal', 'results', 'example2.md'))).toBe(true)
    expect(existsSync(join(cwd, '.iaterminal', 'results', 'fullstack.md'))).toBe(false)
    expect(readFileSync(join(cwd, '.iaterminal', 'results', 'example2.md'), 'utf8'))
      .toContain('From catalog id')

    ensureAiAgentResults(cwd, 'fullstack', 'fullstack')
    expect(existsSync(join(cwd, '.iaterminal', 'results', 'fullstack.md'))).toBe(false)
    expect(existsSync(join(cwd, '.iaterminal', 'results', 'example2.md'))).toBe(true)
  })

  it('migrates legacy nameSlug results file and rewrites agent contextIds', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, '.iaterminal', 'results'), { recursive: true })
    writeFileSync(
      join(cwd, '.iaterminal', 'results', 'Scout.md'),
      [
        '# Scout — Results',
        '<!-- iaterminal:context {"version":1,"id":"iaterminal:result:Scout","name":"Scout","fileName":"results/Scout.md","kind":"agentResult"} -->',
        '',
        '<!-- iaterminal:auto -->',
        '## Latest',
        'Legacy',
        '',
        '## Log',
        '- (no entries yet)',
        '<!-- /iaterminal:auto -->',
        '',
        '<!-- iaterminal:notes -->',
        '(no annotations yet)',
        '<!-- /iaterminal:notes -->',
        '',
      ].join('\n'),
      'utf8',
    )
    upsertProjectAgent(cwd, {
      id: 'scout',
      name: 'Scout',
      provider: 'cursor',
      permissionMode: 'default',
      contextIds: ['iaterminal:result:Scout', 'iaterminal:folderTree'],
    })

    const { idRemap, migrated } = migrateLegacyAgentResults(cwd)
    expect(migrated).toBe(true)
    expect(idRemap['iaterminal:result:Scout']).toBe('iaterminal:result:scout')
    expect(existsSync(join(cwd, '.iaterminal', 'results', 'scout.md'))).toBe(true)
    const raw = readFileSync(join(cwd, '.iaterminal', 'results', 'scout.md'), 'utf8')
    expect(raw).toContain('"id":"iaterminal:result:scout"')
    expect(raw).toContain('"name":"Scout"')
    const agent = JSON.parse(
      readFileSync(join(cwd, '.iaterminal', 'agents', 'scout.json'), 'utf8'),
    ) as { contextIds: string[] }
    expect(agent.contextIds).toEqual(['iaterminal:result:scout', 'iaterminal:folderTree'])
  })

  it('preserves notes when upserting Latest/Log', () => {
    const cwd = tempCwd()
    seedAgent(cwd, 'research', 'Research')
    const filePath = resolveAiAgentResultsPath(cwd, 'research')
    upsertAiAgentResults(cwd, 'research', {
      summary: 'Primera',
      entries: ['log uno'],
    }, { agentName: 'Research', timestamp: '2026-01-01T00:00:00.000Z' })
    const withNotes = readFileSync(filePath, 'utf8').replace(
      '(no annotations yet)',
      'Brújula: agente anclado a terminal.',
    )
    writeFileSync(filePath, withNotes, 'utf8')
    upsertAiAgentResults(cwd, 'research', {
      summary: 'Segunda',
      entries: ['log dos'],
    }, { agentName: 'Research', timestamp: '2026-01-02T00:00:00.000Z' })
    const raw = readFileSync(filePath, 'utf8')
    expect(raw).toContain('Segunda')
    expect(raw).toContain('Brújula: agente anclado a terminal.')
  })
})
