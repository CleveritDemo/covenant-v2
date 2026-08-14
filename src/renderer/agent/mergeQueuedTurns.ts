/** Forma mínima de un turno encolado para poder fusionarlo. */
export interface MergeableQueuedTurnLike {
  id: string
  text: string
  images: unknown[]
  orchestrationFollowUp?: boolean
  delegation?: object
  sourceSendId?: string
  sourceSendIds?: string[]
}

function collectSourceSendIds(turn: MergeableQueuedTurnLike): string[] {
  return [
    turn.sourceSendId?.trim(),
    ...(turn.sourceSendIds ?? []).map(id => id.trim()),
  ].filter((id): id is string => Boolean(id))
}

function dedupeSourceSendIds(ids: string[]): string[] {
  const seen = new Set<string>()
  return ids.filter(id => {
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}

function isMergeable(turn: MergeableQueuedTurnLike): boolean {
  return !turn.delegation
}

function mergeRun<T extends MergeableQueuedTurnLike>(run: T[]): T {
  const sourceSendIds = dedupeSourceSendIds(run.flatMap(collectSourceSendIds))
  return {
    ...run[0]!,
    text: run
      .map(turn => turn.text)
      .filter(text => text.trim() !== '')
      .join('\n'),
    images: run.flatMap(turn => turn.images),
    ...(sourceSendIds.length > 0 ? { sourceSendIds } : {}),
  } as T
}

/**
 * Fusiona runs consecutivos de turnos humanos (sin delegation; incluye
 * orchestrationFollowUp) en uno solo por run: conserva el id del primero,
 * concatena imágenes en orden y une textos no vacíos con '\n'. Las
 * delegaciones quedan intactas y parten runs. Con ningún run ≥ 2 devuelve
 * el array original.
 */
export function mergeQueuedTurns<T extends MergeableQueuedTurnLike>(turns: T[]): T[] {
  if (turns.length < 2) return turns

  const result: T[] = []
  let run: T[] = []

  const flushRun = (): void => {
    if (run.length === 0) return
    result.push(run.length === 1 ? run[0]! : mergeRun(run))
    run = []
  }

  for (const turn of turns) {
    if (isMergeable(turn)) {
      run.push(turn)
    } else {
      flushRun()
      result.push(turn)
    }
  }
  flushRun()

  const unchanged = result.length === turns.length
    && result.every((item, index) => item === turns[index])
  if (unchanged) return turns

  return result
}
