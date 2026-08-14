import type { HumanQueuedTurnLike } from '@shared/queuedTurnPreview'

export type { HumanQueuedTurnLike }

export function isHumanQueuedTurn(item: HumanQueuedTurnLike): boolean {
  return !item.delegation && !item.orchestrationFollowUp
}

export function queuedTurnHumanKey(item: HumanQueuedTurnLike): string {
  return `${item.text.trim()}\0${item.images?.length ?? 0}`
}

export function appendQueuedTurnIfRoom<T extends HumanQueuedTurnLike & { id: string }>(
  turns: readonly T[],
  item: T,
  maxVisible: number,
): { turns: T[]; didEnqueue: boolean } {
  if (turns.length >= maxVisible) {
    return { turns: [...turns], didEnqueue: false }
  }
  return { turns: [...turns, item], didEnqueue: true }
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
