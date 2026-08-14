import type { HumanQueuedTurnLike } from '@shared/queuedTurnPreview'

export type { HumanQueuedTurnLike }

export function isHumanQueuedTurn(item: HumanQueuedTurnLike): boolean {
  return !item.delegation && !item.orchestrationFollowUp
}

export function queuedTurnHumanKey(item: HumanQueuedTurnLike): string {
  return `${item.text.trim()}\0${item.images?.length ?? 0}`
}

/** Turno encolado con la identidad del envío que lo originó, si la tenía. */
export interface QueuedTurnWithSource extends HumanQueuedTurnLike {
  id: string
  sourceSendId?: string
  /** Ids de envíos fusionados en este chip (p. ej. tras mergeQueuedTurns). */
  sourceSendIds?: string[]
}

/** Conjunto ordenado y sin duplicados de ids de envío de un turno encolado. */
export function queuedTurnSourceSendIds(
  turn: Pick<QueuedTurnWithSource, 'sourceSendId' | 'sourceSendIds'>,
): string[] {
  const ids = [
    turn.sourceSendId?.trim(),
    ...(turn.sourceSendIds ?? []).map(id => id.trim()),
  ].filter((id): id is string => Boolean(id))
  const seen = new Set<string>()
  return ids.filter(id => {
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}

/** Limpia el hueco preferSend solo si el sendId pendiente pertenece al chip removido. */
export function shouldClearPlaneSendForRemovedQueuedTurn(
  removedTurn: Pick<QueuedTurnWithSource, 'sourceSendId' | 'sourceSendIds'>,
  pendingSendId: string | undefined,
): boolean {
  const pending = pendingSendId?.trim()
  if (!pending) return false
  const removedIds = queuedTurnSourceSendIds(removedTurn)
  if (removedIds.length === 0) return false
  return removedIds.includes(pending)
}

export type AppendQueuedTurnOutcome = 'enqueued' | 'duplicate' | 'full'

/**
 * `duplicate` = ya hay en la cola un turno del mismo envío (`sourceSendId`).
 * El llamador debe tratarlo como consumido, no como rechazado: el mensaje ya
 * está encolado y reintentar solo pintaría otra copia. `full` sí es rechazo.
 */
export function appendQueuedTurnIfRoom<T extends QueuedTurnWithSource>(
  turns: readonly T[],
  item: T,
  maxVisible: number,
): { turns: T[]; didEnqueue: boolean; outcome: AppendQueuedTurnOutcome } {
  const sourceSendId = item.sourceSendId?.trim()
  if (
    sourceSendId
    && turns.some(turn => queuedTurnSourceSendIds(turn).includes(sourceSendId))
  ) {
    return { turns: [...turns], didEnqueue: false, outcome: 'duplicate' }
  }
  if (turns.length >= maxVisible) {
    return { turns: [...turns], didEnqueue: false, outcome: 'full' }
  }
  return { turns: [...turns, item], didEnqueue: true, outcome: 'enqueued' }
}

export function removeQueuedTurnById<T extends HumanQueuedTurnLike & { id: string }>(
  turns: readonly T[],
  id: string,
): T[] {
  const kept: T[] = []
  for (const turn of turns) {
    if (turn.id === id) {
      turn.images?.forEach(image => {
        if (
          image
          && typeof image === 'object'
          && 'previewUrl' in image
          && typeof image.previewUrl === 'string'
        ) {
          URL.revokeObjectURL(image.previewUrl)
        }
      })
      continue
    }
    kept.push(turn)
  }
  return kept
}
