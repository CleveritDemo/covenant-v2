import { describe, expect, it } from 'vitest'
import { buildWikiGraphData, getMostRecentlyUpdatedWikiSlugs } from '../wikiGraph'
import type { WikiPage, WikiPageType } from '../wikiDoc'

const page = (
  slug: string,
  links: string[] = [],
  type: WikiPageType = 'concept',
  updatedAtMs?: number,
): WikiPage => ({
  slug,
  title: `Título de ${slug}`,
  type,
  body: `Cuerpo de ${slug}.`,
  links,
  ...(updatedAtMs != null ? { updatedAtMs } : {}),
})

describe('buildWikiGraphData', () => {
  it('un nodo por page, con slug/title/type/body reales', () => {
    const data = buildWikiGraphData([
      page('arquitectura', [], 'concept'),
      page('decision-electron', [], 'decision'),
    ])
    expect(data.nodes).toHaveLength(2)
    expect(data.nodes[0]).toEqual({
      slug: 'arquitectura',
      title: 'Título de arquitectura',
      type: 'concept',
      linkCount: 0,
      body: 'Cuerpo de arquitectura.',
    })
    expect(data.nodes[1]!.type).toBe('decision')
    expect(data.edges).toHaveLength(0)
  })

  it('dedupea aristas bidireccionales: a→b y b→a cuentan una sola vez', () => {
    const data = buildWikiGraphData([
      page('a', ['b']),
      page('b', ['a']),
    ])
    expect(data.edges).toHaveLength(1)
    expect(data.edges[0]).toEqual({ from: 'a', to: 'b' })
    for (const node of data.nodes) expect(node.linkCount).toBe(1)
  })

  it('ignora links rotos: ni arista ni nodo fantasma', () => {
    const data = buildWikiGraphData([
      page('a', ['fantasma', 'b']),
      page('b'),
    ])
    expect(data.nodes.map(node => node.slug)).toEqual(['a', 'b'])
    expect(data.edges).toEqual([{ from: 'a', to: 'b' }])
  })

  it('linkCount es el grado real sobre las aristas dedupeadas', () => {
    const data = buildWikiGraphData([
      page('hub', ['a', 'b', 'c']),
      page('a', ['hub']),
      page('b'),
      page('c', ['b']),
    ])
    const byName = new Map(data.nodes.map(node => [node.slug, node]))
    expect(data.edges).toHaveLength(4)
    expect(byName.get('hub')!.linkCount).toBe(3)
    expect(byName.get('a')!.linkCount).toBe(1)
    expect(byName.get('b')!.linkCount).toBe(2)
    expect(byName.get('c')!.linkCount).toBe(2)
  })

  it('ignora self-links y devuelve grafo vacío sin pages', () => {
    expect(buildWikiGraphData([page('solo', ['solo'])]).edges).toHaveLength(0)
    expect(buildWikiGraphData([])).toEqual({ nodes: [], edges: [] })
  })

  it('propaga updatedAtMs desde cada page al nodo', () => {
    const ts = Date.now()
    const data = buildWikiGraphData([
      page('hoy', [], 'concept', ts),
      page('sin-fecha'),
    ])
    expect(data.nodes.find(n => n.slug === 'hoy')?.updatedAtMs).toBe(ts)
    expect(data.nodes.find(n => n.slug === 'sin-fecha')?.updatedAtMs).toBeUndefined()
  })
})

describe('getMostRecentlyUpdatedWikiSlugs', () => {
  const node = (slug: string, updatedAtMs?: number) => ({
    slug,
    title: slug,
    type: 'concept' as const,
    linkCount: 0,
    ...(updatedAtMs != null ? { updatedAtMs } : {}),
  })

  it('devuelve como máximo 10 slugs ordenados por updatedAtMs descendente', () => {
    const nodes = Array.from({ length: 15 }, (_, i) =>
      node(`page-${String(i).padStart(2, '0')}`, 1000 + i),
    )
    const slugs = getMostRecentlyUpdatedWikiSlugs(nodes)
    expect(slugs.size).toBe(10)
    expect([...slugs]).toEqual([
      'page-14', 'page-13', 'page-12', 'page-11', 'page-10',
      'page-09', 'page-08', 'page-07', 'page-06', 'page-05',
    ])
  })

  it('desempata por slug lexicográfico cuando updatedAtMs coincide', () => {
    const ts = 5_000
    const slugs = getMostRecentlyUpdatedWikiSlugs([
      node('zebra', ts),
      node('alpha', ts),
      node('mango', ts),
    ])
    expect([...slugs]).toEqual(['alpha', 'mango', 'zebra'])
  })

  it('excluye nodos sin updatedAtMs finito', () => {
    const slugs = getMostRecentlyUpdatedWikiSlugs([
      node('con-fecha', 100),
      node('sin-fecha'),
      node('nan', Number.NaN),
    ])
    expect([...slugs]).toEqual(['con-fecha'])
  })

  it('devuelve solo los disponibles si hay menos de 10 nodos fechados', () => {
    const slugs = getMostRecentlyUpdatedWikiSlugs([
      node('a', 300),
      node('b', 200),
      node('sin-fecha'),
    ])
    expect([...slugs]).toEqual(['a', 'b'])
  })
})
