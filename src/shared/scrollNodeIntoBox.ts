export interface ScrollBoxMetrics {
  scrollTop: number
  clientHeight: number
  scrollHeight: number
}

/** Nuevo scrollTop para centrar un nodo dentro de su caja, acotado al rango real. */
export function scrollTopToCenter(
  box: ScrollBoxMetrics,
  nodeOffsetFromViewTop: number,
  nodeHeight: number,
): number {
  const delta = nodeOffsetFromViewTop - (box.clientHeight - nodeHeight) / 2
  const max = Math.max(0, box.scrollHeight - box.clientHeight)
  return Math.max(0, Math.min(box.scrollTop + delta, max))
}
