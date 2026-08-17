import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
// `write` a buffer y no `writeFile`: el build ESM de SheetJS no trae `fs`
// enlazado (haría falta `set_fs`), y el código real tampoco lo usa —lee el
// archivo por su cuenta y le pasa los bytes—.
import { utils as xlsxUtils, write as writeXlsxBuffer } from 'xlsx'
import {
  buildAssignedContexts,
  buildContextCatalogPrompt,
  buildContextPromptDelivery,
  buildContextSectionCatalog,
  buildRequestedContextSections,
  clearTabContextMaterializationCache,
  deleteTabContext,
  discoverTabContexts,
  extractContextSectionRequest,
  materializeTabContext,
  reconcileNotesWithAuto,
} from '../tabContextBuild'
import { appendAiChangelog } from '../aiChangelog'
import { upsertAiAgentResults } from '../aiAgentResults'
import { upsertProjectAgent } from '../projectAgentCatalogOps'
import { applyCanonicalContextIdentity, normalizeAnnotation, type TabContext } from '../../src/shared/tabContext'
import { PROJECT_DIR } from '../../src/shared/projectDir'
import { sectionsForContext } from '../../src/shared/contextSections'

describe('tab context builders', () => {
  const dirs: string[] = []
  const tempCwd = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'ia-terminal-context-'))
    dirs.push(dir)
    return dir
  }
  afterEach(() => dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })))

  /** Simula anotaciones legacy ya escritas en la sección de notes del .md. */
  const writeLegacyAnnotations = (
    filePath: string,
    annotations: Array<{ key: string; text: string }>,
  ): void => {
    const lines = annotations.map(item => `- \`${item.key}\` — ${item.text}`).join('\n')
    const raw = readFileSync(filePath, 'utf8')
    writeFileSync(
      filePath,
      raw.replace(
        /<!-- iaterminal:notes -->[\s\S]*?<!-- \/iaterminal:notes -->/,
        `<!-- iaterminal:notes -->\n${lines}\n<!-- /iaterminal:notes -->`,
      ),
      'utf8',
    )
  }

  it('materializa una hoja de cálculo como CSV por hoja', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'docs'), { recursive: true })
    const book = xlsxUtils.book_new()
    xlsxUtils.book_append_sheet(book, xlsxUtils.aoa_to_sheet([
      ['ID', 'Historia', 'Puntos'],
      ['US-1', 'Como PO quiero adjuntar el backlog', 3],
    ]), 'Sprint 4')
    xlsxUtils.book_append_sheet(book, xlsxUtils.aoa_to_sheet([['Nota'], ['revisar']]), 'Notas')
    writeFileSync(
      join(cwd, 'docs', 'historias.xlsx'),
      writeXlsxBuffer(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer,
    )

    const result = materializeTabContext({
      id: 'historias',
      name: 'Historias',
      fileName: 'historias.md',
      kind: 'spreadsheet' as const,
      paths: ['docs/historias.xlsx'],
    }, cwd)

    expect(result.ok).toBe(true)
    // Una sección por hoja, con su nombre, y el contenido en CSV.
    expect(result.content).toContain('docs/historias.xlsx · Sprint 4')
    expect(result.content).toContain('docs/historias.xlsx · Notas')
    // SheetJS entrecomilla un «ID» al inicio del CSV a propósito: sin comillas,
    // Excel lo detecta como archivo SYLK y se niega a abrirlo.
    expect(result.content).toContain('"ID",Historia,Puntos')
    expect(result.content).toContain('US-1,Como PO quiero adjuntar el backlog,3')
    expect(result.content).toContain('```csv')
  })

  it('una hoja que no existe no rompe el turno', () => {
    const cwd = tempCwd()
    const result = materializeTabContext({
      id: 'historias',
      name: 'Historias',
      fileName: 'historias.md',
      kind: 'spreadsheet' as const,
      paths: ['docs/no-esta.xlsx'],
    }, cwd)
    expect(result.ok).toBe(true)
    expect(result.content).toContain('docs/no-esta.xlsx')
  })

  it('sin rutas elegidas lo dice en vez de quedar vacío', () => {
    const cwd = tempCwd()
    const result = materializeTabContext({
      id: 'historias',
      name: 'Historias',
      fileName: 'historias.md',
      kind: 'spreadsheet' as const,
    }, cwd)
    expect(result.content).toContain('(no spreadsheet selected)')
  })

  it('returns zero contexts when cwd has no project folder', () => {
    const cwd = tempCwd()
    const result = discoverTabContexts(cwd)
    expect(result.ok).toBe(true)
    expect(result.contexts).toEqual([])
  })

  it('materializes annotation layer and preserves them on refresh', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'src'), { recursive: true })
    const context = applyCanonicalContextIdentity({
      id: 'tree',
      name: 'Árbol',
      fileName: 'arbol.md',
      kind: 'folderTree' as const,
    })
    writeLegacyAnnotations(materializeTabContext(context, cwd, { write: true }).filePath!, [
      { key: 'src', text: 'Usar IPC tipado' },
    ])

    const refreshed = materializeTabContext(context, cwd, { write: true })
    expect(refreshed.ok).toBe(true)
    expect(refreshed.notesContent).toContain('Usar IPC tipado')
    expect(readFileSync(join(cwd, PROJECT_DIR, context.fileName), 'utf8'))
      .toContain('Usar IPC tipado')
  })

  it('auto-discovers contexts preserving their registered names and configuration', () => {
    const cwd = tempCwd()
    const context = {
      id: 'arquitectura-id',
      name: 'Arquitectura y Decisiones — Núcleo',
      fileName: 'arquitectura.md',
      kind: 'symbols' as const,
      rootPath: 'src',
      paths: ['App.tsx'],
      symbolKinds: ['class', 'method'] as Array<'class' | 'method'>,
    }
    const expected = applyCanonicalContextIdentity(context)
    materializeTabContext(context, cwd, { write: true })

    const result = discoverTabContexts(cwd)

    expect(result.ok).toBe(true)
    expect(result.contexts).toEqual([{
      ...expected,
      icon: 'code',
      color: '#c084fc',
    }])
    expect(readFileSync(join(cwd, PROJECT_DIR, expected.fileName), 'utf8'))
      .toContain(`"id":"${expected.id}"`)
  })

  it('discovers notes markdown and skips files without context metadata', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, PROJECT_DIR), { recursive: true })
    writeFileSync(
      join(cwd, PROJECT_DIR, 'nombre-normalizado.md'),
      '# Nombre Original con Ñ y espacios\n\nNotas durables.',
      'utf8',
    )
    writeFileSync(
      join(cwd, PROJECT_DIR, 'legacy-notes.md'),
      [
        '# Legacy',
        '<!-- iaterminal:context {"version":1,"id":"legacy-notes","name":"Legacy","fileName":"legacy-notes.md","kind":"notes"} -->',
        '',
        'Humano',
      ].join('\n'),
      'utf8',
    )

    const result = discoverTabContexts(cwd)

    expect(result.ok).toBe(true)
    expect(result.contexts).toEqual([{
      id: 'iaterminal:notes:Legacy',
      name: 'Legacy',
      fileName: 'context/legacy-notes.md',
      kind: 'notes',
    }])
  })

  it('discovers the AI changelog as a reserved read-only context', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, PROJECT_DIR), { recursive: true })
    writeFileSync(join(cwd, PROJECT_DIR, 'changelog.md'), '# AI Changelog\n\n- Cambio', 'utf8')

    const context = discoverTabContexts(cwd).contexts.find(item => item.kind === 'changelog')!
    expect(context).toEqual({
      id: 'iaterminal:changelog:AI-Changelog',
      name: 'AI Changelog',
      fileName: 'context/changelog.md',
      kind: 'changelog',
    })
    expect(materializeTabContext(context, cwd, { write: true }).content)
      .toContain('# AI Changelog')
    expect(deleteTabContext(context, cwd).ok).toBe(true)
    expect(existsSync(join(cwd, PROJECT_DIR, 'changelog.md'))).toBe(false)
    expect(existsSync(join(cwd, PROJECT_DIR, 'AI-Changelog.md'))).toBe(false)
    expect(existsSync(join(cwd, PROJECT_DIR, 'context', 'changelog.md'))).toBe(false)
    expect(existsSync(join(cwd, PROJECT_DIR, 'context', 'AI-Changelog.md'))).toBe(false)
  })

  it('creates the changelog only when its context is explicitly saved', () => {
    const cwd = tempCwd()
    const context = {
      id: 'iaterminal:changelog',
      name: 'Historial del equipo',
      fileName: 'historial-ia.md',
      kind: 'changelog' as const,
    }
    const expected = applyCanonicalContextIdentity(context)

    materializeTabContext(context, cwd)
    expect(existsSync(join(cwd, PROJECT_DIR, expected.fileName))).toBe(false)

    const created = materializeTabContext(context, cwd, { write: true })
    expect(created.ok).toBe(true)
    expect(existsSync(join(cwd, PROJECT_DIR, expected.fileName))).toBe(true)
    expect(created.content).toContain('# Historial del equipo')
    expect(created.content).toContain('iaterminal:context')
    expect(discoverTabContexts(cwd).contexts).toEqual([{
      ...expected,
      icon: 'history',
      color: '#a3e635',
    }])
  })

  it('renames a changelog without losing entries and runtime follows metadata', () => {
    const cwd = tempCwd()
    const original = applyCanonicalContextIdentity({
      id: 'iaterminal:changelog',
      name: 'Historial inicial',
      fileName: 'historial-inicial.md',
      kind: 'changelog' as const,
    })
    materializeTabContext(original, cwd, { write: true })
    appendAiChangelog(cwd, [
      { path: 'src/first.ts', description: 'Primer cambio registrado' },
    ], '2026-01-01T00:00:00.000Z')

    const renamed = applyCanonicalContextIdentity({
      ...original,
      name: 'Historial compartido',
      fileName: 'historial-compartido.md',
    })
    materializeTabContext(renamed, cwd, {
      write: true,
      previousFileName: original.fileName,
    })
    appendAiChangelog(cwd, [
      { path: 'src/second.ts', description: 'Segundo cambio registrado' },
    ], '2026-01-02T00:00:00.000Z')

    expect(existsSync(join(cwd, PROJECT_DIR, original.fileName))).toBe(false)
    const raw = readFileSync(join(cwd, PROJECT_DIR, renamed.fileName), 'utf8')
    expect(raw).toContain('# Historial compartido')
    expect(raw).toContain('Primer cambio registrado')
    expect(raw).toContain('Segundo cambio registrado')
    expect(discoverTabContexts(cwd).contexts).toEqual([{
      ...renamed,
      icon: 'history',
      color: '#a3e635',
    }])
  })

  it('keeps other changelog files when writing a distinct changelog', () => {
    const cwd = tempCwd()
    const first = applyCanonicalContextIdentity({
      id: '',
      name: 'Changelog A',
      fileName: '',
      kind: 'changelog' as const,
    })
    const second = applyCanonicalContextIdentity({
      id: '',
      name: 'Changelog B',
      fileName: '',
      kind: 'changelog' as const,
    })
    materializeTabContext(first, cwd, { write: true })
    materializeTabContext(second, cwd, { write: true })
    expect(existsSync(join(cwd, PROJECT_DIR, first.fileName))).toBe(true)
    expect(existsSync(join(cwd, PROJECT_DIR, second.fileName))).toBe(true)
    expect(discoverTabContexts(cwd).contexts.filter(item => item.kind === 'changelog')).toHaveLength(2)
  })

  it('discovers agentResult contexts from <projectDir>/results/<agentId>.md', () => {
    const cwd = tempCwd()
    upsertProjectAgent(cwd, {
      id: 'scout',
      name: 'Scout',
      provider: 'cursor',
      permissionMode: 'default',
    })
    upsertAiAgentResults(cwd, 'scout', {
      summary: 'Exploración lista',
      entries: ['Mapeé el repo'],
    }, { agentName: 'Scout', timestamp: '2026-07-20T12:00:00.000Z' })

    const result = discoverTabContexts(cwd)
    expect(result.ok).toBe(true)
    const found = result.contexts.find(item => item.kind === 'agentResult')
    expect(found).toMatchObject({
      name: 'Scout',
      kind: 'agentResult',
      fileName: 'results/scout.md',
      id: 'iaterminal:result:scout',
    })
  })

  it('migrates discovered-file metadata to canonical ids and remaps agent contextIds', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, PROJECT_DIR), { recursive: true })
    writeFileSync(
      join(cwd, PROJECT_DIR, 'folders.md'),
      [
        '# folders',
        '<!-- iaterminal:context {"version":1,"id":"discovered-file:folders.md","name":"folders","fileName":"folders.md","kind":"folderTree"} -->',
        '',
        '<!-- iaterminal:auto -->',
        'tree',
        '<!-- /iaterminal:auto -->',
        '',
        '<!-- iaterminal:notes -->',
        '(no annotations yet)',
        '<!-- /iaterminal:notes -->',
        '',
      ].join('\n'),
      'utf8',
    )
    writeFileSync(
      join(cwd, PROJECT_DIR, 'dependences.md'),
      [
        '# deps',
        '<!-- iaterminal:context {"version":1,"id":"2601e189-7cab-41cf-8d4a-2cf7276d7a23","name":"Dependencies","fileName":"dependences.md","kind":"deps"} -->',
        '',
        '<!-- iaterminal:auto -->',
        'deps',
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
      id: 'qa',
      name: 'QA',
      provider: 'cursor',
      permissionMode: 'default',
      contextIds: [
        'discovered-file:folders.md',
        '2601e189-7cab-41cf-8d4a-2cf7276d7a23',
      ],
    })

    const result = discoverTabContexts(cwd)
    expect(result.ok).toBe(true)
    expect(result.contextsMigrated).toBe(true)
    expect(result.idRemap?.['discovered-file:folders.md']).toBe('iaterminal:folderTree:folders')
    expect(result.idRemap?.['2601e189-7cab-41cf-8d4a-2cf7276d7a23']).toBe('iaterminal:deps:Dependencies')
    expect(result.contexts.map(item => item.id).sort()).toEqual([
      'iaterminal:deps:Dependencies',
      'iaterminal:folderTree:folders',
    ])
    const agent = JSON.parse(
      readFileSync(join(cwd, PROJECT_DIR, 'agents', 'qa.json'), 'utf8'),
    ) as { contextIds: string[] }
    expect(agent.contextIds).toEqual(['iaterminal:folderTree:folders', 'iaterminal:deps:Dependencies'])
    expect(readFileSync(join(cwd, PROJECT_DIR, 'context', 'folders.md'), 'utf8')).not.toContain('legacyIds')
  })

  it('prunes orphan results and agent contextIds not in discover catalog', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, PROJECT_DIR, 'results'), { recursive: true })
    writeFileSync(
      join(cwd, PROJECT_DIR, 'folders.md'),
      [
        '# folders',
        '<!-- iaterminal:context {"version":1,"id":"iaterminal:folderTree","name":"folders","fileName":"folders.md","kind":"folderTree","legacyIds":["discovered-file:folders.md"]} -->',
        '',
        '<!-- iaterminal:auto -->',
        'tree',
        '<!-- /iaterminal:auto -->',
        '',
        '<!-- iaterminal:notes -->',
        '(no annotations yet)',
        '<!-- /iaterminal:notes -->',
        '',
      ].join('\n'),
      'utf8',
    )
    writeFileSync(
      join(cwd, PROJECT_DIR, 'results', 'designer.md'),
      '# orphan\n<!-- iaterminal:context {"version":1,"id":"iaterminal:result:designer","name":"d","fileName":"results/designer.md","kind":"agentResult"} -->\n',
      'utf8',
    )
    writeFileSync(
      join(cwd, PROJECT_DIR, 'results', 'qa.md'),
      '# qa\n<!-- iaterminal:context {"version":1,"id":"iaterminal:result:qa","name":"qa","fileName":"results/qa.md","kind":"agentResult"} -->\n',
      'utf8',
    )
    // Own result:qa se quita en parse/upsert, no por ausencia en catálogo discover.
    upsertProjectAgent(cwd, {
      id: 'qa',
      name: 'qa',
      provider: 'cursor',
      permissionMode: 'default',
      contextIds: ['iaterminal:folderTree', 'iaterminal:result:designer', 'iaterminal:result:qa'],
    })
    const result = discoverTabContexts(cwd)
    expect(result.ok).toBe(true)
    expect(existsSync(join(cwd, PROJECT_DIR, 'results', 'designer.md'))).toBe(false)
    expect(existsSync(join(cwd, PROJECT_DIR, 'results', 'qa.md'))).toBe(true)
    expect(readFileSync(join(cwd, PROJECT_DIR, 'context', 'folders.md'), 'utf8')).not.toContain('legacyIds')
    const agent = JSON.parse(
      readFileSync(join(cwd, PROJECT_DIR, 'agents', 'qa.json'), 'utf8'),
    ) as { contextIds?: string[] }
    expect(agent.contextIds).toEqual(['iaterminal:folderTree:folders'])
    expect(result.contexts.some(item => item.id === 'iaterminal:result:qa')).toBe(true)
  })

  it('normalizes Product-Designer.md result id and keeps foreign agent refs', () => {
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
        'ok',
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
    })
    upsertProjectAgent(cwd, {
      id: 'orchestrator',
      name: 'Orchestrator',
      provider: 'cursor',
      permissionMode: 'default',
      contextIds: ['iaterminal:result:Product-Designer'],
    })

    const result = discoverTabContexts(cwd)
    expect(result.ok).toBe(true)
    const found = result.contexts.find(item => item.kind === 'agentResult')
    expect(found?.id).toBe('iaterminal:result:product-designer')
    expect(existsSync(join(cwd, PROJECT_DIR, 'results', 'product-designer.md'))).toBe(true)
    const orch = JSON.parse(
      readFileSync(join(cwd, PROJECT_DIR, 'agents', 'orchestrator.json'), 'utf8'),
    ) as { contextIds?: string[] }
    expect(orch.contextIds).toEqual(['iaterminal:result:product-designer'])
  })

  it('keeps cross-assigned result:qa on fullstack through discover+prune', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, PROJECT_DIR, 'results'), { recursive: true })
    writeFileSync(
      join(cwd, PROJECT_DIR, 'results', 'qa.md'),
      [
        '# qa — Results',
        '<!-- iaterminal:context {"version":1,"id":"iaterminal:result:qa","name":"qa","fileName":"results/qa.md","kind":"agentResult"} -->',
        '',
        '<!-- iaterminal:auto -->',
        '## Latest',
        'GO',
        '',
        '## Log',
        '- (no entries yet)',
        '<!-- /iaterminal:auto -->',
        '',
      ].join('\n'),
      'utf8',
    )
    writeFileSync(
      join(cwd, PROJECT_DIR, 'results', 'fullstack.md'),
      [
        '# fullstack — Results',
        '<!-- iaterminal:context {"version":1,"id":"iaterminal:result:fullstack","name":"fullstack","fileName":"results/fullstack.md","kind":"agentResult"} -->',
        '',
        '<!-- iaterminal:auto -->',
        '## Latest',
        'working',
        '',
        '## Log',
        '- (no entries yet)',
        '<!-- /iaterminal:auto -->',
        '',
      ].join('\n'),
      'utf8',
    )
    upsertProjectAgent(cwd, {
      id: 'qa',
      name: 'qa',
      provider: 'cursor',
      permissionMode: 'default',
    })
    upsertProjectAgent(cwd, {
      id: 'fullstack',
      name: 'fullstack',
      provider: 'cursor',
      permissionMode: 'default',
      contextIds: ['iaterminal:result:qa'],
    })

    const result = discoverTabContexts(cwd)
    expect(result.ok).toBe(true)
    expect(result.contexts.map(item => item.id).sort()).toEqual([
      'iaterminal:result:fullstack',
      'iaterminal:result:qa',
    ])
    const fullstack = JSON.parse(
      readFileSync(join(cwd, PROJECT_DIR, 'agents', 'fullstack.json'), 'utf8'),
    ) as { contextIds?: string[] }
    expect(fullstack.contextIds).toEqual(['iaterminal:result:qa'])
  })

  it('does not auto-assign own result contextIds on discover', () => {
    const cwd = tempCwd()
    upsertProjectAgent(cwd, {
      id: 'scout',
      name: 'Scout',
      provider: 'cursor',
      permissionMode: 'default',
      contextIds: ['iaterminal:result:scout'],
    })
    upsertAiAgentResults(cwd, 'scout', {
      summary: 'Listo',
      entries: ['ok'],
    }, { agentName: 'Scout', timestamp: '2026-07-20T12:00:00.000Z' })

    const result = discoverTabContexts(cwd)
    expect(result.ok).toBe(true)
    expect(result.contexts.some(item => item.id === 'iaterminal:result:scout')).toBe(true)
    const agent = JSON.parse(
      readFileSync(join(cwd, PROJECT_DIR, 'agents', 'scout.json'), 'utf8'),
    ) as { contextIds?: string[] }
    expect(agent.contextIds ?? []).not.toContain('iaterminal:result:scout')
  })

  it('dual materialize of distinct folderTree names writes two files', () => {
    const cwd = tempCwd()
    const firstDef = applyCanonicalContextIdentity({
      id: '',
      name: '',
      fileName: '',
      kind: 'folderTree',
    })
    const secondDef = applyCanonicalContextIdentity({
      id: 'other',
      name: 'Other label',
      fileName: '',
      kind: 'folderTree',
    })
    expect(firstDef.id).toBe('iaterminal:folderTree:folders')
    expect(secondDef.id).toBe('iaterminal:folderTree:Other-label')
    expect(firstDef.fileName).not.toBe(secondDef.fileName)
    const first = materializeTabContext(firstDef, cwd, { write: true })
    const second = materializeTabContext(secondDef, cwd, { write: true })
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(first.filePath).not.toBe(second.filePath)
    expect(existsSync(join(cwd, PROJECT_DIR, 'context', 'folders.md'))).toBe(true)
    expect(existsSync(join(cwd, PROJECT_DIR, 'context', 'Other-label.md'))).toBe(true)
    expect(discoverTabContexts(cwd).contexts.filter(item => item.kind === 'folderTree')).toHaveLength(2)
  })

  it('rejects writing over another context file with the same name', () => {
    const cwd = tempCwd()
    const first = applyCanonicalContextIdentity({
      id: '',
      name: 'Shared',
      fileName: '',
      kind: 'notes',
    })
    materializeTabContext(first, cwd, { write: true, content: 'one' })
    const conflict = materializeTabContext({
      id: 'other-id',
      name: 'Shared',
      fileName: 'Shared.md',
      kind: 'folderTree',
    }, cwd, { write: true })
    expect(conflict.ok).toBe(false)
    expect(conflict.error).toMatch(/already exists/i)
  })

  it('renames a context changing only the letter case', () => {
    const cwd = tempCwd()
    const original = applyCanonicalContextIdentity({
      id: '', name: 'Notas', fileName: '', kind: 'notes',
    })
    materializeTabContext(original, cwd, { write: true, content: 'contenido' })
    const renamed = applyCanonicalContextIdentity({ ...original, name: 'notas' })
    const result = materializeTabContext(renamed, cwd, {
      write: true,
      content: 'contenido',
      previousFileName: original.fileName,
    })
    expect(result.error).toBeUndefined()
    expect(result.ok).toBe(true)
    expect(readFileSync(join(cwd, PROJECT_DIR, renamed.fileName), 'utf8')).toContain('contenido')
    expect(discoverTabContexts(cwd).contexts.map(item => item.name)).toEqual(['notas'])
  })

  it('deletes a materialized context file from <projectDir>', () => {
    const cwd = tempCwd()
    const context = applyCanonicalContextIdentity({
      id: 'to-delete',
      name: 'Temporal',
      fileName: 'temporal.md',
      kind: 'folderTree' as const,
    })
    materializeTabContext(context, cwd, { write: true })
    expect(existsSync(join(cwd, PROJECT_DIR, context.fileName))).toBe(true)

    const deleted = deleteTabContext(context, cwd)

    expect(deleted.ok).toBe(true)
    expect(existsSync(join(cwd, PROJECT_DIR, context.fileName))).toBe(false)
    expect(discoverTabContexts(cwd).contexts).toEqual([])
  })

  it('preserves annotations when rematerializing symbols', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'src'), { recursive: true })
    writeFileSync(join(cwd, 'src', 'App.tsx'), `
export class App {
  handleAddTab(title: string, activate?: boolean): Promise<string> {
    return Promise.resolve(title)
  }
}
`, 'utf8')
    const context = {
      id: 'symbols',
      name: 'Símbolos',
      fileName: 'symbols.md',
      kind: 'symbols' as const,
      paths: ['src/App.tsx'],
      symbolKinds: ['class', 'method'] as Array<'class' | 'method'>,
    }
    writeLegacyAnnotations(materializeTabContext(context, cwd, { write: true }).filePath!, [
      { key: 'src/App.tsx#class:App', text: 'Orquesta tabs y paneles' },
      { key: 'src/App.tsx#method:App.handleAddTab', text: 'Crea pestaña nueva' },
    ])

    writeFileSync(join(cwd, 'src', 'App.tsx'), `
export class App {
  handleAddTab(title: string): string {
    return title
  }
}
`, 'utf8')
    const refreshed = materializeTabContext(context, cwd, { write: true })
    expect(refreshed.ok).toBe(true)
    expect(refreshed.content).toContain('<!-- iaterminal:auto -->')
    expect(refreshed.content).toContain('### src/App.tsx')
    expect(refreshed.content).toMatch(/^- App:.*handleAddTab/m)
    expect(refreshed.content).not.toContain('signature:')
    expect(refreshed.content).toContain('Orquesta tabs y paneles')
    expect(refreshed.content).toContain('Crea pestaña nueva')
  })

  it('preserves markers and annotations when generated symbols exceed the limit', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'src'), { recursive: true })
    const paths: string[] = []
    for (let fileIndex = 0; fileIndex < 12; fileIndex += 1) {
      const relativePath = `src/generated-${fileIndex}.ts`
      paths.push(relativePath)
      const methods = Array.from(
        { length: 80 },
        (_, methodIndex) => `  method_${fileIndex}_${methodIndex}(): number { return ${methodIndex} }`,
      ).join('\n')
      writeFileSync(
        join(cwd, relativePath),
        `export class Generated_${fileIndex} {\n${methods}\n}\n`,
        'utf8',
      )
    }
    const context = {
      id: 'large-symbols',
      name: 'Símbolos grandes',
      fileName: 'large-symbols.md',
      kind: 'symbols' as const,
      paths,
      symbolKinds: ['class', 'method'] as Array<'class' | 'method'>,
    }

    writeLegacyAnnotations(materializeTabContext(context, cwd, { write: true }).filePath!, [
      { key: 'src/generated-0.ts#class:Generated_0', text: 'Clase generada inicial' },
    ])
    const refreshed = materializeTabContext(context, cwd, { write: true })

    expect(refreshed.content.length).toBeLessThanOrEqual(250_000)
    expect(refreshed.content).toContain('<!-- /iaterminal:auto -->')
    expect(refreshed.content).toContain('<!-- iaterminal:notes -->')
    expect(refreshed.content).toContain('Clase generada inicial')
    expect(refreshed.content).toContain('<!-- /iaterminal:notes -->')
  })

  it('keeps late alphabetical modules when symbols exceed the old 45k cap', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'back', 'src', 'alpha'), { recursive: true })
    mkdirSync(join(cwd, 'back', 'src', 'zeta'), { recursive: true })
    // Muchos símbolos tempranos (como Nest bajo "a*") que antes llenaban 45k.
    for (let index = 0; index < 40; index += 1) {
      const methods = Array.from(
        { length: 25 },
        (_, methodIndex) => `  alphaMethod_${methodIndex}(): number { return ${methodIndex} }`,
      ).join('\n')
      writeFileSync(
        join(cwd, 'back', 'src', 'alpha', `mod-${String(index).padStart(2, '0')}.ts`),
        `export class Alpha_${index} {\n${methods}\n}\n`,
        'utf8',
      )
    }
    writeFileSync(
      join(cwd, 'back', 'src', 'zeta', 'LateService.ts'),
      'export class LateService { run(): void {} }\n',
      'utf8',
    )
    const result = materializeTabContext({
      id: 'alpha-truncation',
      name: 'Classes',
      fileName: 'classes.md',
      kind: 'symbols',
      rootPath: 'back/src',
    }, cwd, { write: true })

    expect(result.content).toContain('### back/src/zeta/LateService.ts')
    expect(result.content).toMatch(/^- LateService:.*\brun\b/m)
    expect(result.content).not.toContain('constructor')
  })

  it('removes a legacy notes layer only when it exactly duplicates auto', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'unique-dir'), { recursive: true })
    const context = {
      id: 'tree',
      name: 'Árbol',
      fileName: 'tree.md',
      kind: 'folderTree' as const,
    }
    const initial = materializeTabContext(context, cwd, { write: true })
    const auto = initial.content.match(
      /<!-- iaterminal:auto -->([\s\S]*?)<!-- \/iaterminal:auto -->/,
    )?.[1].trim() ?? ''
    const duplicated = initial.content.replace('(no annotations yet)', auto)
    writeFileSync(join(cwd, PROJECT_DIR, 'context', 'tree.md'), duplicated, 'utf8')

    const refreshed = materializeTabContext(context, cwd, { write: true })

    expect(refreshed.notesContent).toBe('')
    expect(refreshed.content.match(/unique-dir/g)).toHaveLength(1)
    expect(refreshed.content).toContain('(no annotations yet)')
  })

  it('lists class methods and exported top-level functions without signatures', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'src'), { recursive: true })
    writeFileSync(join(cwd, 'src', 'Service.ts'), `
export class Service {
  start(): void {}
  stop(): Promise<void> { return Promise.resolve() }
}
export function orphanHelper(): number { return 1 }
export const localValue = 2
export const renderPanel = (): string => 'ok'
const hiddenHelper = (): void => {}
`, 'utf8')
    const context = {
      id: 'brief-symbols',
      name: 'Símbolos',
      fileName: 'brief-symbols.md',
      kind: 'symbols' as const,
      paths: ['src/Service.ts'],
    }

    const result = materializeTabContext(context, cwd, { write: true })

    expect(result.ok).toBe(true)
    expect(result.content).toContain('### src/Service.ts')
    expect(result.content).toContain('- Service: start, stop')
    expect(result.content).toContain('- orphanHelper')
    expect(result.content).toContain('- renderPanel')
    expect(result.content).not.toContain('signature:')
    expect(result.content).not.toContain('localValue')
    expect(result.content).not.toContain('hiddenHelper')
    expect(result.content).not.toContain('#variable:')
  })

  it('indexes forwardRef and memo exports as methods', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'src'), { recursive: true })
    writeFileSync(join(cwd, 'src', 'TabBar.tsx'), `
import React, { forwardRef, memo } from 'react'
export const TabBar = forwardRef(function TabBar() { return null })
export const Chip = memo(() => null)
`, 'utf8')
    const result = materializeTabContext({
      id: 'forward-ref',
      name: 'Símbolos',
      fileName: 'forward-ref.md',
      kind: 'symbols',
      paths: ['src/TabBar.tsx'],
    }, cwd, { write: true })

    expect(result.content).toContain('- TabBar')
    expect(result.content).toContain('- Chip')
  })

  it('scans far enough to include files beyond the first alphabetical batch', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'src', 'a'), { recursive: true })
    mkdirSync(join(cwd, 'src', 'z', 'deep'), { recursive: true })
    for (let index = 0; index < 90; index += 1) {
      writeFileSync(
        join(cwd, 'src', 'a', `file-${String(index).padStart(3, '0')}.ts`),
        `export function early_${index}() { return ${index} }\n`,
        'utf8',
      )
    }
    writeFileSync(
      join(cwd, 'src', 'z', 'deep', 'Late.ts'),
      'export function lateSymbol() { return 1 }\n',
      'utf8',
    )
    const result = materializeTabContext({
      id: 'scan-deep',
      name: 'Símbolos',
      fileName: 'scan-deep.md',
      kind: 'symbols',
      rootPath: 'src',
    }, cwd, { write: true })

    expect(result.content).toContain('### src/z/deep/Late.ts')
    expect(result.content).toContain('- lateSymbol')
  })

  it('scans the root folder for symbols when no paths are listed', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'src'), { recursive: true })
    writeFileSync(join(cwd, 'src', 'Widget.tsx'), `
export class Widget {
  render(): string { return 'ok' }
}
`, 'utf8')
    const context = {
      id: 'symbols-scan',
      name: 'Símbolos',
      fileName: 'symbols-scan.md',
      kind: 'symbols' as const,
      rootPath: 'src',
    }

    const result = materializeTabContext(context, cwd, { write: true })

    expect(result.ok).toBe(true)
    expect(result.content).toContain('### src/Widget.tsx')
    expect(result.content).toMatch(/^- Widget:.*\brender\b/m)
  })

  it('preserves freeform notes text and legacy annotations on refresh', () => {
    const cwd = tempCwd()
    const context = applyCanonicalContextIdentity({
      id: 'tree',
      name: 'Árbol',
      fileName: 'arbol.md',
      kind: 'folderTree' as const,
    })
    writeLegacyAnnotations(materializeTabContext(context, cwd, { write: true }).filePath!, [
      { key: 'note:old', text: 'Nota anterior' },
    ])
    const filePath = join(cwd, PROJECT_DIR, context.fileName)
    writeFileSync(
      filePath,
      readFileSync(filePath, 'utf8').replace(
        '<!-- iaterminal:notes -->',
        '<!-- iaterminal:notes -->\nNo eliminar esta decisión.\n',
      ),
      'utf8',
    )

    const refreshed = materializeTabContext(context, cwd, { write: true })

    expect(refreshed.ok).toBe(true)
    expect(refreshed.notesContent).toContain('No eliminar esta decisión.')
    expect(refreshed.notesContent).toContain('Nota anterior')
  })

  it('moves missing symbol annotations to Orphaned', () => {
    const notes = reconcileNotesWithAuto(
      '- `src/App.tsx#class:App` — class `App`',
      [
        '- `src/App.tsx#class:App` — Orquesta tabs',
        '- `src/App.tsx#class:Gone` — Ya no existe',
      ].join('\n'),
    )
    expect(notes).toContain('Orquesta tabs')
    expect(notes).toContain('## Orphaned')
    expect(notes).toContain('src/App.tsx#class:Gone')
  })

  it('rejects annotations longer than 10 words at normalize time', () => {
    expect(normalizeAnnotation({
      key: 'x',
      text: 'uno dos tres cuatro cinco seis siete ocho nueve diez once',
    })).toEqual({
      key: 'x',
      text: 'uno dos tres cuatro cinco seis siete ocho nueve diez',
    })
  })

  it('nunca emite Context maintenance ni el fence ia-terminal-context', () => {
    const cwd = tempCwd()
    const contexts = [
      applyCanonicalContextIdentity({
        id: 'tree',
        name: 'Árbol',
        fileName: 'arbol.md',
        kind: 'folderTree',
      }),
    ]
    const assigned = buildAssignedContexts([...contexts], cwd)
    const delivery = buildContextPromptDelivery([...contexts], cwd, { forceFullRefresh: true })
    for (const text of [assigned, delivery.prompt]) {
      expect(text).not.toContain('## Context maintenance')
      expect(text).not.toContain('```ia-terminal-context')
    }
    expect(assigned).toContain('## Assigned tab contexts')
    expect(readFileSync(join(cwd, PROJECT_DIR, contexts[0].fileName), 'utf8')).toContain('iaterminal:auto')
  })

  it('builds a lightweight section catalog without embedding file contents', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'src'), { recursive: true })
    writeFileSync(join(cwd, 'src', 'one.ts'), 'export const secretOne = 1', 'utf8')
    writeFileSync(join(cwd, 'src', 'two.ts'), 'export const secretTwo = 2', 'utf8')
    const context = {
      id: 'selected-files',
      name: 'Selected files',
      fileName: 'selected-files.md',
      kind: 'files' as const,
      paths: ['src/one.ts', 'src/two.ts'],
    }

    const catalog = buildContextSectionCatalog([context], cwd)
    const prompt = buildContextCatalogPrompt([context], cwd)

    expect(catalog[0].sections.map(section => section.key))
      .toEqual(['src/one.ts', 'src/two.ts'])
    expect(prompt).toContain('ia-terminal-need-sections')
    expect(prompt).toContain('"src/one.ts"')
    expect(prompt).not.toContain('secretOne')
    expect(prompt).not.toContain('secretTwo')
  })

  it('extracts requested section fences and sends only selected content', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'src'), { recursive: true })
    writeFileSync(join(cwd, 'src', 'one.ts'), 'export const included = 1', 'utf8')
    writeFileSync(join(cwd, 'src', 'two.ts'), 'export const excluded = 2', 'utf8')
    const context = {
      id: 'selected-files',
      name: 'Selected files',
      fileName: 'selected-files.md',
      kind: 'files' as const,
      paths: ['src/one.ts', 'src/two.ts'],
    }
    const extracted = extractContextSectionRequest([
      '```ia-terminal-need-sections',
      '{"requests":[{"id":"selected-files","sections":["src/one.ts"]}]}',
      '```',
    ].join('\n'))
    const payload = buildRequestedContextSections([context], cwd, extracted.requests)

    expect(extracted.visibleText).toBe('')
    expect(extracted.requests).toEqual([
      { id: 'selected-files', sections: ['src/one.ts'] },
    ])
    expect(payload.sectionCount).toBe(1)
    expect(payload.prompt).toContain('included')
    expect(payload.prompt).not.toContain('excluded')
    expect(payload.prompt).toContain('section-key: src/one.ts')
  })

  it('auto-attaches context notes when any section is requested', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'src'), { recursive: true })
    writeFileSync(join(cwd, 'src', 'one.ts'), 'export const included = 1', 'utf8')
    writeFileSync(join(cwd, 'src', 'two.ts'), 'export const excluded = 2', 'utf8')
    const context = {
      id: 'selected-files',
      name: 'Selected files',
      fileName: 'selected-files.md',
      kind: 'files' as const,
      paths: ['src/one.ts', 'src/two.ts'],
    }
    writeLegacyAnnotations(materializeTabContext(context, cwd, { write: true }).filePath!, [
      { key: 'note:entrada', text: 'Entrada principal' },
    ])
    clearTabContextMaterializationCache(cwd)

    const payload = buildRequestedContextSections([context], cwd, [
      { id: 'selected-files', sections: ['src/one.ts'] },
    ])

    expect(payload.sectionCount).toBe(1)
    expect(payload.prompt).toContain('included')
    expect(payload.prompt).not.toContain('excluded')
    expect(payload.prompt).toContain('section-key: src/one.ts')
    expect(payload.prompt).toContain('section-key: __notes')
    expect(payload.prompt).toContain('Entrada principal')
  })

  it('notes auto-attach does not spend the named section quota', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'src'), { recursive: true })
    const paths = Array.from({ length: 8 }, (_, index) => `src/f${index}.ts`)
    for (const rel of paths) {
      writeFileSync(join(cwd, rel), `export const v = '${rel}'`, 'utf8')
    }
    const context = {
      id: 'many-files',
      name: 'Many files',
      fileName: 'many-files.md',
      kind: 'files' as const,
      paths,
    }
    writeLegacyAnnotations(materializeTabContext(context, cwd, { write: true }).filePath!, [
      { key: 'note:primera', text: 'Primera pieza' },
    ])
    clearTabContextMaterializationCache(cwd)

    const payload = buildRequestedContextSections([context], cwd, [
      { id: 'many-files', sections: paths },
    ])

    expect(payload.sectionCount).toBe(8)
    expect(payload.prompt).toContain('section-key: __notes')
    expect(payload.prompt).toContain('Primera pieza')
    expect(payload.errors).not.toContain('Section limit reached (8).')
  })

  it('reports unknown context sections without exposing other sections', () => {
    const cwd = tempCwd()
    const context = {
      id: 'dependencies',
      name: 'Dependencies',
      fileName: 'dependencies.md',
      kind: 'deps' as const,
    }
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({
      scripts: { test: 'vitest' },
      dependencies: { react: '18' },
    }), 'utf8')

    const payload = buildRequestedContextSections([context], cwd, [
      { id: 'dependencies', sections: ['missing'] },
    ])

    expect(payload.sectionCount).toBe(0)
    expect(payload.prompt).toContain('Unknown section "missing"')
    expect(payload.prompt).not.toContain('"react"')
  })

  it('catalogs all contexts; does not attach bodies by default', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'src'), { recursive: true })
    writeFileSync(join(cwd, 'src', 'one.ts'), 'export const sourceValue = 1', 'utf8')
    const files = {
      id: 'files',
      name: 'Archivos',
      fileName: 'files.md',
      kind: 'files' as const,
      paths: ['src/one.ts'],
    }
    const deps = {
      id: 'dependencies',
      name: 'Dependencies',
      fileName: 'dependencies.md',
      kind: 'deps' as const,
    }
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'demo' }), 'utf8')

    const prompt = buildContextCatalogPrompt([deps, files], cwd)

    expect(prompt).not.toContain('## Attached tab contexts')
    expect(prompt).toContain('## Available tab contexts (on demand)')
    expect(prompt).toContain('"id":"files"')
    expect(prompt).toContain('"id":"dependencies"')
    expect(prompt).not.toContain('sourceValue')
    expect(prompt).toContain('Budget:')
    expect(prompt).toContain('"sectionCount"')
  })

  it('lists only the largest catalog sections and reports omitted keys', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'src'), { recursive: true })
    const paths: string[] = []
    for (let index = 0; index < 30; index++) {
      const rel = `src/file-${index}.ts`
      paths.push(rel)
      writeFileSync(join(cwd, rel), `export const v${index} = ${'x'.repeat(20 + index)}`, 'utf8')
    }
    const files = {
      id: 'many-files',
      name: 'Many files',
      fileName: 'many-files.md',
      kind: 'files' as const,
      paths,
    }
    const delivery = buildContextPromptDelivery([files], cwd)
    const catalogMatch = delivery.prompt.match(/```json\n(\{"contexts":.*\})\n```/)
    expect(catalogMatch).not.toBeNull()
    const catalog = JSON.parse(catalogMatch![1])
    const entry = catalog.contexts[0]
    expect(entry.sectionCount).toBe(30)
    expect(entry.omittedKeys).toHaveLength(6)
    expect(entry.omittedKeys.every((key: string) => typeof key === 'string')).toBe(true)
    expect(delivery.prompt).toContain('"sectionCount":30')
    expect(delivery.catalogChars).toBeGreaterThan(0)
  })

  it('pre-attaches up to two path-matching sections and emits hints', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'src'), { recursive: true })
    writeFileSync(join(cwd, 'src', 'one.ts'), 'export const one = 1', 'utf8')
    writeFileSync(join(cwd, 'src', 'two.ts'), 'export const two = 2', 'utf8')
    writeFileSync(join(cwd, 'src', 'three.ts'), 'export const three = 3', 'utf8')
    const files = {
      id: 'files',
      name: 'Archivos',
      fileName: 'files.md',
      kind: 'files' as const,
      paths: ['src/one.ts', 'src/two.ts', 'src/three.ts'],
    }
    const delivery = buildContextPromptDelivery([files], cwd, {
      userPrompt: 'Please inspect src/one.ts and src/two.ts for bugs',
    })
    expect(delivery.prompt).toContain('## Context hints')
    expect(delivery.prompt).toContain('## Attached tab contexts')
    expect(delivery.prompt).toContain('section-key: src/one.ts')
    expect(delivery.preattachedSectionCount).toBe(2)
    expect(delivery.prompt).toContain('export const one')
  })

  it('suggests unassigned host contexts from the user prompt', () => {
    const cwd = tempCwd()
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'demo' }), 'utf8')
    const tree = {
      id: 'tree',
      name: 'Tree',
      fileName: 'tree.md',
      kind: 'folderTree' as const,
    }
    const deps = {
      id: 'dependencies',
      name: 'Dependencies',
      fileName: 'dependencies.md',
      kind: 'deps' as const,
    }
    const delivery = buildContextPromptDelivery([tree], cwd, {
      userPrompt: 'Which npm dependencies does package.json declare?',
      discoveredContexts: [tree, deps],
    })
    expect(delivery.prompt).toContain('## Suggested contexts (not attached)')
    expect(delivery.prompt).toContain('dependencies')
  })

  it('puts deps and changelog on the on-demand catalog, not as direct attachments', () => {
    const cwd = tempCwd()
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'demo', version: '1.0.0' }), 'utf8')
    const deps = {
      id: 'dependencies',
      name: 'Dependencies',
      fileName: 'dependencies.md',
      kind: 'deps' as const,
    }
    const changelog = {
      id: 'iaterminal:changelog',
      name: 'AI Changelog',
      fileName: 'changelog.md',
      kind: 'changelog' as const,
    }
    materializeTabContext(changelog, cwd, { write: true })

    const prompt = buildContextCatalogPrompt([deps, changelog], cwd)

    expect(prompt).not.toContain('## Attached tab contexts')
    expect(prompt).toContain('## Available tab contexts (on demand)')
    expect(prompt).toContain('"id":"dependencies"')
    expect(prompt).toContain('"id":"iaterminal:changelog"')
  })

  it('attaches custom notes directly without catalog or size caps', () => {
    const cwd = tempCwd()
    const body = `Convención durable.\n\n${'x'.repeat(9_000)}`
    const notes = {
      id: 'custom-notes',
      name: 'Guía del equipo',
      fileName: 'team-guide.md',
      kind: 'notes' as const,
    }
    materializeTabContext(notes, cwd, { write: true, content: body })

    const delivery = buildContextPromptDelivery([notes], cwd, { forceFullRefresh: true })

    expect(delivery.prompt).toContain('## Attached tab contexts')
    expect(delivery.prompt).toContain('Guía del equipo')
    expect(delivery.prompt).toContain('Convención durable.')
    expect(delivery.prompt).toContain('x'.repeat(100))
    expect(delivery.prompt).not.toContain('"id":"custom-notes"')
  })

  it('uses contextContents for org notes without writing .gravity mirrors', () => {
    const cwd = tempCwd()
    const notes = {
      id: 'iaterminal:notes:About',
      name: 'About',
      fileName: 'About.md',
      kind: 'notes' as const,
    }
    const aboutPath = join(cwd, PROJECT_DIR, 'context', 'About.md')
    // Stub vacío previo (o ausente): no debe crecer/actualizarse con el body org.
    mkdirSync(join(cwd, PROJECT_DIR, 'context'), { recursive: true })
    writeFileSync(aboutPath, '# stub\n', 'utf8')
    const before = readFileSync(aboutPath, 'utf8')

    clearTabContextMaterializationCache(cwd)
    const delivery = buildContextPromptDelivery([notes], cwd, {
      forceFullRefresh: true,
      contextContents: {
        'iaterminal:notes:About': 'Org About body from API',
      },
    })

    expect(delivery.prompt).toContain('Org About body from API')
    expect(delivery.prompt).not.toContain('(empty notes)')
    expect(delivery.prompt).not.toContain('(no annotations yet)')
    expect(readFileSync(aboutPath, 'utf8')).toBe(before)
  })

  it('contextContents with missing disk file still embeds body and does not create file', () => {
    const cwd = tempCwd()
    const notes = {
      id: 'iaterminal:notes:About',
      name: 'About',
      fileName: 'About.md',
      kind: 'notes' as const,
    }
    const aboutPath = join(cwd, PROJECT_DIR, 'context', 'About.md')
    clearTabContextMaterializationCache(cwd)
    const delivery = buildContextPromptDelivery([notes], cwd, {
      forceFullRefresh: true,
      contextContents: {
        'iaterminal:notes:About': 'Only in memory',
      },
    })
    expect(delivery.prompt).toContain('Only in memory')
    expect(existsSync(aboutPath)).toBe(false)
  })

  it('without contextContents still reads notes body from disk', () => {
    const cwd = tempCwd()
    const notes = {
      id: 'iaterminal:notes:About',
      name: 'About',
      fileName: 'About.md',
      kind: 'notes' as const,
    }
    materializeTabContext(notes, cwd, { write: true, content: 'Disk About body' })
    clearTabContextMaterializationCache(cwd)
    const delivery = buildContextPromptDelivery([notes], cwd, { forceFullRefresh: true })
    expect(delivery.prompt).toContain('Disk About body')
  })

  it('agentResult materialize keeps ## Latest format (no empty stub overwrite)', () => {
    const cwd = tempCwd()
    upsertProjectAgent(cwd, {
      id: 'scout',
      name: 'Scout',
      provider: 'claude',
      permissionMode: 'auto',
    })
    upsertAiAgentResults(cwd, 'scout', {
      summary: 'Real summary',
      entries: ['Did the thing'],
    }, { agentName: 'Scout' })
    const context = {
      id: 'iaterminal:result:scout',
      name: 'Scout',
      fileName: 'results/scout.md',
      kind: 'agentResult' as const,
    }
    const result = materializeTabContext(context, cwd, { write: true })
    expect(result.ok).toBe(true)
    expect(result.content).toContain('## Latest')
    expect(result.content).toContain('Real summary')
    expect(result.content).not.toMatch(/^\(empty agent results\)$/m)
    const again = materializeTabContext(context, cwd, { write: true })
    expect(again.content).toContain('Real summary')
  })

  it('matrix smoke: notes, agentResult, symbols, folderTree, changelog materialize', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'src'), { recursive: true })
    writeFileSync(join(cwd, 'src', 'a.ts'), 'export const a = 1\n', 'utf8')
    upsertProjectAgent(cwd, {
      id: 'bot',
      name: 'Bot',
      provider: 'claude',
      permissionMode: 'auto',
    })
    upsertAiAgentResults(cwd, 'bot', { summary: 'ok', entries: [] }, { agentName: 'Bot' })

    const kinds = [
      materializeTabContext({
        id: 'iaterminal:notes:N',
        name: 'N',
        fileName: 'N.md',
        kind: 'notes',
      }, cwd, { write: true, content: 'note body' }),
      materializeTabContext({
        id: 'iaterminal:result:bot',
        name: 'Bot',
        fileName: 'results/bot.md',
        kind: 'agentResult',
      }, cwd, { write: true }),
      materializeTabContext({
        id: 'iaterminal:symbols:S',
        name: 'S',
        fileName: 'S.md',
        kind: 'symbols',
        paths: ['src/a.ts'],
      }, cwd, { write: true }),
      materializeTabContext({
        id: 'iaterminal:folderTree:F',
        name: 'F',
        fileName: 'F.md',
        kind: 'folderTree',
      }, cwd, { write: true }),
      materializeTabContext({
        id: 'iaterminal:changelog:C',
        name: 'C',
        fileName: 'C.md',
        kind: 'changelog',
      }, cwd, { write: true }),
    ]
    expect(kinds.every(item => item.ok)).toBe(true)
    expect(kinds[0].content).toContain('note body')
    expect(kinds[1].content).toContain('## Latest')
    expect(kinds[2].ok).toBe(true)
    expect(kinds[3].ok).toBe(true)
    expect(kinds[4].ok).toBe(true)
  })

  it('leaves all contexts on demand regardless of size', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'src'), { recursive: true })
    writeFileSync(join(cwd, 'src', 'one.ts'), `export const x = '${'x'.repeat(8_100)}'`, 'utf8')
    const files = {
      id: 'large-files',
      name: 'Archivos grandes',
      fileName: 'large-files.md',
      kind: 'files' as const,
      paths: ['src/one.ts'],
    }

    const prompt = buildContextCatalogPrompt([files], cwd)

    expect(prompt).not.toContain('## Attached tab contexts')
    expect(prompt).toContain('## Available tab contexts (on demand)')
    expect(prompt).toContain('"id":"large-files"')
    expect(prompt).not.toContain('x'.repeat(100))
  })

  it('invalidates materialized sections when a source file changes', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'src'), { recursive: true })
    const source = join(cwd, 'src', 'one.ts')
    writeFileSync(source, 'export const beforeValue = 1', 'utf8')
    const context = {
      id: 'cached-files',
      name: 'Cached files',
      fileName: 'cached-files.md',
      kind: 'files' as const,
      paths: ['src/one.ts'],
    }
    clearTabContextMaterializationCache(cwd)
    buildContextSectionCatalog([context], cwd)
    writeFileSync(source, 'export const afterValue = 2', 'utf8')

    const payload = buildRequestedContextSections([context], cwd, [
      { id: context.id, sections: ['src/one.ts'] },
    ])

    expect(payload.prompt).toContain('afterValue')
    expect(payload.prompt).not.toContain('beforeValue')
  })

  it('reports malformed requests and deduplicates section keys', () => {
    const malformed = extractContextSectionRequest(
      '```ia-terminal-need-sections\n{bad json}',
    )
    expect(malformed.fenceFound).toBe(true)
    expect(malformed.visibleText).toBe('')
    expect(malformed.errors).toContain('The context request fence is not closed.')
    expect(malformed.errors).toContain('The context request contains invalid JSON.')

    const duplicated = extractContextSectionRequest([
      '```ia-terminal-need-sections',
      JSON.stringify({
        requests: [
          { id: 'files', sections: ['one', 'one'] },
          { id: 'files', sections: ['one', 'two'] },
        ],
      }),
      '```',
    ].join('\n'))
    expect(duplicated.requests).toEqual([
      { id: 'files', sections: ['one', 'two'] },
    ])
    expect(duplicated.errors).toEqual([])
  })

  it('enforces the global named-section limit in the protocol parser', () => {
    const extracted = extractContextSectionRequest([
      '```ia-terminal-need-sections',
      JSON.stringify({
        requests: [{
          id: 'files',
          sections: Array.from({ length: 10 }, (_, index) => `section-${index}`),
        }],
      }),
      '```',
    ].join('\n'))

    expect(extracted.requests[0].sections).toHaveLength(8)
    expect(extracted.errors).toContain('Too many section keys; maximum is 8.')
  })

  it('sends only contexts changed since the previous session snapshot', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'src'), { recursive: true })
    writeFileSync(join(cwd, 'src', 'one.ts'), 'export const stable = 1', 'utf8')
    writeFileSync(join(cwd, 'src', 'two.ts'), 'export const other = 1', 'utf8')
    const filesA = {
      id: 'files-delta',
      name: 'Archivos delta',
      fileName: 'files-delta.md',
      kind: 'files' as const,
      paths: ['src/one.ts'],
    }
    const filesB = {
      id: 'files-other',
      name: 'Otros',
      fileName: 'files-other.md',
      kind: 'files' as const,
      paths: ['src/two.ts'],
    }
    const first = buildContextPromptDelivery([filesA, filesB], cwd)
    const unchanged = buildContextPromptDelivery([filesA, filesB], cwd, {
      previousSnapshot: first.snapshot,
    })

    expect(first.fullRefresh).toBe(true)
    expect(unchanged.fullRefresh).toBe(false)
    expect(unchanged.prompt).toBe('')

    writeFileSync(join(cwd, 'src', 'one.ts'), 'export const stable = 2', 'utf8')
    clearTabContextMaterializationCache(cwd)
    const changed = buildContextPromptDelivery([filesA, filesB], cwd, {
      previousSnapshot: first.snapshot,
    })

    expect(changed.prompt).toContain('## Tab context changes')
    expect(changed.prompt).toContain('"id":"files-delta"')
    expect(changed.prompt).not.toContain('"id":"files-other"')
  })

  it('reports removed contexts and supports forced full refreshes', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'src'), { recursive: true })
    writeFileSync(join(cwd, 'src', 'one.ts'), 'export const a = 1', 'utf8')
    writeFileSync(join(cwd, 'src', 'two.ts'), 'export const b = 1', 'utf8')
    const firstContext = {
      id: 'first',
      name: 'Primero',
      fileName: 'first.md',
      kind: 'files' as const,
      paths: ['src/one.ts'],
    }
    const removedContext = {
      id: 'removed',
      name: 'Eliminado',
      fileName: 'removed.md',
      kind: 'files' as const,
      paths: ['src/two.ts'],
    }
    const initial = buildContextPromptDelivery([firstContext, removedContext], cwd)

    const delta = buildContextPromptDelivery([firstContext], cwd, {
      previousSnapshot: initial.snapshot,
    })
    expect(delta.prompt).toContain('Removed: removed')
    expect(delta.prompt).not.toContain('"id":"removed"')

    const refresh = buildContextPromptDelivery([firstContext], cwd, {
      previousSnapshot: initial.snapshot,
      forceFullRefresh: true,
    })
    expect(refresh.fullRefresh).toBe(true)
    expect(refresh.prompt).toContain('## Tab context snapshot')
    expect(refresh.prompt).toContain('"id":"first"')
  })

  it('materializa un skill desde SKILL.md y lo secciona por encabezados', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, PROJECT_DIR, 'skills', 'afp-zero'), { recursive: true })
    writeFileSync(
      join(cwd, PROJECT_DIR, 'skills', 'afp-zero', 'SKILL.md'),
      ['## Cuándo usarla', 'Al migrar AFP.', '## Pasos', '1. Leer el contrato.'].join('\n'),
    )

    const context: TabContext = {
      id: 'iaterminal:skill:afp-zero',
      name: 'afp-zero',
      fileName: 'afp-zero.md',
      kind: 'skill',
    }
    const result = materializeTabContext(context, cwd)

    expect(result.ok).toBe(true)
    expect(result.content).toContain('## Cuándo usarla')
    expect(result.content).toContain('## Pasos')
    expect(sectionsForContext(context, result).map(s => s.key))
      .toEqual(['Cuándo usarla', 'Pasos'])
  })

  it('un skill sin SKILL.md en disco no revienta: cuerpo vacío, ok true', () => {
    const cwd = tempCwd()
    const result = materializeTabContext(
      { id: 'iaterminal:skill:nada', name: 'nada', fileName: 'nada.md', kind: 'skill' },
      cwd,
    )
    expect(result.ok).toBe(true)
    expect(result.content).toContain('(empty)')
  })

  // Criterio de aceptación 4: install ≠ assign.
  it('un SKILL.md en disco no aparece como contexto descubierto', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, PROJECT_DIR, 'skills', 'afp-zero'), { recursive: true })
    writeFileSync(join(cwd, PROJECT_DIR, 'skills', 'afp-zero', 'SKILL.md'), '## Uno\ncuerpo')

    // discoverTabContexts no lista skills/: instalar una skill no la asigna.
    const found = discoverTabContexts(cwd)
    expect(found.contexts.some(context => context.kind === 'skill')).toBe(false)
  })

  describe('wiki context (kind wiki, catálogo por secciones)', () => {
    const wikiContext: TabContext = {
      id: 'iaterminal:wiki',
      name: 'Wiki',
      fileName: 'context/wiki.md',
      kind: 'wiki',
    }

    const seedWiki = (cwd: string): void => {
      mkdirSync(join(cwd, PROJECT_DIR, 'wiki', 'pages'), { recursive: true })
      writeFileSync(
        join(cwd, PROJECT_DIR, 'wiki', 'index.md'),
        '# Wiki index\n\n- [[auth]] — Auth (concept)\n',
        'utf8',
      )
      writeFileSync(
        join(cwd, PROJECT_DIR, 'wiki', 'log.md'),
        '# Wiki log\n- `2026-08-13T00:00:00.000Z` — seeded\n',
        'utf8',
      )
      writeFileSync(
        join(cwd, PROJECT_DIR, 'wiki', 'pages', 'auth.md'),
        '# Auth\n<!-- iaterminal:wiki-page {"type":"concept"} -->\n\nCuerpo de auth.\n',
        'utf8',
      )
    }

    it('se descubre como contexto sintético cuando la wiki existe en disco', () => {
      const cwd = tempCwd()
      seedWiki(cwd)
      const result = discoverTabContexts(cwd)
      expect(result.ok).toBe(true)
      expect(result.contexts).toContainEqual(wikiContext)
    })

    it('sin .gravity/wiki no aparece contexto wiki', () => {
      const cwd = tempCwd()
      mkdirSync(join(cwd, PROJECT_DIR), { recursive: true })
      const result = discoverTabContexts(cwd)
      expect(result.ok).toBe(true)
      expect(result.contexts.some(context => context.kind === 'wiki')).toBe(false)
    })

    it('el mirror materializado no duplica el contexto en discovery', () => {
      const cwd = tempCwd()
      seedWiki(cwd)
      materializeTabContext(wikiContext, cwd, { write: true })
      const found = discoverTabContexts(cwd).contexts.filter(context => context.kind === 'wiki')
      expect(found).toHaveLength(1)
      expect(found[0].id).toBe('iaterminal:wiki')
    })

    it('materializa el mirror wiki.md con index, pages y log seccionables', () => {
      const cwd = tempCwd()
      seedWiki(cwd)
      const result = materializeTabContext(wikiContext, cwd, { write: true })
      expect(result.ok).toBe(true)
      expect(result.content).toContain('## Index')
      expect(result.content).toContain('- [[auth]] — Auth (concept)')
      expect(result.content).toContain('### auth')
      expect(result.content).toContain('Cuerpo de auth.')
      expect(result.content).toContain('## Log')
      expect(result.content).toContain('seeded')
      expect(existsSync(join(cwd, PROJECT_DIR, 'context', 'wiki.md'))).toBe(true)
      expect(sectionsForContext(wikiContext, result).map(section => section.key))
        .toEqual(['index', 'auth', 'log'])
    })

    it('el mirror recorta el log a las últimas 20 líneas', () => {
      const cwd = tempCwd()
      seedWiki(cwd)
      const entries = Array.from(
        { length: 25 },
        (_, index) => `- entry-${String(index + 1).padStart(2, '0')}`,
      )
      writeFileSync(
        join(cwd, PROJECT_DIR, 'wiki', 'log.md'),
        `# Wiki log\n${entries.join('\n')}\n`,
        'utf8',
      )
      const result = materializeTabContext(wikiContext, cwd, { write: true })
      expect(result.content).toContain('- entry-25')
      expect(result.content).toContain('- entry-06')
      expect(result.content).not.toContain('- entry-05')
    })

    it('con wiki en disco emite el bloque Project wiki en delivery; assigned mantiene Wiki ingest', () => {
      const cwd = tempCwd()
      seedWiki(cwd)
      const tree = applyCanonicalContextIdentity({
        id: '',
        name: '',
        fileName: '',
        kind: 'folderTree',
      })
      const assigned = buildAssignedContexts([tree, wikiContext], cwd)
      const delivery = buildContextPromptDelivery([tree, wikiContext], cwd, {
        forceFullRefresh: true,
      })
      expect(delivery.prompt).toContain('## Available tab contexts (on demand)')
      expect(delivery.prompt).not.toContain('## Attached tab contexts')
      expect(delivery.prompt).not.toContain('context-id: iaterminal:wiki')
      expect(delivery.prompt).toContain('## Project wiki')
      expect(delivery.prompt).toContain('Consult this index FIRST')
      expect(delivery.prompt).toContain('- [[auth]] — Auth (concept) — Cuerpo de auth.')
      expect(delivery.prompt).toContain('Recent log:')
      expect(delivery.prompt).toContain('```ia-terminal-wiki')
      for (const text of [assigned]) {
        expect(text).not.toContain('## Context maintenance')
        expect(text).not.toContain('```ia-terminal-context')
        expect(text).toContain('## Wiki ingest')
        const block = text.split('## Wiki ingest')[1] ?? ''
        expect(block).toContain('index for agents')
        expect(block).toContain('narrate')
        expect(block).toContain('locate')
        expect(block).toContain('inventory')
        expect(block).toContain('create-agent')
        expect(block).toContain('[[slug]]')
        expect(block).toContain('If new knowledge contradicts an existing page')
        expect(block).toContain('≤8 ops/turn, body ≤10000, title ≤120, log ≤200')
        expect(block).toContain('concept|decision|flow|reference')
        expect(block).toContain('```ia-terminal-wiki')
        expect(block).toContain('{"op":"upsert","slug":"create-agent"')
        expect(block).toContain('{"op":"delete","slug":"old-page"}')
      }
    })

    it('Project wiki emite ruta absoluta a pages bajo .gravity, no relativa', () => {
      const cwd = tempCwd()
      seedWiki(cwd)
      const pagesDir = join(cwd, PROJECT_DIR, 'wiki', 'pages')
      const delivery = buildContextPromptDelivery([], cwd, { forceFullRefresh: true })
      expect(delivery.prompt).toContain(pagesDir)
      expect(delivery.prompt).not.toContain('`.gravity/wiki/pages/')
    })

    it('Project wiki con wiki legacy .iaterminal emite ruta absoluta a pages', () => {
      const cwd = tempCwd()
      mkdirSync(join(cwd, '.iaterminal', 'wiki', 'pages'), { recursive: true })
      writeFileSync(
        join(cwd, '.iaterminal', 'wiki', 'index.md'),
        '# Wiki index\n\n- [[auth]] — Auth (concept)\n',
        'utf8',
      )
      writeFileSync(
        join(cwd, '.iaterminal', 'wiki', 'log.md'),
        '# Wiki log\n- `2026-08-13T00:00:00.000Z` — seeded\n',
        'utf8',
      )
      writeFileSync(
        join(cwd, '.iaterminal', 'wiki', 'pages', 'auth.md'),
        '# Auth\n<!-- iaterminal:wiki-page {"type":"concept"} -->\n\nCuerpo de auth.\n',
        'utf8',
      )
      const pagesDir = join(cwd, '.iaterminal', 'wiki', 'pages')
      const delivery = buildContextPromptDelivery([], cwd, { forceFullRefresh: true })
      expect(delivery.prompt).toContain(pagesDir)
    })

    it('sin wiki en disco no hay Project wiki ni Wiki ingest en delivery', () => {
      const cwd = tempCwd()
      const tree = applyCanonicalContextIdentity({
        id: '',
        name: '',
        fileName: '',
        kind: 'folderTree',
      })
      const assigned = buildAssignedContexts([tree], cwd)
      const delivery = buildContextPromptDelivery([tree], cwd, {
        forceFullRefresh: true,
      })
      for (const text of [assigned, delivery.prompt]) {
        expect(text).not.toContain('## Context maintenance')
        expect(text).not.toContain('## Project wiki')
        expect(text).not.toContain('## Wiki ingest')
        expect(text).not.toContain('```ia-terminal-wiki')
      }
    })

    it('con wiki en disco y contexts=[] emite Project wiki con índice compacto e ingest', () => {
      const cwd = tempCwd()
      seedWiki(cwd)
      const delivery = buildContextPromptDelivery([], cwd, { forceFullRefresh: true })
      expect(delivery.prompt).toContain('## Project wiki')
      expect(delivery.prompt).toContain('Consult this index FIRST')
      expect(delivery.prompt).toContain('- [[auth]] — Auth (concept) — Cuerpo de auth.')
      expect(delivery.prompt).toContain('```ia-terminal-wiki')
    })

    it('segunda entrega sin cambios en index/log no re-emite Project wiki', () => {
      const cwd = tempCwd()
      seedWiki(cwd)
      const first = buildContextPromptDelivery([], cwd, { forceFullRefresh: true })
      expect(first.prompt).toContain('## Project wiki')
      const second = buildContextPromptDelivery([], cwd, { previousSnapshot: first.snapshot })
      expect(second.prompt).not.toContain('## Project wiki')
    })

    it('borrar la wiki tras snapshot previo emite Project wiki removed sin contextos asignados', () => {
      const cwd = tempCwd()
      seedWiki(cwd)
      const first = buildContextPromptDelivery([], cwd, { forceFullRefresh: true })
      rmSync(join(cwd, PROJECT_DIR, 'wiki'), { recursive: true, force: true })
      const second = buildContextPromptDelivery([], cwd, { previousSnapshot: first.snapshot })
      expect(second.prompt).toContain('## Project wiki removed')
      expect(second.prompt).toContain('Forget the previously supplied ## Project wiki block')
      expect(second.prompt).not.toContain('The index below is your navigation map.')
      expect(second.snapshot.fingerprints['iaterminal:wiki']).toBeUndefined()
    })

    it('borrar la wiki tras snapshot previo emite Project wiki removed con contextos asignados', () => {
      const cwd = tempCwd()
      seedWiki(cwd)
      const tree = applyCanonicalContextIdentity({
        id: '',
        name: '',
        fileName: '',
        kind: 'folderTree',
      })
      const first = buildContextPromptDelivery([tree], cwd, { forceFullRefresh: true })
      expect(first.prompt).toContain('The index below is your navigation map.')
      rmSync(join(cwd, PROJECT_DIR, 'wiki'), { recursive: true, force: true })
      const second = buildContextPromptDelivery([tree], cwd, { previousSnapshot: first.snapshot })
      expect(second.prompt).toContain('## Project wiki removed')
      expect(second.prompt).toContain('Forget the previously supplied ## Project wiki block')
      expect(second.prompt).not.toContain('The index below is your navigation map.')
      expect(second.snapshot.fingerprints['iaterminal:wiki']).toBeUndefined()
    })

    it('un context kind wiki asignado no aparece en attached ni en catálogo on-demand', () => {
      const cwd = tempCwd()
      seedWiki(cwd)
      const tree = applyCanonicalContextIdentity({
        id: '',
        name: '',
        fileName: '',
        kind: 'folderTree',
      })
      const delivery = buildContextPromptDelivery([tree, wikiContext], cwd, {
        forceFullRefresh: true,
      })
      expect(delivery.prompt).not.toContain('context-id: iaterminal:wiki')
      expect(delivery.prompt).not.toContain('### Wiki [wiki]')
      const catalogSection = delivery.prompt.split('## Available tab contexts (on demand)')[1] ?? ''
      expect(catalogSection).not.toContain('"id":"iaterminal:wiki"')
    })

    it('deleteTabContext borra solo el mirror, jamás la carpeta wiki/', () => {
      const cwd = tempCwd()
      seedWiki(cwd)
      materializeTabContext(wikiContext, cwd, { write: true })
      expect(existsSync(join(cwd, PROJECT_DIR, 'context', 'wiki.md'))).toBe(true)

      const deleted = deleteTabContext(wikiContext, cwd)

      expect(deleted.ok).toBe(true)
      expect(existsSync(join(cwd, PROJECT_DIR, 'context', 'wiki.md'))).toBe(false)
      expect(existsSync(join(cwd, PROJECT_DIR, 'wiki', 'index.md'))).toBe(true)
      expect(existsSync(join(cwd, PROJECT_DIR, 'wiki', 'log.md'))).toBe(true)
      expect(existsSync(join(cwd, PROJECT_DIR, 'wiki', 'pages', 'auth.md'))).toBe(true)
      // La wiki sigue en disco: se re-descubre en el siguiente discover.
      expect(discoverTabContexts(cwd).contexts.some(context => context.kind === 'wiki')).toBe(true)
    })

    it('la firma de caché invalida cuando cambia una page de la wiki', () => {
      const cwd = tempCwd()
      seedWiki(cwd)
      clearTabContextMaterializationCache(cwd)
      buildContextSectionCatalog([wikiContext], cwd)
      writeFileSync(
        join(cwd, PROJECT_DIR, 'wiki', 'pages', 'auth.md'),
        '# Auth\n\nCuerpo actualizado.\n',
        'utf8',
      )

      const payload = buildRequestedContextSections([wikiContext], cwd, [
        { id: 'iaterminal:wiki', sections: ['auth'] },
      ])

      expect(payload.prompt).toContain('Cuerpo actualizado.')
      expect(payload.prompt).not.toContain('Cuerpo de auth.')
    })
  })
})

// temporary - will be cleaned: quick repro
