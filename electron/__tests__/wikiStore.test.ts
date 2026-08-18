import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { applyWikiIngest, ensureWiki, ensureWikiWithSeed, readWikiPages, wikiRootPath } from '../wikiStore'
import { PROJECT_DIR } from '../../src/shared/projectDir'

const roots: string[] = []

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'wiki-store-'))
  roots.push(root)
  return root
}

afterEach(() => {
  while (roots.length) rmSync(roots.pop() as string, { recursive: true, force: true })
})

describe('ensureWiki', () => {
  it('crea pages/, index.md y log.md bajo la carpeta del proyecto', () => {
    const cwd = makeRoot()
    const root = ensureWiki(cwd)
    expect(root).toBe(join(cwd, PROJECT_DIR, 'wiki'))
    expect(root).toBe(wikiRootPath(cwd))
    expect(existsSync(join(root, 'pages'))).toBe(true)
    expect(readFileSync(join(root, 'index.md'), 'utf8')).toBe('# Wiki index\n')
    expect(readFileSync(join(root, 'log.md'), 'utf8')).toBe('# Wiki log\n')
  })

  it('no pisa index ni log existentes', () => {
    const cwd = makeRoot()
    const root = ensureWiki(cwd)
    applyWikiIngest(cwd, {
      ops: [{ op: 'upsert', slug: 'a', title: 'A', type: 'concept', body: 'b' }],
      log: 'alta',
    })
    const index = readFileSync(join(root, 'index.md'), 'utf8')
    const log = readFileSync(join(root, 'log.md'), 'utf8')
    ensureWiki(cwd)
    expect(readFileSync(join(root, 'index.md'), 'utf8')).toBe(index)
    expect(readFileSync(join(root, 'log.md'), 'utf8')).toBe(log)
  })
})

describe('ensureWikiWithSeed', () => {
  it('sin wiki previa crea el árbol completo y siembra overview con log [human]', () => {
    const cwd = makeRoot()
    const result = ensureWikiWithSeed(cwd)
    expect(result).toEqual({ ok: true, applied: 1, errors: [] })

    const root = wikiRootPath(cwd)
    expect(readdirSync(join(root, 'pages'))).toEqual(['overview.md'])
    const raw = readFileSync(join(root, 'pages', 'overview.md'), 'utf8')
    expect(raw.startsWith('# Overview\n<!-- iaterminal:wiki-page {"type":"concept"} -->\n')).toBe(true)

    const index = readFileSync(join(root, 'index.md'), 'utf8')
    expect(index).toContain('- [[overview]] — Overview (concept)')

    const log = readFileSync(join(root, 'log.md'), 'utf8')
    expect(log).toMatch(/^# Wiki log\n- `[^`]+` — \[human\] Wiki created from the map/)

    expect(readWikiPages(cwd)).toHaveLength(1)
    expect(readWikiPages(cwd)[0]).toMatchObject({ slug: 'overview', type: 'concept' })
  })

  it('con pages existentes no toca nada: ni pages, ni index, ni log', () => {
    const cwd = makeRoot()
    ensureWiki(cwd)
    applyWikiIngest(cwd, {
      ops: [{ op: 'upsert', slug: 'auth', title: 'Auth', type: 'flow', body: 'x' }],
      log: 'alta',
    }, { agentId: 'tl' })
    const root = wikiRootPath(cwd)
    const index = readFileSync(join(root, 'index.md'), 'utf8')
    const log = readFileSync(join(root, 'log.md'), 'utf8')

    const result = ensureWikiWithSeed(cwd)
    expect(result).toEqual({ ok: true, applied: 0, errors: [] })
    expect(readdirSync(join(root, 'pages'))).toEqual(['auth.md'])
    expect(existsSync(join(root, 'pages', 'overview.md'))).toBe(false)
    expect(readFileSync(join(root, 'index.md'), 'utf8')).toBe(index)
    expect(readFileSync(join(root, 'log.md'), 'utf8')).toBe(log)
  })

  it('es idempotente: la segunda llamada no duplica page ni línea de log', () => {
    const cwd = makeRoot()
    ensureWikiWithSeed(cwd)
    const root = wikiRootPath(cwd)
    const log = readFileSync(join(root, 'log.md'), 'utf8')

    const result = ensureWikiWithSeed(cwd)
    expect(result).toEqual({ ok: true, applied: 0, errors: [] })
    expect(readdirSync(join(root, 'pages'))).toEqual(['overview.md'])
    expect(readFileSync(join(root, 'log.md'), 'utf8')).toBe(log)
  })

  it('el seed no relaja el guard de traversal del ingest', () => {
    const cwd = makeRoot()
    ensureWikiWithSeed(cwd)
    const result = applyWikiIngest(cwd, {
      ops: [{ op: 'upsert', slug: '../evil', title: 'Evil', type: 'concept', body: 'x' }],
      log: null,
    })
    expect(result.ok).toBe(false)
    const root = wikiRootPath(cwd)
    expect(readdirSync(join(root, 'pages'))).toEqual(['overview.md'])
    expect(existsSync(join(root, 'evil.md'))).toBe(false)
    expect(existsSync(join(cwd, 'evil.md'))).toBe(false)
  })
})

describe('applyWikiIngest', () => {
  it('sin wiki no crea directorio ni fichero y devuelve wiki not initialized', () => {
    const cwd = makeRoot()
    const result = applyWikiIngest(cwd, {
      ops: [{ op: 'upsert', slug: 'a', title: 'A', type: 'concept', body: 'x' }],
      log: 'alta',
    })
    expect(result).toEqual({ ok: false, applied: 0, errors: ['wiki not initialized'] })
    expect(existsSync(wikiRootPath(cwd))).toBe(false)
  })

  it('tras ensureWiki aplica ingest, regenera index.md y appendea log', () => {
    const cwd = makeRoot()
    ensureWiki(cwd)
    const result = applyWikiIngest(cwd, {
      ops: [{
        op: 'upsert',
        slug: 'auth-flow',
        title: 'Auth Flow',
        type: 'flow',
        body: 'Cómo entra el usuario.',
      }],
      log: 'alta de auth-flow',
    }, { agentId: 'tl' })
    expect(result).toEqual({ ok: true, applied: 1, errors: [] })

    const root = wikiRootPath(cwd)
    expect(readFileSync(join(root, 'pages', 'auth-flow.md'), 'utf8')).toContain('Cómo entra el usuario.')
    expect(readFileSync(join(root, 'index.md'), 'utf8')).toContain('[[auth-flow]]')
    expect(readFileSync(join(root, 'log.md'), 'utf8'))
      .toMatch(/- `[^`]+` — \[tl\] alta de auth-flow\n$/)
  })

  it('con pages/ existente pero sin index.md ni log.md los regenera al ingestar', () => {
    const cwd = makeRoot()
    const root = wikiRootPath(cwd)
    mkdirSync(join(root, 'pages'), { recursive: true })
    const result = applyWikiIngest(cwd, {
      ops: [{ op: 'upsert', slug: 'a', title: 'A', type: 'concept', body: 'x' }],
      log: 'alta',
    })
    expect(result).toEqual({ ok: true, applied: 1, errors: [] })
    expect(existsSync(join(root, 'index.md'))).toBe(true)
    expect(readFileSync(join(root, 'log.md'), 'utf8'))
      .toMatch(/- `[^`]+` — alta\n$/)
  })

  it('upsert escribe la page, regenera el index y appendea el log', () => {
    const cwd = makeRoot()
    ensureWiki(cwd)
    const result = applyWikiIngest(cwd, {
      ops: [{
        op: 'upsert',
        slug: 'auth-flow',
        title: 'Auth Flow',
        type: 'flow',
        body: 'Cómo entra el usuario. Ver [[tokens]].',
      }],
      log: 'alta de auth-flow',
    }, { agentId: 'tl' })
    expect(result).toEqual({ ok: true, applied: 1, errors: [] })

    const root = wikiRootPath(cwd)
    const raw = readFileSync(join(root, 'pages', 'auth-flow.md'), 'utf8')
    expect(raw.startsWith('# Auth Flow\n<!-- iaterminal:wiki-page {"type":"flow"} -->\n')).toBe(true)

    const index = readFileSync(join(root, 'index.md'), 'utf8')
    expect(index).toContain('- [[auth-flow]] — Auth Flow (flow) → links: tokens')
    expect(index).toContain('  Cómo entra el usuario. Ver [[tokens]].')

    const log = readFileSync(join(root, 'log.md'), 'utf8')
    expect(log).toMatch(/^# Wiki log\n- `[^`]+` — \[tl\] alta de auth-flow\n$/)

    expect(readWikiPages(cwd)).toHaveLength(1)
    expect(readWikiPages(cwd)[0]).toMatchObject({ slug: 'auth-flow', type: 'flow', links: ['tokens'] })
  })

  it('delete quita la page y su línea del index', () => {
    const cwd = makeRoot()
    ensureWiki(cwd)
    applyWikiIngest(cwd, {
      ops: [
        { op: 'upsert', slug: 'alfa', title: 'Alfa', type: 'concept', body: 'a' },
        { op: 'upsert', slug: 'beta', title: 'Beta', type: 'concept', body: 'b' },
      ],
      log: 'altas',
    })
    const result = applyWikiIngest(cwd, { ops: [{ op: 'delete', slug: 'alfa' }], log: 'baja de alfa' })
    expect(result).toEqual({ ok: true, applied: 1, errors: [] })

    const root = wikiRootPath(cwd)
    expect(existsSync(join(root, 'pages', 'alfa.md'))).toBe(false)
    const index = readFileSync(join(root, 'index.md'), 'utf8')
    expect(index).not.toContain('[[alfa]]')
    expect(index).toContain('[[beta]]')
    expect(readWikiPages(cwd).map(page => page.slug)).toEqual(['beta'])
  })

  it('delete de una page inexistente no suma applied ni error', () => {
    const cwd = makeRoot()
    ensureWiki(cwd)
    const result = applyWikiIngest(cwd, { ops: [{ op: 'delete', slug: 'fantasma' }], log: null })
    expect(result).toEqual({ ok: true, applied: 0, errors: [] })
  })

  it('rechaza slugs con traversal sin escribir fuera de wiki/pages', () => {
    const cwd = makeRoot()
    ensureWiki(cwd)
    const result = applyWikiIngest(cwd, {
      ops: [
        { op: 'upsert', slug: '../evil', title: 'Evil', type: 'concept', body: 'x' },
        { op: 'delete', slug: '..\\..\\fuera' },
      ],
      log: null,
    })
    expect(result.ok).toBe(false)
    expect(result.applied).toBe(0)
    expect(result.errors).toHaveLength(2)

    const root = wikiRootPath(cwd)
    expect(readdirSync(join(root, 'pages'))).toEqual([])
    expect(existsSync(join(root, 'evil.md'))).toBe(false)
    expect(existsSync(join(cwd, PROJECT_DIR, 'evil.md'))).toBe(false)
    expect(existsSync(join(cwd, 'evil.md'))).toBe(false)
  })
})
