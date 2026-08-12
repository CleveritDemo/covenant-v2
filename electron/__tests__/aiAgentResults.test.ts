import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  agentResultContextId,
  agentResultFileName,
  buildRecentAgentResultsPrompt,
  collectRecentAgentResults,
  RECENT_RESULTS_PER_AGENT,
  ensureAiAgentResults,
  extractAiAgentResults,
  formatCompactResultLogLine,
  formatLatestBody,
  buildAiAgentResultsInstruction,
  migrateLegacyAgentResults,
  resolveAiAgentResultsPath,
  upsertAiAgentResults,
  writeAiAgentResultsNotes,
} from '../aiAgentResults'
import { upsertProjectAgent } from '../projectAgentCatalogOps'
import { PROJECT_DIR } from '../../src/shared/projectDir'

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

  it('extracts request/changes/summary payload', () => {
    const result = extractAiAgentResults([
      'Hecho.',
      '```ia-terminal-results',
      JSON.stringify({
        request: 'Añadir toggle de tema',
        changes: ['src/Settings.tsx: ThemeToggle', 'src/theme.css: dark vars'],
        summary: 'Toggle de tema listo',
      }),
      '```',
    ].join('\n'))

    expect(result.visibleText).toBe('Hecho.')
    expect(result.payload).toEqual({
      request: 'Añadir toggle de tema',
      changes: ['src/Settings.tsx: ThemeToggle', 'src/theme.css: dark vars'],
      summary: 'Toggle de tema listo',
      entries: [],
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

  it('saves human notes without touching the agent auto block', () => {
    const cwd = tempCwd()
    seedAgent(cwd, 'po', 'PO')
    ensureAiAgentResults(cwd, 'po', 'PO')
    upsertAiAgentResults(cwd, 'po', { summary: 'Sprint cerrado', entries: ['Acepté GRV-118'] })
    const filePath = resolveAiAgentResultsPath(cwd, 'po')
    const before = readFileSync(filePath, 'utf8')
    const auto = (raw: string) => raw.slice(raw.indexOf('<!-- iaterminal:auto -->'), raw.indexOf('<!-- /iaterminal:auto -->'))

    expect(writeAiAgentResultsNotes(cwd, 'po', 'Revisar con fullstack.').ok).toBe(true)

    const after = readFileSync(filePath, 'utf8')
    expect(auto(after)).toBe(auto(before))
    expect(after).toContain('Revisar con fullstack.')
    // El siguiente turno del agente conserva la nota.
    upsertAiAgentResults(cwd, 'po', { summary: 'Sprint revisado', entries: [] })
    expect(readFileSync(filePath, 'utf8')).toContain('Revisar con fullstack.')
  })

  it('rejects an unknown results file', () => {
    expect(writeAiAgentResultsNotes(tempCwd(), 'nadie', 'x').ok).toBe(false)
  })

  it('writes structured Latest and compact Log under results/<agentId>.md', () => {
    const cwd = tempCwd()
    seedAgent(cwd, 'ops-bot', 'Ops Bot')
    upsertAiAgentResults(cwd, 'ops-bot', {
      summary: 'Primera entrega',
      entries: ['Creé el scaffold'],
    }, { agentName: 'Ops Bot', timestamp: '2026-01-01T00:00:00.000Z' })
    upsertAiAgentResults(cwd, 'ops-bot', {
      request: 'Ajustar tests',
      changes: ['ops.test.ts: coverage'],
      summary: 'Segunda entrega',
      entries: [],
    }, { agentName: 'Ops Bot', timestamp: '2026-01-02T00:00:00.000Z' })

    const filePath = resolveAiAgentResultsPath(cwd, 'ops-bot')
    expect(filePath).toBe(join(cwd, PROJECT_DIR, 'results', 'ops-bot.md'))
    expect(existsSync(filePath)).toBe(true)
    const raw = readFileSync(filePath, 'utf8')
    expect(raw).toContain('## Latest')
    expect(raw).toContain('**Summary:** Segunda entrega')
    expect(raw).toContain('**Request:** Ajustar tests')
    expect(raw).toContain('**Changes:**')
    expect(raw).toContain('- ops.test.ts: coverage')
    expect(raw.indexOf('**Summary:**')).toBeLessThan(raw.indexOf('**Request:**'))
    expect(raw.indexOf('**Request:**')).toBeLessThan(raw.indexOf('**Changes:**'))
    expect(raw).toContain('`2026-01-02T00:00:00.000Z` — Segunda entrega')
    expect(raw).toContain('`2026-01-01T00:00:00.000Z` — Primera entrega')
    expect(raw).not.toContain(' — Request:')
    expect(raw).not.toContain(' · Changes:')
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
    expect(afterEnsure).toContain('`2026-01-03T00:00:00.000Z` — Suite verde')
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
    expect(existsSync(join(cwd, PROJECT_DIR, 'results', 'Fullstack-Expert.md'))).toBe(false)
  })

  it('deletes legacy nameSlug file when canonical agentId file already exists', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, PROJECT_DIR, 'results'), { recursive: true })
    writeFileSync(
      join(cwd, PROJECT_DIR, 'results', 'fullstack.md'),
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
      join(cwd, PROJECT_DIR, 'results', 'example2.md'),
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
    expect(existsSync(join(cwd, PROJECT_DIR, 'results', 'fullstack.md'))).toBe(false)
    expect(existsSync(join(cwd, PROJECT_DIR, 'results', 'example2.md'))).toBe(true)
    ensureAiAgentResults(cwd, 'example2', 'fullstack')
    expect(existsSync(join(cwd, PROJECT_DIR, 'results', 'fullstack.md'))).toBe(false)
    expect(existsSync(join(cwd, PROJECT_DIR, 'results', 'example2.md'))).toBe(true)
  })

  it('resolves display-name agentId to catalog id on upsert and ensure', () => {
    const cwd = tempCwd()
    seedAgent(cwd, 'example2', 'fullstack')
    mkdirSync(join(cwd, PROJECT_DIR, 'results'), { recursive: true })
    writeFileSync(
      join(cwd, PROJECT_DIR, 'results', 'fullstack.md'),
      '# orphan\n',
      'utf8',
    )

    upsertAiAgentResults(cwd, 'fullstack', {
      summary: 'From display name id',
      entries: ['mapped'],
    }, { agentName: 'fullstack', timestamp: '2026-01-04T00:00:00.000Z' })

    expect(existsSync(join(cwd, PROJECT_DIR, 'results', 'fullstack.md'))).toBe(false)
    expect(existsSync(join(cwd, PROJECT_DIR, 'results', 'example2.md'))).toBe(true)
    const raw = readFileSync(join(cwd, PROJECT_DIR, 'results', 'example2.md'), 'utf8')
    expect(raw).toContain('"id":"iaterminal:result:example2"')
    expect(raw).toContain('From display name id')

    upsertAiAgentResults(cwd, 'example2', {
      summary: 'From catalog id',
      entries: ['direct'],
    }, { agentName: 'fullstack', timestamp: '2026-01-05T00:00:00.000Z' })
    expect(existsSync(join(cwd, PROJECT_DIR, 'results', 'example2.md'))).toBe(true)
    expect(existsSync(join(cwd, PROJECT_DIR, 'results', 'fullstack.md'))).toBe(false)
    expect(readFileSync(join(cwd, PROJECT_DIR, 'results', 'example2.md'), 'utf8'))
      .toContain('From catalog id')

    ensureAiAgentResults(cwd, 'fullstack', 'fullstack')
    expect(existsSync(join(cwd, PROJECT_DIR, 'results', 'fullstack.md'))).toBe(false)
    expect(existsSync(join(cwd, PROJECT_DIR, 'results', 'example2.md'))).toBe(true)
  })

  it('migrates legacy nameSlug results file and rewrites agent contextIds', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, PROJECT_DIR, 'results'), { recursive: true })
    writeFileSync(
      join(cwd, PROJECT_DIR, 'results', 'Scout.md'),
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
    expect(existsSync(join(cwd, PROJECT_DIR, 'results', 'scout.md'))).toBe(true)
    const raw = readFileSync(join(cwd, PROJECT_DIR, 'results', 'scout.md'), 'utf8')
    expect(raw).toContain('"id":"iaterminal:result:scout"')
    expect(raw).toContain('"name":"Scout"')
    const agent = JSON.parse(
      readFileSync(join(cwd, PROJECT_DIR, 'agents', 'scout.json'), 'utf8'),
    ) as { contextIds: string[] }
    // Own result se quita en upsert/parse; folderTree remapeado permanece.
    expect(agent.contextIds).toEqual(['iaterminal:folderTree'])
  })

  it('renames case-only Product-Designer.md to product-designer.md via temp', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, PROJECT_DIR, 'results'), { recursive: true })
    writeFileSync(
      join(cwd, PROJECT_DIR, 'results', 'Product-Designer.md'),
      [
        '# Product Designer — Results',
        '<!-- iaterminal:context {"version":1,"id":"iaterminal:result:Product-Designer","name":"Product Designer","fileName":"results/Product-Designer.md","kind":"agentResult"} -->',
        '',
        '<!-- iaterminal:auto -->',
        '## Latest',
        'Case fix',
        '',
        '## Log',
        '- (no entries yet)',
        '<!-- /iaterminal:auto -->',
        '',
      ].join('\n'),
      'utf8',
    )
    upsertProjectAgent(cwd, {
      id: 'product-designer',
      name: 'Product Designer',
      provider: 'cursor',
      permissionMode: 'default',
      contextIds: ['iaterminal:result:Product-Designer'],
    })

    const { idRemap, migrated } = migrateLegacyAgentResults(cwd)
    expect(migrated).toBe(true)
    expect(idRemap['iaterminal:result:Product-Designer']).toBe('iaterminal:result:product-designer')
    const names = readdirSync(join(cwd, PROJECT_DIR, 'results'))
    expect(names).toContain('product-designer.md')
    expect(names.some(name => name === 'Product-Designer.md')).toBe(false)
    const raw = readFileSync(join(cwd, PROJECT_DIR, 'results', 'product-designer.md'), 'utf8')
    expect(raw).toContain('"id":"iaterminal:result:product-designer"')
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

  it('collects up to 3 recent log entries per tab agent', () => {
    expect(RECENT_RESULTS_PER_AGENT).toBe(3)
    const cwd = tempCwd()
    seedAgent(cwd, 'qa', 'QA')
    seedAgent(cwd, 'frontend', 'Frontend')
    for (let i = 1; i <= 6; i += 1) {
      upsertAiAgentResults(cwd, 'qa', {
        summary: `QA ${i}`,
        entries: [],
      }, { agentName: 'QA', timestamp: `2026-01-0${i}T00:00:00.000Z` })
    }
    upsertAiAgentResults(cwd, 'frontend', {
      request: 'Botón primario',
      changes: ['Button.tsx: variant'],
      summary: 'UI lista',
      entries: [],
    }, { agentName: 'Frontend', timestamp: '2026-02-01T00:00:00.000Z' })

    const groups = collectRecentAgentResults(cwd, ['qa', 'frontend', 'missing'])
    expect(groups.map(group => group.agentId)).toEqual(['qa', 'frontend'])
    expect(groups[0]!.entries).toHaveLength(3)
    expect(groups[0]!.entries[0]!.text).toBe('QA 6')
    expect(groups[0]!.entries[2]!.text).toBe('QA 4')
    expect(groups[1]!.entries[0]!.text).toBe('UI lista')

    const prompt = buildRecentAgentResultsPrompt(cwd, ['qa', 'frontend'])
    expect(prompt).toContain('## Recent agent results')
    expect(prompt).toContain('### QA (`qa`)')
    expect(prompt).toContain('### Frontend (`frontend`)')
    expect(prompt).toContain('QA 6')
    expect(prompt).toContain('QA 5')
    expect(prompt).toContain('QA 4')
    expect(prompt).not.toContain('QA 3')
    expect(prompt).not.toContain('QA 2')
    expect(prompt).not.toContain('QA 1')
    expect(prompt).not.toContain('Request:')
    expect(buildRecentAgentResultsPrompt(cwd, ['ghost'])).toBe('')
  })

  const nWords = (n: number) => Array.from({ length: n }, (_, i) => `w${i + 1}`).join(' ')

  it('keeps a 28-word change and truncates a 29-word change to 28', () => {
    const kept = extractAiAgentResults([
      'ok',
      '```ia-terminal-results',
      JSON.stringify({ request: 'req', changes: [nWords(28)], summary: 'ok' }),
      '```',
    ].join('\n'))
    expect(kept.payload?.changes).toEqual([nWords(28)])

    const truncated = extractAiAgentResults([
      'ok',
      '```ia-terminal-results',
      JSON.stringify({ request: 'req', changes: [nWords(29)], summary: 'ok' }),
      '```',
    ].join('\n'))
    expect(truncated.payload?.changes).toEqual([nWords(28)])
  })

  it('keeps a 70-word summary and truncates a 71-word summary to 70', () => {
    const kept = extractAiAgentResults([
      'ok',
      '```ia-terminal-results',
      JSON.stringify({ request: 'req', changes: [], summary: nWords(70) }),
      '```',
    ].join('\n'))
    expect(kept.payload?.summary).toBe(nWords(70))

    const truncated = extractAiAgentResults([
      'ok',
      '```ia-terminal-results',
      JSON.stringify({ request: 'req', changes: [], summary: nWords(71) }),
      '```',
    ].join('\n'))
    expect(truncated.payload?.summary).toBe(nWords(70))
  })

  it('formats the compact log line as summary only', () => {
    const summary = nWords(40)
    const line = formatCompactResultLogLine({
      request: nWords(20),
      changes: [nWords(10), nWords(10), nWords(10)],
      summary,
      entries: [],
    })
    expect(line).toBe(summary)
    expect(line.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(70)
    expect(line).not.toContain('Request:')
  })

  it('formats Latest as Summary then Request then Changes', () => {
    const body = formatLatestBody({
      request: 'Bajar el blur del composer en working',
      changes: ['PlaneChatComposer.css: working blur 16→8px'],
      summary: 'Pediste menos blur al trabajar. El glass working queda en 8px.',
      entries: [],
    })
    expect(body.startsWith('**Summary:**')).toBe(true)
    expect(body.indexOf('**Summary:**')).toBeLessThan(body.indexOf('**Request:**'))
    expect(body.indexOf('**Request:**')).toBeLessThan(body.indexOf('**Changes:**'))
    expect(body).toContain('- PlaneChatComposer.css: working blur 16→8px')
  })

  it('builds a short human results instruction', () => {
    const prompt = buildAiAgentResultsInstruction('Scout')
    expect(prompt).toContain('telling a teammate')
    expect(prompt).toContain('36')
    expect(prompt).toContain('70')
    expect(prompt).toContain('28 per change')
    expect(prompt).toContain('(max 5)')
    expect(prompt).not.toContain('detailed summary')
    expect(prompt).not.toContain('Brief outcome')
    expect(prompt).not.toContain('every durable code change')
    expect(prompt).not.toContain('Do not write a one-line slogan')
  })
})
