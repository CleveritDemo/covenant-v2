import type { AgentCliProvider } from './agentCliProviders'
import type { AgentCoordination } from './projectAgentCatalog'
import { agentResultContextIdForSlug } from './projectAgentCatalog'
import type { TabContext, TabContextKind } from './tabContext'
import { agentMonogram, paletteColorForSeed } from './tabContextAppearance'

/** Cubos del picker: el usuario piensa en «markdown / código / repo / resultados». */
export type ContextGroupId = 'markdown' | 'code' | 'repo' | 'results'

export const CONTEXT_GROUP_IDS: readonly ContextGroupId[] = [
  'markdown', 'code', 'repo', 'results',
] as const

const GROUP_BY_KIND: Record<TabContextKind, ContextGroupId> = {
  notes: 'markdown',
  skill: 'markdown',
  wiki: 'markdown',
  symbols: 'code',
  files: 'code',
  folderTree: 'repo',
  git: 'repo',
  deps: 'repo',
  readme: 'repo',
  changelog: 'repo',
  mcp: 'repo',
  spreadsheet: 'repo',
  jira: 'repo',
  agentResult: 'results',
}

export function contextGroupId(kind: TabContextKind): ContextGroupId {
  return GROUP_BY_KIND[kind] ?? 'repo'
}

export interface ContextPickerAgent {
  id: string
  name?: string
  monogram?: string
  contextIds?: string[]
  provider?: AgentCliProvider
  coordination?: AgentCoordination
}

/** Agente que ya consume el contexto (para la pila de monogramas de la fila). */
export interface ContextUser {
  id: string
  name: string
  monogram: string
  provider?: AgentCliProvider
  color: string
}

/**
 * contextId → agentes del catálogo que lo tienen asignado, excluyendo al que se
 * está editando (su propio estado ya lo dice el check).
 */
export function contextUsageByAgent(
  agents: readonly ContextPickerAgent[],
  selfId?: string,
): Map<string, ContextUser[]> {
  const usage = new Map<string, ContextUser[]>()
  for (const agent of agents) {
    if (!agent.id || agent.id === selfId) continue
    const name = agent.name?.trim() || agent.id
    const user: ContextUser = {
      id: agent.id,
      name,
      monogram: agent.monogram?.trim().slice(0, 2).toUpperCase() || agentMonogram(name),
      provider: agent.provider,
      color: paletteColorForSeed(agentResultContextIdForSlug(agent.id)),
    }
    for (const contextId of agent.contextIds ?? []) {
      const list = usage.get(contextId)
      if (list) list.push(user)
      else usage.set(contextId, [user])
    }
  }
  return usage
}

export interface ContextPickerFilter {
  query?: string
  /** undefined = todos los grupos. */
  group?: ContextGroupId
  /** Solo los que ningún agente usa (ni el que se edita). */
  onlyUnused?: boolean
}

export function filterAgentContexts(
  contexts: readonly TabContext[],
  filter: ContextPickerFilter,
  usage: Map<string, ContextUser[]>,
  selectedIds: readonly string[] = [],
): TabContext[] {
  const query = filter.query?.trim().toLowerCase() ?? ''
  return contexts.filter(context => {
    if (filter.onlyUnused) {
      if (selectedIds.includes(context.id) || (usage.get(context.id)?.length ?? 0) > 0) return false
    } else if (filter.group && contextGroupId(context.kind) !== filter.group) {
      return false
    }
    if (!query) return true
    return context.name.toLowerCase().includes(query)
      || context.fileName.toLowerCase().includes(query)
      || context.id.toLowerCase().includes(query)
  })
}

export interface ContextPickerGroup {
  id: ContextGroupId
  items: TabContext[]
  selected: number
}

/** Agrupa preservando el orden de entrada dentro de cada cubo. */
export function groupAgentContexts(
  contexts: readonly TabContext[],
  selectedIds: readonly string[] = [],
): ContextPickerGroup[] {
  return CONTEXT_GROUP_IDS
    .map(id => {
      const items = contexts.filter(context => contextGroupId(context.kind) === id)
      return { id, items, selected: items.filter(c => selectedIds.includes(c.id)).length }
    })
    .filter(group => group.items.length > 0)
}
