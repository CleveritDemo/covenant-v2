/**
 * Datos del grafo de la wiki: tipos + constructor puro desde pages reales.
 * Vive en shared porque lo consumen el renderer (mapa 3D) y el main
 * (handler IPC `wiki:graph`); el layout 3D queda en el renderer.
 */

import type { WikiPage, WikiPageType } from './wikiDoc'

export type WikiGraphNodeType = WikiPageType

export interface WikiGraphNode {
  slug: string
  title: string
  type: WikiGraphNodeType
  /** Grado del nodo (aristas entrantes + salientes); escala el tamaño visual. */
  linkCount: number
  /** Body crudo de la page (markdown); ausente solo en datos de mock/layout. */
  body?: string
}

export interface WikiGraphEdge {
  from: string
  to: string
}

export interface WikiGraphData {
  nodes: WikiGraphNode[]
  edges: WikiGraphEdge[]
}

/** Respuesta del canal IPC `wiki:graph`. */
export interface WikiGraphResult {
  ok: boolean
  data?: WikiGraphData
  /** Últimas líneas de `log.md` (máx. 50); ausente si no hay wiki local. */
  logTail?: string[]
  error?: string
}

/**
 * Grafo desde las pages reales: un nodo por page; aristas desde `page.links`
 * solo si el slug destino existe (links rotos se ignoran, sin nodos fantasma).
 * Aristas bidireccionales dedupeadas (a→b y b→a cuentan una sola vez) y
 * `linkCount` = grado del nodo sobre las aristas ya dedupeadas.
 */
export function buildWikiGraphData(pages: WikiPage[]): WikiGraphData {
  const slugs = new Set(pages.map(page => page.slug))
  const edges: WikiGraphEdge[] = []
  const seenPairs = new Set<string>()
  for (const page of pages) {
    for (const link of page.links) {
      if (link === page.slug || !slugs.has(link)) continue
      const key = page.slug < link ? `${page.slug}\u0000${link}` : `${link}\u0000${page.slug}`
      if (seenPairs.has(key)) continue
      seenPairs.add(key)
      edges.push({ from: page.slug, to: link })
    }
  }
  const degree = new Map<string, number>()
  for (const edge of edges) {
    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1)
    degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1)
  }
  return {
    nodes: pages.map(page => ({
      slug: page.slug,
      title: page.title,
      type: page.type,
      linkCount: degree.get(page.slug) ?? 0,
      body: page.body,
    })),
    edges,
  }
}
