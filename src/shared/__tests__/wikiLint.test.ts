import { describe, expect, it } from 'vitest'
import type { WikiPage } from '../wikiDoc'
import { MAX_WIKI_LINT_ENTRIES, lintWikiPages } from '../wikiLint'

function page(slug: string, body: string, links: string[] = []): WikiPage {
  return { slug, title: slug, type: 'concept', body, links }
}

const anyPathExists = (): boolean => true

describe('lintWikiPages huérfanas', () => {
  it('detecta pages sin links entrantes y exime overview', () => {
    const report = lintWikiPages([
      page('overview', 'raíz', ['linked']),
      page('linked', 'apuntada desde overview'),
      page('orphan-b', 'nadie me apunta'),
      page('orphan-a', 'yo tampoco', ['linked']),
    ], anyPathExists)
    expect(report.orphans).toEqual(['orphan-a', 'orphan-b'])
  })

  it('un self-link no salva de ser huérfana', () => {
    const report = lintWikiPages([
      page('overview', 'raíz'),
      page('selfish', 'me apunto solo', ['selfish']),
    ], anyPathExists)
    expect(report.orphans).toEqual(['selfish'])
  })
})

describe('lintWikiPages links rotos', () => {
  it('reporta links a slugs inexistentes con origen y destino', () => {
    const report = lintWikiPages([
      page('overview', 'raíz', ['real', 'ghost']),
      page('real', 'existo', ['overview']),
    ], anyPathExists)
    expect(report.brokenLinks).toEqual([{ from: 'overview', to: 'ghost' }])
  })
})

describe('lintWikiPages rutas muertas', () => {
  it('reporta rutas de repo citadas que no existen y respeta las vivas', () => {
    const report = lintWikiPages([
      page('overview', 'ver `electron/gone.ts` y `src/shared/alive.ts`'),
    ], rel => rel === 'src/shared/alive.ts')
    expect(report.deadPaths).toEqual([{ slug: 'overview', path: 'electron/gone.ts' }])
  })

  it('ignora nombres sueltos, URLs y bodies sin backticks', () => {
    const report = lintWikiPages([
      page('overview', 'abre `App.tsx` o https://x.dev/a.ts, y también `npm run dev`'),
      page('plain', 'sin código aquí', ['overview']),
    ], () => false)
    expect(report.deadPaths).toEqual([])
  })

  it('no repite la misma ruta muerta citada dos veces en una page', () => {
    const report = lintWikiPages([
      page('overview', 'ver `a/b.ts` y de nuevo `a/b.ts`'),
    ], () => false)
    expect(report.deadPaths).toEqual([{ slug: 'overview', path: 'a/b.ts' }])
  })
})

describe('lintWikiPages caps', () => {
  it('corta cada lista en MAX_WIKI_LINT_ENTRIES', () => {
    const pages = [page('overview', 'raíz')]
    for (let i = 0; i < MAX_WIKI_LINT_ENTRIES + 5; i++) {
      pages.push(page(`orphan-${String(i).padStart(2, '0')}`, `ver \`dead/${i}.ts\``, [`ghost-${i}`]))
    }
    const report = lintWikiPages(pages, () => false)
    expect(report.orphans).toHaveLength(MAX_WIKI_LINT_ENTRIES)
    expect(report.brokenLinks).toHaveLength(MAX_WIKI_LINT_ENTRIES)
    expect(report.deadPaths).toHaveLength(MAX_WIKI_LINT_ENTRIES)
  })

  it('wiki sana devuelve reporte vacío', () => {
    const report = lintWikiPages([
      page('overview', 'ver `src/shared/wikiDoc.ts`', ['other']),
      page('other', 'ok', ['overview']),
    ], anyPathExists)
    expect(report).toEqual({ orphans: [], brokenLinks: [], deadPaths: [] })
  })
})
