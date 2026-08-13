import type { TabContextKind } from '@shared/tabContext'
import type { IconName } from '../components/ui/Icon'

export interface PlaneContextPoolItem {
  id: string
  name: string
  kind: TabContextKind
  kindLabel: string
  icon: IconName
  color: string
}

/** Agente del plano al que se le puede asignar un contexto. */
export interface PlaneContextPoolAgent {
  paneId: string
  title: string
  contextIds: string[]
}

/** Cuántos/qué agentes tienen ya asignado cada contexto. */
export function assignedPaneIdsByContext(
  agents: PlaneContextPoolAgent[],
): Record<string, string[]> {
  const byContext: Record<string, string[]> = {}
  for (const agent of agents) {
    for (const contextId of new Set(agent.contextIds)) {
      const paneIds = byContext[contextId] ?? (byContext[contextId] = [])
      paneIds.push(agent.paneId)
    }
  }
  return byContext
}

/** Chips que caben en la barra; el resto vive en el popover de desbordamiento. */
export const POOL_VISIBLE_CAP = 6

/**
 * Reparte el catálogo entre la barra y el desbordamiento. Primero lo que está en
 * juego (asignado a algún agente), porque la barra debe mostrar estado y no el
 * catálogo entero — es lo único que no crece con el proyecto.
 */
export function splitPoolContexts<T extends { id: string }>(
  contexts: readonly T[],
  assignedCount: (contextId: string) => number,
  cap: number = POOL_VISIBLE_CAP,
): { visible: T[]; overflow: T[] } {
  // `sort` es estable: a igual conteo se conserva el orden del catálogo.
  const ranked = [...contexts].sort(
    (left, right) => assignedCount(right.id) - assignedCount(left.id),
  )
  return { visible: ranked.slice(0, cap), overflow: ranked.slice(cap) }
}
