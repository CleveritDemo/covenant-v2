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
/** Margen dentro de la card para que el remate no toque el borde superior/inferior. */
const CARD_EDGE_PADDING = 10

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

  const rawY = iconRect
    ? iconRect.top + iconRect.height / 2
    : cardRect.top + cardRect.height / 2
  const minY = cardRect.top + Math.min(CARD_EDGE_PADDING, cardRect.height / 2)
  const maxY = cardRect.bottom - Math.min(CARD_EDGE_PADDING, cardRect.height / 2)

  const to: PlanePoint = {
    x: Math.min(
      cardRect.right - planeRect.left,
      from.x - CONTEXT_LINK_MIN_REACH,
    ),
    y: clamp(rawY, minY, maxY) - planeRect.top,
  }

  return { from, to }
}

function round(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * Curva corta con tangentes horizontales en ambos extremos: sale del chip hacia la
 * izquierda y entra a la card desde la derecha, sin carriles ni espinas compartidas.
 */
export function contextConnectorPath(from: PlanePoint, to: PlanePoint): string {
  const span = Math.abs(from.x - to.x)
  const bend = clamp(span * 0.55, 14, 56)
  const c1x = round(from.x - bend)
  const c2x = round(to.x + bend)

  return [
    `M ${round(from.x)} ${round(from.y)}`,
    `C ${c1x} ${round(from.y)}`,
    `${c2x} ${round(to.y)}`,
    `${round(to.x)} ${round(to.y)}`,
  ].join(' ')
}

export function buildContextConnectorPaths(
  links: readonly MeasuredContextLink[],
): RenderedContextLink[] {
  return links.map(link => ({
    key: link.key,
    color: link.color,
    to: link.to,
    d: contextConnectorPath(link.from, link.to),
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
