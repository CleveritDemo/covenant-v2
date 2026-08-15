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

export type HumanSendFifoDrainItem = {
  threadId?: string
  sendId?: string
}

export type HumanSendFifoDrainInput<T extends HumanSendFifoDrainItem> = {
  queue: readonly T[]
  publishedThreadId?: string
  busy: boolean
  hasControls: boolean
  drainInFlight: boolean
  visibleQueuedCount: number
  maxVisibleQueued?: number
  planeSendOccupied: boolean
  isSendIdVisible: (sendId: string | undefined) => boolean
}

export type HumanSendFifoDrainResult<T extends HumanSendFifoDrainItem> =
  | { kind: 'noop' }
  | { kind: 'skip_in_flight' }
  | { kind: 'skip_visible_cap' }
  | { kind: 'skip_slot_occupied' }
  | { kind: 'queue_updated'; queue: T[] }
  | { kind: 'skip_duplicate_visible'; queue: T[]; requestTick: true }
  | { kind: 'prefer_send'; head: T; queue: T[] }
  | { kind: 'busy_enqueue'; head: T; queue: T[] }

function takeHeadForPublishedThread<T extends HumanSendFifoDrainItem>(
  queue: readonly T[],
  publishedThreadId: string | undefined,
): { head: T | null; rest: T[] } {
  if (publishedThreadId) {
    return takeNextHumanSendForThread(queue, publishedThreadId)
  }
  const taken = takeNextHumanSend(queue)
  return { head: taken.head ?? null, rest: taken.rest }
}

/** Un paso de drenaje FIFO humano para un pane (preferSend o enqueueHuman directo). */
export function drainHumanSendFifoForPane<T extends HumanSendFifoDrainItem>(
  input: HumanSendFifoDrainInput<T>,
): HumanSendFifoDrainResult<T> {
  const maxVisible = input.maxVisibleQueued ?? MAX_VISIBLE_QUEUED_TURNS
  const queue = input.queue

  if (input.busy && input.hasControls) {
    if (input.drainInFlight) return { kind: 'skip_in_flight' }
    if (input.visibleQueuedCount >= maxVisible) return { kind: 'skip_visible_cap' }
    if (!queue.length) return { kind: 'noop' }

    const { head, rest } = takeHeadForPublishedThread(queue, input.publishedThreadId)
    if (!head) {
      return { kind: 'queue_updated', queue: rest }
    }
    const nextQueue = rest
    if (input.isSendIdVisible(head.sendId)) {
      return { kind: 'skip_duplicate_visible', queue: nextQueue, requestTick: true }
    }
    return { kind: 'busy_enqueue', head, queue: nextQueue }
  }

  if (input.planeSendOccupied) return { kind: 'skip_slot_occupied' }
  if (input.visibleQueuedCount >= maxVisible) return { kind: 'skip_visible_cap' }
  if (!queue.length) return { kind: 'noop' }

  const { head, rest } = takeHeadForPublishedThread(queue, input.publishedThreadId)
  if (!head) {
    return { kind: 'queue_updated', queue: rest }
  }
  const nextQueue = rest
  if (input.isSendIdVisible(head.sendId)) {
    return { kind: 'skip_duplicate_visible', queue: nextQueue, requestTick: true }
  }
  return { kind: 'prefer_send', head, queue: nextQueue }
}
