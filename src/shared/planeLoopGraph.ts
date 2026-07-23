/** Enlace dirigido entre loops de agentes (origen → destino). */
export interface PlaneLoopLink {
  id: string
  fromPaneId: string
  toPaneId: string
  /** Interacción/objetivo que el destino ejecutará al arrancar su loop. */
  objective?: string
}

/** Posición de un nodo en el lienzo de loops (coordenadas del viewport del canvas). */
export interface PlaneLoopNodePosition {
  x: number
  y: number
}

/** Ancho alineado a la mini card de agente del plano (`PLANE_MINI_WINDOW_WIDTH`). */
const NODE_DEFAULT_WIDTH = 200
/** Altura típica de la mini card de agente sin contextos (para anclar edges). */
const NODE_DEFAULT_HEIGHT = 78
const LAYOUT_ORIGIN_X = 48
const LAYOUT_ORIGIN_Y = 40
const LAYOUT_GAP_X = 260
const LAYOUT_GAP_Y = 130
const LAYOUT_COLUMNS = 3

/** ¿Añadir `from → to` crearía un ciclo en el grafo? */
export function wouldCreateLoopCycle(
  links: readonly PlaneLoopLink[],
  fromPaneId: string,
  toPaneId: string,
): boolean {
  if (fromPaneId === toPaneId) return true
  const adjacency = new Map<string, string[]>()
  for (const link of links) {
    const list = adjacency.get(link.fromPaneId) ?? []
    list.push(link.toPaneId)
    adjacency.set(link.fromPaneId, list)
  }
  const tentative = adjacency.get(fromPaneId) ?? []
  if (!tentative.includes(toPaneId)) {
    adjacency.set(fromPaneId, [...tentative, toPaneId])
  }
  const seen = new Set<string>()
  const stack = [toPaneId]
  while (stack.length > 0) {
    const current = stack.pop()!
    if (current === fromPaneId) return true
    if (seen.has(current)) continue
    seen.add(current)
    for (const next of adjacency.get(current) ?? []) stack.push(next)
  }
  return false
}

/** True si ya existe el mismo par origen→destino. */
export function hasLoopLink(
  links: readonly PlaneLoopLink[],
  fromPaneId: string,
  toPaneId: string,
): boolean {
  return links.some(link => link.fromPaneId === fromPaneId && link.toPaneId === toPaneId)
}

/** Id estable sin depender de `crypto` en entornos de test Node. */
function newLoopLinkId(): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return uuid
  return `loop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function createLoopLink(
  fromPaneId: string,
  toPaneId: string,
  objective?: string,
): PlaneLoopLink {
  const trimmed = objective?.trim() ?? ''
  return {
    id: newLoopLinkId(),
    fromPaneId,
    toPaneId,
    ...(trimmed ? { objective: trimmed } : {}),
  }
}

/** Destinos directos de un agente origen. */
export function outgoingLoopTargets(
  links: readonly PlaneLoopLink[],
  fromPaneId: string,
): string[] {
  return links
    .filter(link => link.fromPaneId === fromPaneId)
    .map(link => link.toPaneId)
}

/** Enlaces salientes (destino + objetivo) desde un origen. */
export function outgoingLoopLinks(
  links: readonly PlaneLoopLink[],
  fromPaneId: string,
): PlaneLoopLink[] {
  return links.filter(link => link.fromPaneId === fromPaneId)
}

/** Layout en rejilla para nodos sin posición guardada. */
export function defaultLoopNodePosition(index: number): PlaneLoopNodePosition {
  const col = index % LAYOUT_COLUMNS
  const row = Math.floor(index / LAYOUT_COLUMNS)
  return {
    x: LAYOUT_ORIGIN_X + col * LAYOUT_GAP_X,
    y: LAYOUT_ORIGIN_Y + row * LAYOUT_GAP_Y,
  }
}

export function resolveLoopNodePosition(
  paneId: string,
  index: number,
  positions: Record<string, PlaneLoopNodePosition> | undefined,
): PlaneLoopNodePosition {
  const saved = positions?.[paneId]
  if (
    saved
    && Number.isFinite(saved.x)
    && Number.isFinite(saved.y)
  ) {
    return { x: saved.x, y: saved.y }
  }
  return defaultLoopNodePosition(index)
}

export const PLANE_LOOP_NODE_SIZE = {
  width: NODE_DEFAULT_WIDTH,
  height: NODE_DEFAULT_HEIGHT,
} as const

/** Offset del centro del puerto respecto al borde de la card (`left/right: -8px`, Ø 14). */
const PORT_CENTER_OUTSET = 1

export type PlaneLoopNodeSize = {
  width: number
  height: number
}

/** Punto de anclaje de salida/entrada para una curva bezier. */
export function loopNodePort(
  position: PlaneLoopNodePosition,
  side: 'out' | 'in',
  size: PlaneLoopNodeSize = PLANE_LOOP_NODE_SIZE,
): { x: number; y: number } {
  const width = size.width > 0 ? size.width : NODE_DEFAULT_WIDTH
  const height = size.height > 0 ? size.height : NODE_DEFAULT_HEIGHT
  const y = position.y + height / 2
  if (side === 'out') {
    return { x: position.x + width + PORT_CENTER_OUTSET, y }
  }
  return { x: position.x - PORT_CENTER_OUTSET, y }
}

/** Path SVG cúbico entre dos puertos (opcionalmente con tamaño medido de cada card). */
export function loopEdgePath(
  from: PlaneLoopNodePosition,
  to: PlaneLoopNodePosition,
  fromSize: PlaneLoopNodeSize = PLANE_LOOP_NODE_SIZE,
  toSize: PlaneLoopNodeSize = PLANE_LOOP_NODE_SIZE,
): string {
  const start = loopNodePort(from, 'out', fromSize)
  const end = loopNodePort(to, 'in', toSize)
  const dx = Math.max(48, Math.abs(end.x - start.x) * 0.45)
  const c1x = start.x + dx
  const c2x = end.x - dx
  return `M ${start.x} ${start.y} C ${c1x} ${start.y}, ${c2x} ${end.y}, ${end.x} ${end.y}`
}

export function sanitizePlaneLoopLinks(
  links: unknown,
  agentPaneIds: ReadonlySet<string>,
): PlaneLoopLink[] {
  if (!Array.isArray(links)) return []
  const seen = new Set<string>()
  const result: PlaneLoopLink[] = []
  for (const raw of links) {
    if (!raw || typeof raw !== 'object') continue
    const item = raw as Record<string, unknown>
    const fromPaneId = typeof item.fromPaneId === 'string' ? item.fromPaneId : ''
    const toPaneId = typeof item.toPaneId === 'string' ? item.toPaneId : ''
    if (!agentPaneIds.has(fromPaneId) || !agentPaneIds.has(toPaneId)) continue
    if (fromPaneId === toPaneId) continue
    const pairKey = `${fromPaneId}\0${toPaneId}`
    if (seen.has(pairKey)) continue
    if (wouldCreateLoopCycle(result, fromPaneId, toPaneId)) continue
    seen.add(pairKey)
    const id = typeof item.id === 'string' && item.id.trim()
      ? item.id.trim()
      : newLoopLinkId()
    const objective = typeof item.objective === 'string' ? item.objective.trim() : ''
    result.push({
      id,
      fromPaneId,
      toPaneId,
      ...(objective ? { objective } : {}),
    })
  }
  return result
}

export function sanitizePlaneLoopNodePositions(
  positions: unknown,
  agentPaneIds: ReadonlySet<string>,
): Record<string, PlaneLoopNodePosition> | undefined {
  if (!positions || typeof positions !== 'object') return undefined
  const next: Record<string, PlaneLoopNodePosition> = {}
  for (const [paneId, raw] of Object.entries(positions as Record<string, unknown>)) {
    if (!agentPaneIds.has(paneId) || !raw || typeof raw !== 'object') continue
    const point = raw as Record<string, unknown>
    const x = typeof point.x === 'number' ? point.x : Number.NaN
    const y = typeof point.y === 'number' ? point.y : Number.NaN
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    next[paneId] = { x, y }
  }
  return Object.keys(next).length > 0 ? next : undefined
}
