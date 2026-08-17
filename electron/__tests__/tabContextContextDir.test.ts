import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  deleteTabContext,
  discoverTabContexts,
  materializeTabContext,
} from '../tabContextBuild'
import { upsertProjectAgent } from '../projectAgentCatalogOps'
import {
  applyCanonicalContextIdentity,
  CONTEXT_SUBDIR,
  type TabContext,
} from '../../src/shared/tabContext'
import { PROJECT_DIR } from '../../src/shared/projectDir'

describe('context files live under <projectDir>/context/', () => {
  const dirs: string[] = []
  const tempCwd = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'ia-terminal-context-dir-'))
    dirs.push(dir)
    return dir
  }
  afterEach(() => dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })))

  const notesDoc = (context: TabContext, extra = ''): string => [
    `# ${context.name}`,
    `<!-- iaterminal:context ${JSON.stringify({
      version: 1,
      id: context.id,
      name: context.name,
      fileName: context.fileName,
      kind: context.kind,
    })} -->`,
    '',
    '<!-- iaterminal:auto -->',
    '(manual notes context)',
    '<!-- /iaterminal:auto -->',
    '',
    '<!-- iaterminal:notes -->',
    extra || 'notes',
    '<!-- /iaterminal:notes -->',
    '',
  ].join('\n')

  it('writes a new context into .gravity/context/', () => {
    const cwd = tempCwd()
    const context = applyCanonicalContextIdentity({
      id: '',
      name: 'Nueva nota',
      fileName: '',
      kind: 'notes',
    })
    const result = materializeTabContext(context, cwd, { write: true, content: 'hola' })
    expect(result.ok).toBe(true)
    expect(existsSync(join(cwd, PROJECT_DIR, CONTEXT_SUBDIR, 'Nueva-nota.md'))).toBe(true)
    expect(existsSync(join(cwd, PROJECT_DIR, 'Nueva-nota.md'))).toBe(false)
    expect(context.fileName).toBe(`${CONTEXT_SUBDIR}/Nueva-nota.md`)
  })

  it('moves a legacy root .md, keeps fileName prefixed, and preserves the id byte for byte', () => {
    const cwd = tempCwd()
    const legacy = applyCanonicalContextIdentity({
      id: 'x',
      name: 'front-rules',
      fileName: 'front-rules.md',
      kind: 'notes',
    })
    const idBefore = legacy.id
    mkdirSync(join(cwd, PROJECT_DIR), { recursive: true })
    writeFileSync(
      join(cwd, PROJECT_DIR, 'front-rules.md'),
      notesDoc({ ...legacy, fileName: 'front-rules.md' }),
      'utf8',
    )

    const result = discoverTabContexts(cwd)
    const found = result.contexts.find(item => item.kind === 'notes')
    expect(found).toBeDefined()
    expect(found!.id).toBe(idBefore)
    expect(found!.fileName).toBe(`${CONTEXT_SUBDIR}/front-rules.md`)
    expect(existsSync(join(cwd, PROJECT_DIR, CONTEXT_SUBDIR, 'front-rules.md'))).toBe(true)
    expect(existsSync(join(cwd, PROJECT_DIR, 'front-rules.md'))).toBe(false)
    expect(applyCanonicalContextIdentity({
      ...legacy,
      fileName: `${CONTEXT_SUBDIR}/front-rules.md`,
    }).id).toBe(idBefore)
  })

  it('does not rewrite an agent that already holds the pre-move contextId', () => {
    const cwd = tempCwd()
    const legacy = applyCanonicalContextIdentity({
      id: 'x',
      name: 'front-rules',
      fileName: 'front-rules.md',
      kind: 'notes',
    })
    mkdirSync(join(cwd, PROJECT_DIR), { recursive: true })
    writeFileSync(
      join(cwd, PROJECT_DIR, 'front-rules.md'),
      notesDoc({ ...legacy, fileName: 'front-rules.md' }),
      'utf8',
    )
    upsertProjectAgent(cwd, {
      id: 'qa',
      name: 'QA',
      provider: 'cursor',
      permissionMode: 'default',
      contextIds: [legacy.id],
    })
    const agentPath = join(cwd, PROJECT_DIR, 'agents', 'qa.json')
    const before = readFileSync(agentPath, 'utf8')

    const result = discoverTabContexts(cwd)

    expect(result.idRemap?.[legacy.id]).toBeUndefined()
    expect(Object.keys(result.idRemap ?? {})).not.toContain(legacy.id)
    expect(readFileSync(agentPath, 'utf8')).toBe(before)
    const agent = JSON.parse(before) as { contextIds?: string[] }
    expect(agent.contextIds).toEqual([legacy.id])
  })

  it('leaves the loose file untouched when context/front-rules.md already exists', () => {
    const cwd = tempCwd()
    const identity = applyCanonicalContextIdentity({
      id: 'x',
      name: 'front-rules',
      fileName: 'front-rules.md',
      kind: 'notes',
    })
    mkdirSync(join(cwd, PROJECT_DIR, CONTEXT_SUBDIR), { recursive: true })
    writeFileSync(
      join(cwd, PROJECT_DIR, CONTEXT_SUBDIR, 'front-rules.md'),
      notesDoc({ ...identity, fileName: `${CONTEXT_SUBDIR}/front-rules.md` }, 'DEST'),
      'utf8',
    )
    writeFileSync(
      join(cwd, PROJECT_DIR, 'front-rules.md'),
      notesDoc({ ...identity, fileName: 'front-rules.md' }, 'LOOSE'),
      'utf8',
    )

    discoverTabContexts(cwd)

    expect(existsSync(join(cwd, PROJECT_DIR, 'front-rules.md'))).toBe(true)
    expect(existsSync(join(cwd, PROJECT_DIR, CONTEXT_SUBDIR, 'front-rules.md'))).toBe(true)
    expect(readFileSync(join(cwd, PROJECT_DIR, 'front-rules.md'), 'utf8')).toContain('LOOSE')
    expect(readFileSync(join(cwd, PROJECT_DIR, CONTEXT_SUBDIR, 'front-rules.md'), 'utf8'))
      .toContain('DEST')
  })

  it('keeps results/ and jira/ on their own paths', () => {
    const cwd = tempCwd()
    upsertProjectAgent(cwd, {
      id: 'scout',
      name: 'Scout',
      provider: 'cursor',
      permissionMode: 'default',
    })
    mkdirSync(join(cwd, PROJECT_DIR, 'results'), { recursive: true })
    mkdirSync(join(cwd, PROJECT_DIR, 'jira'), { recursive: true })
    writeFileSync(
      join(cwd, PROJECT_DIR, 'results', 'scout.md'),
      [
        '# Scout',
        '<!-- iaterminal:context {"version":1,"id":"iaterminal:result:scout","name":"Scout","fileName":"results/scout.md","kind":"agentResult"} -->',
        '',
      ].join('\n'),
      'utf8',
    )
    writeFileSync(
      join(cwd, PROJECT_DIR, 'jira', 'GRAV-1.md'),
      [
        '# GRAV-1',
        '<!-- iaterminal:context {"version":1,"id":"iaterminal:jira:grav-1","name":"GRAV-1","fileName":"jira/GRAV-1.md","kind":"jira","issueKey":"GRAV-1"} -->',
        '',
      ].join('\n'),
      'utf8',
    )

    const result = discoverTabContexts(cwd)
    expect(result.contexts.find(item => item.kind === 'agentResult')?.fileName)
      .toBe('results/scout.md')
    expect(result.contexts.find(item => item.kind === 'jira')?.fileName)
      .toBe('jira/GRAV-1.md')
    expect(existsSync(join(cwd, PROJECT_DIR, 'results', 'scout.md'))).toBe(true)
    expect(existsSync(join(cwd, PROJECT_DIR, 'jira', 'GRAV-1.md'))).toBe(true)
    expect(existsSync(join(cwd, PROJECT_DIR, CONTEXT_SUBDIR, 'scout.md'))).toBe(false)
    expect(existsSync(join(cwd, PROJECT_DIR, CONTEXT_SUBDIR, 'GRAV-1.md'))).toBe(false)
  })

  it('rename inside context/ deletes the previous file', () => {
    const cwd = tempCwd()
    const original = applyCanonicalContextIdentity({
      id: '',
      name: 'alpha',
      fileName: '',
      kind: 'notes',
    })
    materializeTabContext(original, cwd, { write: true, content: 'cuerpo' })
    const renamed = applyCanonicalContextIdentity({ ...original, name: 'beta' })
    const result = materializeTabContext(renamed, cwd, {
      write: true,
      content: 'cuerpo',
      previousFileName: original.fileName,
    })
    expect(result.ok).toBe(true)
    expect(existsSync(join(cwd, PROJECT_DIR, CONTEXT_SUBDIR, 'alpha.md'))).toBe(false)
    expect(existsSync(join(cwd, PROJECT_DIR, CONTEXT_SUBDIR, 'beta.md'))).toBe(true)
    expect(readFileSync(join(cwd, PROJECT_DIR, CONTEXT_SUBDIR, 'beta.md'), 'utf8'))
      .toContain('cuerpo')
  })

  it('delete removes both a migrated context/ file and a leftover at the root', () => {
    const cwd = tempCwd()
    const migrated = applyCanonicalContextIdentity({
      id: '',
      name: 'migrado',
      fileName: '',
      kind: 'notes',
    })
    materializeTabContext(migrated, cwd, { write: true, content: 'a' })
    expect(deleteTabContext(migrated, cwd).ok).toBe(true)
    expect(existsSync(join(cwd, PROJECT_DIR, CONTEXT_SUBDIR, 'migrado.md'))).toBe(false)

    const loose = applyCanonicalContextIdentity({
      id: 'y',
      name: 'suelto',
      fileName: 'suelto.md',
      kind: 'notes',
    })
    mkdirSync(join(cwd, PROJECT_DIR), { recursive: true })
    writeFileSync(join(cwd, PROJECT_DIR, 'suelto.md'), notesDoc({ ...loose, fileName: 'suelto.md' }))
    expect(deleteTabContext({ ...loose, fileName: `${CONTEXT_SUBDIR}/suelto.md` }, cwd).ok)
      .toBe(true)
    expect(existsSync(join(cwd, PROJECT_DIR, 'suelto.md'))).toBe(false)
  })
})
