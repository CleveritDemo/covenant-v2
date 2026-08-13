import type { TabContext } from '@shared/tabContext'
import { resolveContextColor } from '@shared/tabContextAppearance'
import { contextIconName } from '../agent/tabContextKindIcons'
import type { PlaneAgentContextChip } from '../workspace/PlaneAgentContextNodes'

/** Resuelve un TabContext del catálogo o sintetiza agentResult (`iaterminal:result:*`). */
export function resolveTabContextById(
  contextId: string,
  discovered: readonly TabContext[],
): TabContext | null {
  const id = contextId.trim()
  if (!id) return null
  const found = discovered.find(context => context.id === id)
  if (found) return found
  if (!id.startsWith('iaterminal:result:')) return null
  const stem = id.slice('iaterminal:result:'.length).trim() || 'agent'
  return {
    id,
    name: stem,
    fileName: `results/${stem}.md`,
    kind: 'agentResult',
  }
}

/** Chip de contexto asignado; sintetiza agentResult si el catálogo del tab aún no lo tiene. */
export function resolveAssignedContextChips(
  contextIds: readonly string[],
  discovered: readonly TabContext[],
  contextUsage: ReadonlyMap<string, number>,
  kindLabel: (kind: TabContext['kind']) => string,
): PlaneAgentContextChip[] {
  const chips: PlaneAgentContextChip[] = []
  for (const id of contextIds) {
    const resolved = resolveTabContextById(id, discovered)
    if (!resolved) continue
    chips.push({
      id: resolved.id,
      name: resolved.name,
      kind: resolved.kind,
      kindLabel: kindLabel(resolved.kind),
      icon: contextIconName(resolved),
      color: resolveContextColor(resolved),
      shared: (contextUsage.get(resolved.id) ?? 0) > 1,
      // Solo jira: la clave real de la issue, para pedir su preview (resumen/estado/frescura).
      issueKey: resolved.issueKey,
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
