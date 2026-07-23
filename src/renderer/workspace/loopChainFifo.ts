/** Ítem FIFO: un turno de cadena pendiente para un agente. */
export interface LoopChainFifoItem {
  id: string
  tabId: string
  chainId: string
  stepIndex: number
  paneId: string
  text: string
}

export type LoopChainTurnPhase = 'awaiting_busy' | 'in_flight'

export interface LoopChainTurnWait {
  tabId: string
  chainId: string
  paneId: string
  stepIndex: number
  phase: LoopChainTurnPhase
}

function newFifoId(): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return uuid
  return `fifo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function createLoopChainFifoItem(
  input: Omit<LoopChainFifoItem, 'id'>,
): LoopChainFifoItem {
  return { ...input, id: newFifoId() }
}

/** Encola al final; evita duplicar el mismo paso de cadena. */
export function enqueueLoopChainFifo(
  queue: LoopChainFifoItem[],
  item: LoopChainFifoItem,
): LoopChainFifoItem[] {
  if (queue.some(
    existing =>
      existing.chainId === item.chainId
      && existing.stepIndex === item.stepIndex
      && existing.paneId === item.paneId,
  )) {
    return queue
  }
  return [...queue, item]
}

export function dequeueLoopChainFifoHead(
  queues: Map<string, LoopChainFifoItem[]>,
  paneId: string,
): LoopChainFifoItem | null {
  const list = queues.get(paneId)
  if (!list || list.length === 0) return null
  const [head, ...rest] = list
  if (rest.length === 0) queues.delete(paneId)
  else queues.set(paneId, rest)
  return head ?? null
}

export function removeLoopChainFromFifo(
  queues: Map<string, LoopChainFifoItem[]>,
  chainId: string,
): void {
  for (const [paneId, list] of [...queues.entries()]) {
    const next = list.filter(item => item.chainId !== chainId)
    if (next.length === 0) queues.delete(paneId)
    else if (next.length !== list.length) queues.set(paneId, next)
  }
}

export function removePaneFromFifo(
  queues: Map<string, LoopChainFifoItem[]>,
  paneId: string,
): void {
  queues.delete(paneId)
}
