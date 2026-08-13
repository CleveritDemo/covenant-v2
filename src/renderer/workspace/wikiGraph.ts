/**
 * Grafo de la wiki del workspace: layout force-directed precalculado.
 * Módulo puro (sin DOM, sin three): la vista 3D solo consume posiciones.
 * Tipos y `buildWikiGraphData` (pages reales → grafo) viven en
 * `@shared/wikiGraph` porque también los usa el main (canal `wiki:graph`);
 * aquí se reexportan para el resto del renderer. `wikiGraphMockData` queda
 * solo para tests y ajustes de layout: el runtime usa pages reales vía IPC.
 */

import type {
  WikiGraphData,
  WikiGraphEdge,
  WikiGraphNode,
  WikiGraphNodeType,
} from '@shared/wikiGraph'

export { buildWikiGraphData } from '@shared/wikiGraph'
export type {
  WikiGraphData,
  WikiGraphEdge,
  WikiGraphNode,
  WikiGraphNodeType,
} from '@shared/wikiGraph'

export interface WikiGraphLayoutOptions {
  seed: number
}

/** PRNG mulberry32: determinista, suficiente para layout (no cripto). */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ITERATIONS = 150
/** Constante de repulsión entre todo par de nodos. */
const REPULSION = 320
/** Rigidez del resorte por arista. */
const SPRING = 0.035
/** Longitud de reposo del resorte. */
const SPRING_LENGTH = 9
/** Paso máximo por iteración; decae linealmente (simulated annealing simple). */
const MAX_STEP = 2.4
/** Radio de la nube inicial. */
const INITIAL_RADIUS = 12
/** Atracción suave al origen para que el grafo no derive. */
const CENTER_PULL = 0.012

/**
 * Layout force-directed 3D precalculado: repulsión O(n²) + atracción por
 * arista, ~150 iteraciones. Determinista: mismo `seed` y mismos datos →
 * mismas posiciones exactas.
 */
export function layoutWikiGraph(
  data: WikiGraphData,
  options: WikiGraphLayoutOptions,
): Map<string, [number, number, number]> {
  const random = createSeededRandom(options.seed)
  const slugs = data.nodes.map(node => node.slug)
  const index = new Map<string, number>(slugs.map((slug, i) => [slug, i]))
  const n = slugs.length
  const px = new Float64Array(n)
  const py = new Float64Array(n)
  const pz = new Float64Array(n)

  for (let i = 0; i < n; i++) {
    // Distribución en esfera con radio dependiente del índice: sin dos nodos
    // en el mismo punto aunque el RNG coincida.
    const theta = random() * Math.PI * 2
    const phi = Math.acos(2 * random() - 1)
    const r = INITIAL_RADIUS * (0.35 + 0.65 * random()) + i * 0.01
    px[i] = r * Math.sin(phi) * Math.cos(theta)
    py[i] = r * Math.sin(phi) * Math.sin(theta)
    pz[i] = r * Math.cos(phi)
  }

  const edgePairs: Array<[number, number]> = []
  for (const edge of data.edges) {
    const a = index.get(edge.from)
    const b = index.get(edge.to)
    if (a === undefined || b === undefined || a === b) continue
    edgePairs.push([a, b])
  }

  const fx = new Float64Array(n)
  const fy = new Float64Array(n)
  const fz = new Float64Array(n)

  for (let iter = 0; iter < ITERATIONS; iter++) {
    fx.fill(0)
    fy.fill(0)
    fz.fill(0)

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = px[i]! - px[j]!
        let dy = py[i]! - py[j]!
        let dz = pz[i]! - pz[j]!
        let distSq = dx * dx + dy * dy + dz * dz
        if (distSq < 1e-6) {
          // Coincidencia exacta: separación determinista según índices.
          dx = 0.01 * (i + 1)
          dy = 0.01 * (j + 1)
          dz = 0.01
          distSq = dx * dx + dy * dy + dz * dz
        }
        const dist = Math.sqrt(distSq)
        const force = REPULSION / distSq
        const ux = dx / dist
        const uy = dy / dist
        const uz = dz / dist
        fx[i]! += ux * force
        fy[i]! += uy * force
        fz[i]! += uz * force
        fx[j]! -= ux * force
        fy[j]! -= uy * force
        fz[j]! -= uz * force
      }
    }

    for (const [a, b] of edgePairs) {
      const dx = px[b]! - px[a]!
      const dy = py[b]! - py[a]!
      const dz = pz[b]! - pz[a]!
      const dist = Math.max(0.001, Math.sqrt(dx * dx + dy * dy + dz * dz))
      const force = SPRING * (dist - SPRING_LENGTH)
      const ux = (dx / dist) * force
      const uy = (dy / dist) * force
      const uz = (dz / dist) * force
      fx[a]! += ux
      fy[a]! += uy
      fz[a]! += uz
      fx[b]! -= ux
      fy[b]! -= uy
      fz[b]! -= uz
    }

    const cooling = MAX_STEP * (1 - iter / ITERATIONS)
    for (let i = 0; i < n; i++) {
      fx[i]! -= px[i]! * CENTER_PULL
      fy[i]! -= py[i]! * CENTER_PULL
      fz[i]! -= pz[i]! * CENTER_PULL
      const mag = Math.sqrt(fx[i]! * fx[i]! + fy[i]! * fy[i]! + fz[i]! * fz[i]!)
      if (mag < 1e-9) continue
      const step = Math.min(mag, cooling) / mag
      px[i]! += fx[i]! * step
      py[i]! += fy[i]! * step
      pz[i]! += fz[i]! * step
    }
  }

  const result = new Map<string, [number, number, number]>()
  for (let i = 0; i < n; i++) {
    result.set(slugs[i]!, [px[i]!, py[i]!, pz[i]!])
  }
  return result
}

const MOCK_EDGES: WikiGraphEdge[] = [
  { from: 'arquitectura', to: 'stack-frontend' },
  { from: 'arquitectura', to: 'stack-backend' },
  { from: 'arquitectura', to: 'decision-electron' },
  { from: 'stack-frontend', to: 'decision-react' },
  { from: 'stack-frontend', to: 'guia-componentes' },
  { from: 'stack-backend', to: 'decision-postgres' },
  { from: 'stack-backend', to: 'api-contratos' },
  { from: 'flujo-release', to: 'decision-electron' },
  { from: 'flujo-release', to: 'guia-versionado' },
  { from: 'flujo-onboarding', to: 'arquitectura' },
  { from: 'flujo-onboarding', to: 'guia-componentes' },
  { from: 'flujo-ingest-wiki', to: 'api-contratos' },
  { from: 'flujo-ingest-wiki', to: 'decision-wiki-multidoc' },
  { from: 'decision-wiki-multidoc', to: 'arquitectura' },
  { from: 'guia-versionado', to: 'api-contratos' },
  { from: 'ref-three-js', to: 'stack-frontend' },
  { from: 'ref-orbit-controls', to: 'ref-three-js' },
  { from: 'ref-electron-updater', to: 'flujo-release' },
  { from: 'decision-i18n', to: 'guia-componentes' },
  { from: 'decision-i18n', to: 'flujo-onboarding' },
]

const MOCK_NODES: Array<Omit<WikiGraphNode, 'linkCount'>> = [
  { slug: 'arquitectura', title: 'Arquitectura general', type: 'concept' },
  { slug: 'stack-frontend', title: 'Stack frontend', type: 'concept' },
  { slug: 'stack-backend', title: 'Stack backend', type: 'concept' },
  { slug: 'guia-componentes', title: 'Guía de componentes UI', type: 'concept' },
  { slug: 'guia-versionado', title: 'Guía de versionado', type: 'concept' },
  { slug: 'api-contratos', title: 'Contratos de API', type: 'concept' },
  { slug: 'decision-electron', title: 'Decisión: Electron', type: 'decision' },
  { slug: 'decision-react', title: 'Decisión: React 18', type: 'decision' },
  { slug: 'decision-postgres', title: 'Decisión: Postgres', type: 'decision' },
  { slug: 'decision-wiki-multidoc', title: 'Decisión: wiki multi-doc', type: 'decision' },
  { slug: 'decision-i18n', title: 'Decisión: i18n en/es', type: 'decision' },
  { slug: 'flujo-release', title: 'Flujo de release', type: 'flow' },
  { slug: 'flujo-onboarding', title: 'Flujo de onboarding', type: 'flow' },
  { slug: 'flujo-ingest-wiki', title: 'Flujo de ingest de wiki', type: 'flow' },
  { slug: 'ref-three-js', title: 'Referencia: three.js', type: 'reference' },
  { slug: 'ref-orbit-controls', title: 'Referencia: OrbitControls', type: 'reference' },
  { slug: 'ref-electron-updater', title: 'Referencia: electron-updater', type: 'reference' },
]

/** Datos de ejemplo (~17 nodos, 4 tipos) solo para tests y ajustes de layout. */
export function wikiGraphMockData(): WikiGraphData {
  const degree = new Map<string, number>()
  for (const edge of MOCK_EDGES) {
    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1)
    degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1)
  }
  return {
    nodes: MOCK_NODES.map(node => ({
      ...node,
      linkCount: degree.get(node.slug) ?? 0,
    })),
    edges: MOCK_EDGES.map(edge => ({ ...edge })),
  }
}
