import { describe, expect, it } from 'vitest'
import { buildWikiGraphData } from '../wikiGraph'
import type { WikiPage, WikiPageType } from '../wikiDoc'

const page = (
  slug: string,
  links: string[] = [],
  type: WikiPageType = 'concept',
): WikiPage => ({
  slug,
  title: `Título de ${slug}`,
  type,
  body: `Cuerpo de ${slug}.`,
  links,
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
})
