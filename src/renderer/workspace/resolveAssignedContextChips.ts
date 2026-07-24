import type { TabContext } from '@shared/tabContext'
import { resolveContextColor } from '@shared/tabContextAppearance'
import { contextIconName } from '../agent/tabContextKindIcons'
import type { PlaneAgentContextChip } from '../workspace/PlaneAgentContextNodes'

/** Chip de contexto asignado; sintetiza agentResult si el catálogo del tab aún no lo tiene. */
export function resolveAssignedContextChips(
  contextIds: readonly string[],
  discovered: readonly TabContext[],
  contextUsage: ReadonlyMap<string, number>,
  kindLabel: (kind: TabContext['kind']) => string,
): PlaneAgentContextChip[] {
  const chips: PlaneAgentContextChip[] = []
  for (const id of contextIds) {
    const found = discovered.find(context => context.id === id)
    if (found) {
      chips.push({
        id: found.id,
        name: found.name,
        kind: found.kind,
        kindLabel: kindLabel(found.kind),
        icon: contextIconName(found),
        color: resolveContextColor(found),
        shared: (contextUsage.get(found.id) ?? 0) > 1,
      })
      continue
    }
    if (!id.startsWith('iaterminal:result:')) continue
    const stem = id.slice('iaterminal:result:'.length).trim() || 'agent'
    const synthetic: TabContext = {
      id,
      name: stem,
      fileName: `results/${stem}.md`,
      kind: 'agentResult',
    }
    chips.push({
      id,
      name: stem,
      kind: 'agentResult',
      kindLabel: kindLabel('agentResult'),
      icon: contextIconName(synthetic),
      color: resolveContextColor(synthetic),
      shared: (contextUsage.get(id) ?? 0) > 1,
    })
  }
  return chips
}

export function contextIdsEqual(
  left: readonly string[] | undefined,
  right: readonly string[] | undefined,
): boolean {
  const a = left ?? []
  const b = right ?? []
  return a.length === b.length && a.every((id, index) => id === b[index])
}
