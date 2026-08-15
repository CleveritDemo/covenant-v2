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

function effectiveHumanSendThreadId<T extends { threadId?: string }>(
  item: T,
  threadId: string,
): string {
  return item.threadId ?? threadId
}

export function enqueueHumanSendForThread<T extends { threadId?: string }>(
  queue: readonly T[],
  item: T,
  threadId: string,
  cap: number = MAX_HUMAN_SENDS_PER_PANE,
): { queue: T[]; dropped: boolean } {
  const itemThreadId = effectiveHumanSendThreadId(item, threadId)
  const sameThreadCount = queue.filter(
    queued => effectiveHumanSendThreadId(queued, threadId) === itemThreadId,
  ).length
  if (sameThreadCount >= cap) {
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

/** Primer item sin threadId o con threadId igual a activeThreadId; conserva orden del resto. */
/** Quita de la cola ítems con el mismo sendId (reoferta tras consumo). */
export function purgeFifoBySendId<T extends { sendId?: string }>(
  queue: readonly T[],
  sendId: string,
): { queue: T[]; removed: T[] } {
  const id = sendId.trim()
  if (!id) return { queue: [...queue], removed: [] }
  const removed: T[] = []
  const kept: T[] = []
  for (const item of queue) {
    if (item.sendId?.trim() === id) {
      removed.push(item)
    } else {
      kept.push(item)
    }
  }
  return { queue: kept, removed }
}

export function takeNextHumanSendForThread<T extends { threadId?: string }>(
  queue: readonly T[],
  activeThreadId: string,
): { head: T | null; rest: T[] } {
  const idx = queue.findIndex(
    item => item.threadId === undefined || item.threadId === activeThreadId,
  )
  if (idx < 0) {
    return { head: null, rest: [...queue] }
  }
  const head = queue[idx]!
  const rest = [...queue.slice(0, idx), ...queue.slice(idx + 1)]
  return { head, rest }
}
