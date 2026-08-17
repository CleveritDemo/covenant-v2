/** Duración del reorder FLIP de chips de hilo (ms). */
export const THREAD_CHIP_REORDER_MS = 340

const REORDER_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

export function threadChipReorderReducedMotion(): boolean {
  if (typeof document === 'undefined') return true
  if (document.documentElement.getAttribute('data-reduce-motion') === 'true') {
    return true
  }
  if (typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * FLIP horizontal: anima chips existentes desde su rect previo al layout nuevo.
 * Ids nuevos (sin prev) no se animan; reduce-motion = no-op.
 */
export function animateThreadChipReorder(
  root: HTMLElement,
  previousLeftById: ReadonlyMap<string, number>,
): Map<string, number> {
  const nodes = [
    ...root.querySelectorAll<HTMLElement>('[data-thread-chip-id]'),
  ]
  const nextLeftById = new Map<string, number>()
  for (const node of nodes) {
    const id = node.dataset.threadChipId?.trim()
    if (!id) continue
    nextLeftById.set(id, node.getBoundingClientRect().left)
  }

  if (threadChipReorderReducedMotion() || previousLeftById.size === 0) {
    return nextLeftById
  }

  for (const node of nodes) {
    const id = node.dataset.threadChipId?.trim()
    if (!id) continue
    const firstLeft = previousLeftById.get(id)
    const lastLeft = nextLeftById.get(id)
    if (firstLeft == null || lastLeft == null) continue
    const dx = firstLeft - lastLeft
    if (Math.abs(dx) < 0.5) continue
    node.animate(
      [
        { transform: `translateX(${dx}px)` },
        { transform: 'translateX(0)' },
      ],
      {
        duration: THREAD_CHIP_REORDER_MS,
        easing: REORDER_EASE,
        fill: 'none',
      },
    )
  }

  return nextLeftById
}
