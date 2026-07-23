import type { TabSession, AgentPaneMeta } from '@shared/tabSession'
import {
  resolveAgentPaneMeta,
  type ProjectAgentDefinition,
} from '@shared/projectAgentCatalog'

/** Resuelve la vista runtime de un pane desde binding local + catálogo del cwd. */
export function resolveTabAgentMeta(
  tab: TabSession,
  paneId: string,
  catalogByCwd: Record<string, ProjectAgentDefinition[]>,
): AgentPaneMeta {
  const binding = tab.agentByPane?.[paneId]
  const cwd = tab.projectFolder?.trim() ?? ''
  const agents = cwd ? (catalogByCwd[cwd] ?? []) : []
  if (!binding) {
    return {
      id: `missing-${paneId.slice(0, 8)}`,
      provider: 'claude',
      permissionMode: 'ask',
      autoImproveContexts: true,
    }
  }
  const definition = agents.find(agent => agent.id === binding.agentId)
  return resolveAgentPaneMeta(binding, definition)
}

export function indexProjectAgents(
  agents: ProjectAgentDefinition[],
): Map<string, ProjectAgentDefinition> {
  return new Map(agents.map(agent => [agent.id, agent]))
}

export function upsertAgentInList(
  agents: ProjectAgentDefinition[],
  next: ProjectAgentDefinition,
): ProjectAgentDefinition[] {
  const without = agents.filter(agent => agent.id !== next.id)
  return [...without, next].sort((a, b) => a.id.localeCompare(b.id))
}
