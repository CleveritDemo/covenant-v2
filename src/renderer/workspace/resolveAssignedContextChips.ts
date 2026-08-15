import { synthesizeTabContextFromId, type TabContext } from '@shared/tabContext'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import { agentResultContextIdForSlug } from '@shared/projectAgentCatalog'
import { agentMonogram, resolveContextColor } from '@shared/tabContextAppearance'
import { contextIconName } from '../agent/tabContextKindIcons'
import type { PlaneAgentContextChip } from '../workspace/PlaneAgentContextNodes'

function resolveAgentResultMonogram(
  context: TabContext,
  agents: readonly ProjectAgentDefinition[],
): string {
  const agent = agents.find(item => agentResultContextIdForSlug(item.id) === context.id)
  const label = agent?.name?.trim() || agent?.id?.trim() || context.name
  return (agent?.monogram?.trim() || agentMonogram(label)).toUpperCase()
}

/**
 * Sin panes que compartan contexto: ninguno se marca como compartido. Lo usan
 * las vistas de sala, donde los contextos son del agente y de nadie más.
 */
export const NO_CONTEXT_USAGE: ReadonlyMap<string, number> = new Map()

/** Resuelve un TabContext del catálogo o sintetiza agentResult (`iaterminal:result:*`). */
export function resolveTabContextById(
  contextId: string,
  discovered: readonly TabContext[],
): TabContext | null {
  const id = contextId.trim()
  if (!id) return null
  const found = discovered.find(context => context.id === id)
  if (found) return found
  return synthesizeTabContextFromId(id)
}

/** Chip de contexto asignado; sintetiza agentResult si el catálogo del tab aún no lo tiene. */
export function resolveAssignedContextChips(
  contextIds: readonly string[],
  discovered: readonly TabContext[],
  contextUsage: ReadonlyMap<string, number>,
  kindLabel: (kind: TabContext['kind']) => string,
  agents: readonly ProjectAgentDefinition[] = [],
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
      monogram: resolved.kind === 'agentResult'
        ? resolveAgentResultMonogram(resolved, agents)
        : undefined,
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
