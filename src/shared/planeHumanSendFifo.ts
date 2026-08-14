export const MAX_HUMAN_SENDS_PER_PANE = 10
/** Tope de turnos visibles en la cola del panel (composer + chips). */
export const MAX_VISIBLE_QUEUED_TURNS = 10

export function enqueueHumanSend<T>(
  queue: readonly T[],
  item: T,
  cap: number = MAX_HUMAN_SENDS_PER_PANE,
): { queue: T[]; dropped: boolean } {
  if (queue.length >= cap) {
    return { queue: [...queue], dropped: true }
  }
  return { queue: [...queue, item], dropped: false }
}

export function takeNextHumanSend<T>(
  queue: readonly T[],
): { head: T | undefined; rest: T[] } {
  if (!queue.length) {
    return { head: undefined, rest: [] }
  }
  const [head, ...rest] = queue
  return { head, rest }
}
