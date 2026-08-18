import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  applyWikiIngest,
  ensureWiki,
  readWikiLogTail,
  readWikiPages,
  replaceWikiLogFromServer,
  replaceWikiPagesFromServer,
  wikiRootPath,
} from '../wikiStore'

const roots: string[] = []

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'wiki-sync-'))
  roots.push(root)
  return root
}

afterEach(() => {
  while (roots.length) rmSync(roots.pop() as string, { recursive: true, force: true })
})

describe('replaceWikiPagesFromServer', () => {
  it('con lista vacía y sin wiki local previa no crea nada', () => {
    const cwd = makeRoot()
    const result = replaceWikiPagesFromServer(cwd, [])
    expect(result).toEqual({ ok: true, applied: 0, errors: [] })
    expect(existsSync(wikiRootPath(cwd))).toBe(false)
  })

  it('reemplaza pages, borra las locales fuera del set y regenera el index', () => {
    const cwd = makeRoot()
    ensureWiki(cwd)
    applyWikiIngest(cwd, {
      ops: [
        { op: 'upsert', slug: 'local-extra', title: 'Solo local', type: 'concept', body: 'x' },
        { op: 'upsert', slug: 'alfa', title: 'Alfa vieja', type: 'concept', body: 'v1' },
      ],
      log: 'estado previo',
    })

    const result = replaceWikiPagesFromServer(cwd, [
      { slug: 'alfa', title: 'Alfa nueva', type: 'flow', body: 'v2 con [[beta]]' },
      { slug: 'beta', title: 'Beta', type: 'reference', body: 'b' },
    ])
    expect(result.ok).toBe(true)

    const pages = readWikiPages(cwd)
    expect(pages.map(page => page.slug)).toEqual(['alfa', 'beta'])
    expect(pages[0]).toMatchObject({ title: 'Alfa nueva', type: 'flow', links: ['beta'] })

    const root = wikiRootPath(cwd)
    expect(existsSync(join(root, 'pages', 'local-extra.md'))).toBe(false)
    const index = readFileSync(join(root, 'index.md'), 'utf8')
    expect(index).toContain('- [[alfa]] — Alfa nueva (flow) → links: beta')
    expect(index).toContain('- [[beta]] — Beta (reference)')
    expect(index).not.toContain('local-extra')
  })

  it('NUNCA toca log.md', () => {
    const cwd = makeRoot()
    ensureWiki(cwd)
    applyWikiIngest(cwd, {
      ops: [{ op: 'upsert', slug: 'alfa', title: 'Alfa', type: 'concept', body: 'a' }],
      log: 'línea que debe sobrevivir',
    })
    const root = wikiRootPath(cwd)
    const logBefore = readFileSync(join(root, 'log.md'), 'utf8')

    replaceWikiPagesFromServer(cwd, [
      { slug: 'beta', title: 'Beta', type: 'concept', body: 'b' },
    ])
    expect(readFileSync(join(root, 'log.md'), 'utf8')).toBe(logBefore)
  })

  it('rechaza slugs con traversal sin escribir fuera de wiki/pages', () => {
    const cwd = makeRoot()
    const result = replaceWikiPagesFromServer(cwd, [
      { slug: '../evil', title: 'Evil', type: 'concept', body: 'x' },
      { slug: 'ok', title: 'Ok', type: 'concept', body: 'y' },
    ])
    // `../evil` se normaliza a slug canónico (evil): queda dentro de pages.
    const root = wikiRootPath(cwd)
    expect(result.ok).toBe(true)
    expect(readdirSync(join(root, 'pages')).sort()).toEqual(['evil.md', 'ok.md'])
    expect(existsSync(join(cwd, 'evil.md'))).toBe(false)
  })

  it('lista vacía con wiki existente vacía las pages y conserva el log', () => {
    const cwd = makeRoot()
    ensureWiki(cwd)
    applyWikiIngest(cwd, {
      ops: [{ op: 'upsert', slug: 'alfa', title: 'Alfa', type: 'concept', body: 'a' }],
      log: 'alta',
    })
    const root = wikiRootPath(cwd)
    const logBefore = readFileSync(join(root, 'log.md'), 'utf8')

    const result = replaceWikiPagesFromServer(cwd, [])
    expect(result.ok).toBe(true)
    expect(readWikiPages(cwd)).toEqual([])
    expect(readFileSync(join(root, 'index.md'), 'utf8')).toBe('# Wiki index\n')
    expect(readFileSync(join(root, 'log.md'), 'utf8')).toBe(logBefore)
  })
})

describe('replaceWikiLogFromServer', () => {
  it('con lista vacía y sin wiki local previa no crea nada', () => {
    const cwd = makeRoot()
    const result = replaceWikiLogFromServer(cwd, [])
    expect(result).toEqual({ ok: true, applied: 0, errors: [] })
    expect(existsSync(wikiRootPath(cwd))).toBe(false)
  })

  it('invierte DESC→ASC y formatea cada línea con formatWikiLogEntry', () => {
    const cwd = makeRoot()
    const tNewer = Date.parse('2026-08-13T12:00:00.000Z')
    const tOlder = Date.parse('2026-08-13T10:00:00.000Z')
    // Server ordena createdAt DESC (más reciente primero).
    const result = replaceWikiLogFromServer(cwd, [
      { entry: 'ajuste reciente', createdBy: 'fe', createdAt: tNewer },
      { entry: 'alta inicial', createdBy: 'tl', createdAt: tOlder },
    ])
    expect(result).toEqual({ ok: true, applied: 2, errors: [] })
    const log = readFileSync(join(wikiRootPath(cwd), 'log.md'), 'utf8')
    expect(log).toBe(
      '# Wiki log\n'
      + '- `2026-08-13T10:00:00.000Z` — [tl] alta inicial\n'
      + '- `2026-08-13T12:00:00.000Z` — [fe] ajuste reciente\n',
    )
  })

  it('sin createdBy ni createdAt: línea sin agente y timestamp ahora', () => {
    const cwd = makeRoot()
    const before = Date.now()
    const result = replaceWikiLogFromServer(cwd, [{ entry: 'sin meta' }])
    const after = Date.now()
    expect(result.applied).toBe(1)
    const line = readFileSync(join(wikiRootPath(cwd), 'log.md'), 'utf8').trim().split('\n')[1]
    expect(line).toMatch(/^- `[^`]+` — sin meta$/)
    const iso = line.slice(3, line.indexOf('`', 3))
    const ts = Date.parse(iso)
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })
})

describe('readWikiLogTail', () => {
  it('devuelve [] sin wiki y las últimas líneas no vacías con wiki', () => {
    const cwd = makeRoot()
    expect(readWikiLogTail(cwd)).toEqual([])

    ensureWiki(cwd)
    applyWikiIngest(cwd, {
      ops: [{ op: 'upsert', slug: 'alfa', title: 'Alfa', type: 'concept', body: 'a' }],
      log: 'alta de alfa',
    }, { agentId: 'tl' })
    const tail = readWikiLogTail(cwd)
    expect(tail[0]).toBe('# Wiki log')
    expect(tail[1]).toMatch(/^- `[^`]+` — \[tl\] alta de alfa$/)
  })

  it('cap de 50 líneas', () => {
    const cwd = makeRoot()
    ensureWiki(cwd)
    for (let i = 0; i < 60; i += 1) {
      applyWikiIngest(cwd, { ops: [], log: `línea ${i}` })
    }
    const tail = readWikiLogTail(cwd)
    expect(tail).toHaveLength(50)
    expect(tail[49]).toContain('línea 59')
  })
})
