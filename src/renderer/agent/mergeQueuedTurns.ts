/** Forma mínima de un turno encolado para poder fusionarlo. */
export interface MergeableQueuedTurnLike {
  id: string
  text: string
  images: unknown[]
  orchestrationFollowUp?: boolean
  delegation?: object
}

function isMergeable(turn: MergeableQueuedTurnLike): boolean {
  return !turn.delegation && !turn.orchestrationFollowUp
}

/**
 * Fusiona los turnos humanos de la cola (sin delegation ni orchestrationFollowUp)
 * en uno solo, en la posición del primero: conserva su id, concatena imágenes en
 * orden y une los textos no vacíos con '\n'. Los turnos con flags quedan intactos
 * en su orden relativo. Con menos de 2 fusionables devuelve el array original.
 */
export function mergeQueuedTurns<T extends MergeableQueuedTurnLike>(turns: T[]): T[] {
  const mergeable = turns.filter(isMergeable)
  if (mergeable.length < 2) return turns

  // Spread genérico: TS no garantiza T al sobrescribir props, cast explícito.
  const merged = {
    ...mergeable[0],
    text: mergeable
      .map(turn => turn.text)
      .filter(text => text.trim() !== '')
      .join('\n'),
    images: mergeable.flatMap(turn => turn.images),
  } as T

  const result: T[] = []
  let mergedInserted = false
  for (const turn of turns) {
    if (!isMergeable(turn)) {
      result.push(turn)
      continue
    }
    if (!mergedInserted) {
      result.push(merged)
      mergedInserted = true
    }
  }
  return result
}
