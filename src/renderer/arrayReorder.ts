/** Mueve un elemento a `insertAt` (índice en el array tras quitar el origen). */
export function moveItemToIndex<T>(items: readonly T[], fromIndex: number, insertAt: number): T[] {
  if (fromIndex === insertAt) return [...items]
  if (fromIndex < 0 || insertAt < 0 || fromIndex >= items.length) return [...items]
  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  const clamped = Math.max(0, Math.min(insertAt, next.length))
  next.splice(clamped, 0, moved)
  return next
}

/** Intercambia dos posiciones (p. ej. casillas de una rejilla de terminales). */
export function swapItemsAtIndices<T>(items: readonly T[], aIndex: number, bIndex: number): T[] {
  if (aIndex === bIndex) return [...items]
  if (aIndex < 0 || bIndex < 0 || aIndex >= items.length || bIndex >= items.length) {
    return [...items]
  }
  const next = [...items]
  ;[next[aIndex], next[bIndex]] = [next[bIndex], next[aIndex]]
  return next
}

/** Índice de inserción al soltar una pestaña antes/después de otra. */
export function computeTabInsertIndex(
  length: number,
  fromIndex: number,
  dropIndex: number,
  place: 'before' | 'after',
): number {
  let insertAt = place === 'before' ? dropIndex : dropIndex + 1
  if (fromIndex < insertAt) insertAt -= 1
  return Math.max(0, Math.min(insertAt, length - 1))
}

export function dropPlaceFromPointer(
  clientX: number,
  rect: Pick<DOMRect, 'left' | 'width'>,
): 'before' | 'after' {
  return clientX < rect.left + rect.width / 2 ? 'before' : 'after'
}

/** Ignora dragleave al pasar a un hijo del mismo contenedor. */
export function isDragLeaveForContainer(container: HTMLElement, relatedTarget: EventTarget | null): boolean {
  if (!(relatedTarget instanceof Node)) return true
  return !container.contains(relatedTarget)
}

export type PaneReorderKind = 'terminal' | 'agent'

function isPaneOfKind(
  paneId: string,
  kind: PaneReorderKind,
  paneKinds: Record<string, string> | undefined,
): boolean {
  const isAgent = paneKinds?.[paneId] === 'agent'
  return kind === 'agent' ? isAgent : !isAgent
}

/**
 * Reordena solo los panes de un kind y reensambla `[...terminals, ...agents]`.
 * `orderedKindIds` debe ser la lista completa de ids del kind en el nuevo orden.
 */
export function reorderPaneIdsByKind(
  paneIds: readonly string[],
  paneKinds: Record<string, string> | undefined,
  kind: PaneReorderKind,
  orderedKindIds: readonly string[],
): string[] {
  const terminals = paneIds.filter(id => isPaneOfKind(id, 'terminal', paneKinds))
  const agents = paneIds.filter(id => isPaneOfKind(id, 'agent', paneKinds))
  const current = kind === 'agent' ? agents : terminals
  if (orderedKindIds.length !== current.length) return [...paneIds]
  const currentSet = new Set(current)
  if (orderedKindIds.some(id => !currentSet.has(id))) return [...paneIds]
  if (kind === 'agent') return [...terminals, ...orderedKindIds]
  return [...orderedKindIds, ...agents]
}

/** Índice de inserción (lista sin el dragged) según Y del pointer vs centros de slots. */
export function insertIndexFromPointerY(
  orderedIds: readonly string[],
  slots: Record<string, Pick<{ y: number; height: number }, 'y' | 'height'>>,
  pointerY: number,
  draggingId: string,
): number {
  const others = orderedIds.filter(id => id !== draggingId)
  if (others.length === 0) return 0
  for (let i = 0; i < others.length; i += 1) {
    const slot = slots[others[i]!]
    if (!slot) continue
    const mid = slot.y + slot.height / 2
    if (pointerY < mid) return i
  }
  return others.length
}
