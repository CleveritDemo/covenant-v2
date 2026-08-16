export interface ContextAssignmentEdge {
  contextId: string
  paneId: string
  color: string
}

export interface PlanePoint {
  x: number
  y: number
}

/** Subconjunto de DOMRect que necesita el trazado (facilita testear sin DOM). */
export interface PlaneRect {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

export interface ContextLinkFocus {
  contextId?: string | null
  paneId?: string | null
}

export interface MeasuredContextLink {
  key: string
  from: PlanePoint
  to: PlanePoint
  color: string
}

export interface RenderedContextLink {
  key: string
  d: string
  color: string
  to: PlanePoint
}

/** Reserva mínima de corredor: nunca dibujamos un muñón sin recorrido visible. */
export const CONTEXT_LINK_MIN_REACH = 26
/** Por debajo de este span horizontal usamos corredor vertical (pantallas estrechas). */
export const CONTEXT_LINK_NARROW_SPAN = 80
/** Margen dentro de la card para que el remate no toque el borde superior/inferior. */
const CARD_EDGE_PADDING = 10

/** Destinos dentro de este ΔY comparten carril y van casi pegados. */
export const CONTEXT_LINK_SIMILAR_DEST_Y = 22

export interface ContextConnectorPathOptions {
  laneIndex?: number
  laneCount?: number
}

/** Aristas contexto → agente a partir de contextIds en catálogo. */
export function buildContextAssignmentEdges(
  agents: readonly { paneId: string; contextIds?: readonly string[] }[],
  colorByContextId: Readonly<Record<string, string>>,
): ContextAssignmentEdge[] {
  const edges: ContextAssignmentEdge[] = []
  for (const agent of agents) {
    for (const contextId of new Set(agent.contextIds ?? [])) {
      const color = colorByContextId[contextId]
      if (!color) continue
      edges.push({ contextId, paneId: agent.paneId, color })
    }
  }
  return edges
}

/**
 * Solo se dibuja lo que el usuario está señalando: un contexto del pool con sus
 * agentes, o un agente con sus contextos. Sin foco no hay líneas.
 */
export function focusedContextEdges(
  edges: readonly ContextAssignmentEdge[],
  focus: ContextLinkFocus,
): ContextAssignmentEdge[] {
  const contextId = focus.contextId ?? null
  const paneId = focus.paneId ?? null
  if (contextId) return edges.filter(edge => edge.contextId === contextId)
  if (paneId) return edges.filter(edge => edge.paneId === paneId)
  return []
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
}

/**
 * Anclajes del conector: sale del borde izquierdo del chip del pool y remata en el
 * borde derecho de la card, a la altura del icono del contexto. Nunca cruza la card.
 */
export function contextConnectorAnchors(
  planeRect: PlaneRect,
  chipRect: PlaneRect,
  cardRect: PlaneRect,
  iconRect: PlaneRect | null,
): { from: PlanePoint; to: PlanePoint } {
  const from: PlanePoint = {
    x: chipRect.left - planeRect.left,
    y: chipRect.top + chipRect.height / 2 - planeRect.top,
  }

  const cardRightX = cardRect.right - planeRect.left
  const availableSpan = from.x - cardRightX
  const minReach = Math.min(
    CONTEXT_LINK_MIN_REACH,
    Math.max(10, availableSpan * 0.32),
  )

  const rawY = iconRect
    ? iconRect.top + iconRect.height / 2
    : cardRect.top + cardRect.height / 2
  const minY = cardRect.top + Math.min(CARD_EDGE_PADDING, cardRect.height / 2)
  const maxY = cardRect.bottom - Math.min(CARD_EDGE_PADDING, cardRect.height / 2)

  const to: PlanePoint = {
    x: Math.min(
      cardRightX,
      from.x - minReach,
    ),
    y: clamp(rawY, minY, maxY) - planeRect.top,
  }

  return { from, to }
}

function round(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * Curva suave con tangentes horizontales; menos curvatura que la original (bend ~28% del span).
 * En corredores estrechos enruta por eje vertical con curvas más contenidas.
 */
export function contextConnectorPath(
  from: PlanePoint,
  to: PlanePoint,
  options?: ContextConnectorPathOptions,
): string {
  const span = Math.abs(from.x - to.x)
  if (span < CONTEXT_LINK_NARROW_SPAN) {
    return contextConnectorNarrowPath(from, to, span, options)
  }

  const laneCount = options?.laneCount ?? 1
  const laneIndex = options?.laneIndex ?? 0
  const bend = clamp(span * 0.28, 10, 32)
  const laneSpread = laneCount > 1 ? clamp(span * 0.015, 0.5, 2.5) : 0
  const laneOffset = (laneIndex - (laneCount - 1) / 2) * laneSpread
  const c1x = round(from.x - bend + laneOffset)
  const c2x = round(to.x + bend + laneOffset)

  return [
    `M ${round(from.x)} ${round(from.y)}`,
    `C ${c1x} ${round(from.y)}`,
    `${c2x} ${round(to.y)}`,
    `${round(to.x)} ${round(to.y)}`,
  ].join(' ')
}

function contextConnectorNarrowPath(
  from: PlanePoint,
  to: PlanePoint,
  span: number,
  options?: ContextConnectorPathOptions,
): string {
  const laneCount = options?.laneCount ?? 1
  const laneIndex = options?.laneIndex ?? 0
  const baseMidX = (from.x + to.x) / 2
  const laneSpread = laneCount > 1 ? clamp(span * 0.025, 0.5, 2.5) : 0
  const midX = round(baseMidX + (laneIndex - (laneCount - 1) / 2) * laneSpread)
  const lead = round(clamp(span * 0.22, 4, 10))
  const bendY = round((from.y + to.y) / 2)

  return [
    `M ${round(from.x)} ${round(from.y)}`,
    `C ${round(from.x - lead)} ${round(from.y)}`,
    `${midX} ${round(from.y)}`,
    `${midX} ${bendY}`,
    `C ${midX} ${round(to.y)}`,
    `${round(to.x + lead)} ${round(to.y)}`,
    `${round(to.x)} ${round(to.y)}`,
  ].join(' ')
}

/** Carriles solo entre líneas con destino Y parecido; el resto va sola sin abanico. */
export function resolveConnectorLanes(
  links: readonly MeasuredContextLink[],
): ContextConnectorPathOptions[] {
  return links.map(link => {
    const peers = links.filter(
      other => Math.abs(other.to.y - link.to.y) <= CONTEXT_LINK_SIMILAR_DEST_Y,
    )
    const laneCount = peers.length
    const sorted = [...peers].sort(
      (a, b) => a.from.y - b.from.y || a.to.y - b.to.y || a.key.localeCompare(b.key),
    )
    const laneIndex = Math.max(0, sorted.findIndex(peer => peer.key === link.key))
    return { laneIndex, laneCount }
  })
}

export function buildContextConnectorPaths(
  links: readonly MeasuredContextLink[],
): RenderedContextLink[] {
  const lanes = resolveConnectorLanes(links)
  return links.map((link, index) => ({
    key: link.key,
    color: link.color,
    to: link.to,
    d: contextConnectorPath(link.from, link.to, lanes[index]),
  }))
}

/** Evita re-render del SVG cuando scroll/resize no movió ningún anclaje. */
export function renderedContextLinksEqual(
  a: readonly RenderedContextLink[],
  b: readonly RenderedContextLink[],
): boolean {
  if (a.length !== b.length) return false
  return a.every((link, i) => {
    const other = b[i]!
    return link.key === other.key
      && link.d === other.d
      && link.color === other.color
      && link.to.x === other.to.x
      && link.to.y === other.to.y
  })
}
