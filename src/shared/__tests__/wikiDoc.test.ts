import { describe, expect, it } from 'vitest'
import {
  buildWikiIndex,
  buildWikiPromptIndex,
  buildWikiWritingGuidance,
  composeWikiPage,
  extractWikiIngest,
  formatWikiLogEntry,
  normalizeWikiPageType,
  normalizeWikiSlug,
  parseWikiLinks,
  parseWikiPage,
  type WikiPage,
} from '../wikiDoc'

function page(partial: Partial<WikiPage> & { slug: string }): WikiPage {
  return { title: partial.slug, type: 'concept', body: '', links: [], ...partial }
}

describe('normalizeWikiSlug', () => {
  it('neutraliza traversal y separadores', () => {
    expect(normalizeWikiSlug('../x')).toBe('x')
    expect(normalizeWikiSlug('../../etc/passwd')).toBe('etc-passwd')
    expect(normalizeWikiSlug('..')).toBe('page')
  })

  it('quita diacríticos, baja a minúsculas y quita la extensión', () => {
    expect(normalizeWikiSlug('Decisión Técnica.md')).toBe('decision-tecnica')
    expect(normalizeWikiSlug('Ñoño  Árbol')).toBe('nono-arbol')
  })

  it('recorta a 80 y cae al fallback cuando no queda nada', () => {
    expect(normalizeWikiSlug('a'.repeat(100))).toHaveLength(80)
    expect(normalizeWikiSlug('')).toBe('page')
    expect(normalizeWikiSlug('   ')).toBe('page')
  })
})

describe('normalizeWikiPageType', () => {
  it('acepta la allowlist y todo lo demás cae a concept', () => {
    expect(normalizeWikiPageType('decision')).toBe('decision')
    expect(normalizeWikiPageType(' Flow ')).toBe('flow')
    expect(normalizeWikiPageType('reference')).toBe('reference')
    expect(normalizeWikiPageType('epic')).toBe('concept')
    expect(normalizeWikiPageType(undefined)).toBe('concept')
  })
})

describe('parseWikiLinks', () => {
  it('lee wikilinks y links md relativos, con dedupe y sin self', () => {
    const body = [
      'Ver [[Auth Flow]] y también [detalle](auth-flow.md).',
      'Otra [page](pages/deploy.md) y un externo [x](https://example.com/a.md).',
      'Self: [[mi-page]].',
    ].join('\n')
    expect(parseWikiLinks(body, 'mi-page')).toEqual(['auth-flow', 'deploy'])
  })

  it('devuelve vacío sin links', () => {
    expect(parseWikiLinks('solo texto plano')).toEqual([])
  })
})

describe('composeWikiPage / parseWikiPage', () => {
  it('son simétricos', () => {
    const original = page({
      slug: 'auth-flow',
      title: 'Auth Flow',
      type: 'flow',
      body: 'Primera línea.\n\nDetalle con [[login]] y [más](pages/tokens.md).',
    })
    const raw = composeWikiPage(original)
    expect(raw.startsWith('# Auth Flow\n<!-- iaterminal:wiki-page {"type":"flow"} -->\n')).toBe(true)
    const parsed = parseWikiPage(raw, 'auth-flow')
    expect(parsed.title).toBe('Auth Flow')
    expect(parsed.type).toBe('flow')
    expect(parsed.body).toBe(original.body)
    expect(parsed.links).toEqual(['login', 'tokens'])
  })

  it('tolera page sin heading ni metadata: título = slug, type concept', () => {
    const parsed = parseWikiPage('solo cuerpo', 'suelta.md')
    expect(parsed).toMatchObject({ slug: 'suelta', title: 'suelta', type: 'concept', body: 'solo cuerpo' })
  })
})

describe('buildWikiPromptIndex', () => {
  it('una línea por page ordenada por slug, sin excerpt ni links', () => {
    const a = page({ slug: 'beta', title: 'Beta', body: 'Resumen de beta.', links: ['gamma'] })
    const b = page({
      slug: 'alfa',
      title: 'Alfa',
      type: 'decision',
      body: 'Primera línea útil.',
      links: ['beta', 'gamma'],
    })
    expect(buildWikiPromptIndex([a, b])).toBe([
      '- [[alfa]] — Alfa (decision)',
      '- [[beta]] — Beta (concept)',
    ].join('\n'))
    expect(buildWikiPromptIndex([b, a])).toBe(buildWikiPromptIndex([a, b]))
  })

  it('sin pages devuelve cadena vacía', () => {
    expect(buildWikiPromptIndex([])).toBe('')
  })
})

describe('buildWikiIndex', () => {
  it('es determinista: mismo resultado con pages desordenadas', () => {
    const a = page({ slug: 'beta', title: 'Beta', body: 'Resumen de beta.' })
    const b = page({
      slug: 'alfa',
      title: 'Alfa',
      type: 'decision',
      body: '## Sub\nPrimera línea útil.',
      links: ['beta', 'gamma'],
    })
    const index = buildWikiIndex([a, b])
    expect(buildWikiIndex([b, a])).toBe(index)
    expect(index).toBe([
      '# Wiki index',
      '',
      '- [[alfa]] — Alfa (decision) → links: beta, gamma',
      '  Primera línea útil.',
      '- [[beta]] — Beta (concept)',
      '  Resumen de beta.',
      '',
    ].join('\n'))
  })

  it('sin pages queda solo el heading y recorta excerpts a 120', () => {
    expect(buildWikiIndex([])).toBe('# Wiki index\n')
    const long = page({ slug: 'larga', title: 'Larga', body: 'x'.repeat(300) })
    const excerptLine = buildWikiIndex([long]).split('\n')[3]
    expect(excerptLine).toBe(`  ${'x'.repeat(120)}`)
  })
})

describe('formatWikiLogEntry', () => {
  it('arma la línea con y sin agentId', () => {
    expect(formatWikiLogEntry({ timestampIso: '2026-08-12T00:00:00.000Z', agentId: 'tl', summary: 'Alta de page' }))
      .toBe('- `2026-08-12T00:00:00.000Z` — [tl] Alta de page')
    expect(formatWikiLogEntry({ timestampIso: '2026-08-12T00:00:00.000Z', summary: 'Alta de page' }))
      .toBe('- `2026-08-12T00:00:00.000Z` — Alta de page')
  })

  it('limpia saltos y backticks y corta a 200', () => {
    const line = formatWikiLogEntry({
      timestampIso: '2026-08-12T00:00:00.000Z',
      summary: `hola\n\`mundo\`  ${'y'.repeat(300)}`,
    })
    const summary = line.split(' — ')[1]
    expect(summary).not.toMatch(/[\n`]/)
    expect(summary).toContain('hola mundo')
    expect(summary).toHaveLength(200)
  })
})

describe('extractWikiIngest', () => {
  const fence = (json: string): string => `antes\n\`\`\`ia-terminal-wiki\n${json}\n\`\`\`\ndespués`

  it('extrae ops normalizadas y limpia el texto visible', () => {
    const json = JSON.stringify({
      ops: [
        { op: 'upsert', slug: 'Auth Flow', title: '  Auth  ', type: 'flow', body: 'cuerpo' },
        { op: 'delete', slug: '../vieja' },
      ],
      log: 'alta y baja',
    })
    const { visibleText, ingest } = extractWikiIngest(fence(json))
    expect(visibleText).toBe('antes\n\ndespués')
    expect(ingest).toEqual({
      ops: [
        { op: 'upsert', slug: 'auth-flow', title: 'Auth', type: 'flow', body: 'cuerpo' },
        { op: 'delete', slug: 'vieja' },
      ],
      log: 'alta y baja',
    })
  })

  it('aplica los caps: 8 ops, body 10000, title 120, log 200', () => {
    const ops = Array.from({ length: 12 }, (_, i) => ({
      op: 'upsert',
      slug: `p-${i}`,
      title: `T${i}${'t'.repeat(200)}`,
      body: 'b'.repeat(12000),
    }))
    const { ingest } = extractWikiIngest(fence(JSON.stringify({ ops, log: 'l'.repeat(300) })))
    expect(ingest?.ops).toHaveLength(8)
    const first = ingest?.ops[0]
    expect(first?.op).toBe('upsert')
    if (first?.op === 'upsert') {
      expect(first.title).toHaveLength(120)
      expect(first.body).toHaveLength(10000)
      expect(first.type).toBe('concept')
    }
    expect(ingest?.log).toHaveLength(200)
  })

  it('JSON roto: oculta el fence y no aplica nada', () => {
    const { visibleText, ingest } = extractWikiIngest(fence('{no es json'))
    expect(visibleText).toBe('antes\n\ndespués')
    expect(ingest).toBeNull()
  })

  it('descarta ops inválidas sin tumbar las válidas', () => {
    const json = JSON.stringify({
      ops: [
        { op: 'upsert', slug: 'ok', title: 'Ok', body: 'b' },
        { op: 'upsert', slug: '', title: 'Sin slug', body: 'b' },
        { op: 'rename', slug: 'x' },
        'basura',
      ],
    })
    const { ingest } = extractWikiIngest(fence(json))
    expect(ingest?.ops).toEqual([{ op: 'upsert', slug: 'ok', title: 'Ok', type: 'concept', body: 'b' }])
    expect(ingest?.log).toBeNull()
  })

  it('multi-fence: junta ops de todos los fences bajo el mismo cap', () => {
    const one = JSON.stringify({ ops: [{ op: 'upsert', slug: 'a', title: 'A', body: '1' }] })
    const two = JSON.stringify({ ops: [{ op: 'delete', slug: 'b' }], log: 'segunda' })
    const text = `x\n\`\`\`ia-terminal-wiki\n${one}\n\`\`\`\ny\n\`\`\`ia-terminal-wiki\n${two}\n\`\`\``
    const { visibleText, ingest } = extractWikiIngest(text)
    expect(visibleText).toBe('x\n\ny')
    expect(ingest?.ops.map(op => op.slug)).toEqual(['a', 'b'])
    expect(ingest?.log).toBe('segunda')
  })

  it('sin fence devuelve el texto intacto e ingest null', () => {
    const { visibleText, ingest } = extractWikiIngest('texto normal')
    expect(visibleText).toBe('texto normal')
    expect(ingest).toBeNull()
  })
})

describe('buildWikiWritingGuidance', () => {
  it('incluye política, jobs y anti-ejemplos', () => {
    const text = buildWikiWritingGuidance()
    expect(text).toContain('index for agents')
    expect(text).toContain('[[slug]]')
    expect(text).toContain('Bad (do not write)')
    expect(text).toContain('narrate')
    expect(text).toContain('locate')
    expect(text).toContain('decide')
    expect(text).toContain('flow')
    expect(text).toContain('inventory')
  })
})
