/** Forma mínima de un turno encolado para dedupe humano. */
export interface HumanQueuedTurnLike {
  text: string
  images: Array<{ previewUrl: string }>
  orchestrationFollowUp?: boolean
  delegation?: object
}

export function isHumanQueuedTurn(item: HumanQueuedTurnLike): boolean {
  return !item.delegation && !item.orchestrationFollowUp
}

export function queuedTurnHumanKey(item: HumanQueuedTurnLike): string {
  return `${item.text.trim()}\0${item.images.length}`
}

export function dedupeHumanQueuedTurnOnEnqueue<T extends HumanQueuedTurnLike>(
  turns: T[],
  next: T,
): T[] {
  if (!isHumanQueuedTurn(next)) return [...turns, next]
  const key = queuedTurnHumanKey(next)
  if (turns.some(turn => isHumanQueuedTurn(turn) && queuedTurnHumanKey(turn) === key)) {
    return turns
  }
  return [...turns, next]
}

export function removeMatchingHumanQueuedTurns<T extends HumanQueuedTurnLike>(
  turns: T[],
  text: string,
  imageCount: number,
): T[] {
  const key = `${text.trim()}\0${imageCount}`
  const kept: T[] = []
  for (const turn of turns) {
    if (isHumanQueuedTurn(turn) && queuedTurnHumanKey(turn) === key) {
      turn.images.forEach(image => URL.revokeObjectURL(image.previewUrl))
      continue
    }
    kept.push(turn)
  }
  return kept
}
