import type { ProjectAgentDefinition } from './projectAgentCatalog'
import { agentResultContextIdForSlug } from './projectAgentCatalog'
import type { TabContext, TabContextKind } from './tabContext'

/** `all` = sin filtro, `unused` = contextos que ningún agente carga, o un id de agente. */
export type ContextAgentFilter = 'all' | 'unused' | (string & {})

export interface TabContextListFilter {
  agent: ContextAgentFilter
  kind: TabContextKind | 'all'
  query: string
}

export const EMPTY_TAB_CONTEXT_FILTER: TabContextListFilter = {
  agent: 'all',
  kind: 'all',
  query: '',
}

/** Agentes cuyo `contextIds` incluye este contexto. */
export function agentsUsingContext(
  agents: readonly ProjectAgentDefinition[],
  contextId: string,
): ProjectAgentDefinition[] {
  return agents.filter(agent => agent.contextIds?.includes(contextId))
}

/**
 * A quién se le puede asignar el contexto. El dueño de un results queda fuera:
 * ya lo escribe él, cargárselo solo duplicaría su propio texto en el prompt.
 */
export function agentsAssignableToContext(
  agents: readonly ProjectAgentDefinition[],
  context: TabContext,
): ProjectAgentDefinition[] {
  if (context.kind !== 'agentResult') return [...agents]
  return agents.filter(agent => agentResultContextIdForSlug(agent.id) !== context.id)
}

/** Definición nueva con el contexto agregado o quitado; sin ids, la clave se omite. */
export function toggleAgentContextId(
  agent: ProjectAgentDefinition,
  contextId: string,
): ProjectAgentDefinition {
  const current = agent.contextIds ?? []
  const next = current.includes(contextId)
    ? current.filter(id => id !== contextId)
    : [...current, contextId]
  if (!next.length) {
    const { contextIds: _dropped, ...rest } = agent
    return rest
  }
  return { ...agent, contextIds: next }
}

/**
 * Definición nueva con el contexto agregado, o null si no hay nada que escribir.
 * Es lo que decide un drop —«además», nunca quitar—: repetido no cambia nada y
 * el dueño de un results no se carga el suyo.
 */
export function addAgentContextId(
  agent: ProjectAgentDefinition,
  contextId: string,
): ProjectAgentDefinition | null {
  const id = contextId.trim()
  if (!id) return null
  if (agentResultContextIdForSlug(agent.id) === id) return null
  const current = agent.contextIds ?? []
  if (current.includes(id)) return null
  return { ...agent, contextIds: [...current, id] }
}

export function filterTabContexts(
  contexts: readonly TabContext[],
  agents: readonly ProjectAgentDefinition[],
  filter: TabContextListFilter,
): TabContext[] {
  const query = filter.query.trim().toLowerCase()
  return contexts.filter(context => {
    if (filter.kind !== 'all' && context.kind !== filter.kind) return false
    if (query && !`${context.name} ${context.fileName}`.toLowerCase().includes(query)) return false
    if (filter.agent === 'all') return true
    const users = agentsUsingContext(agents, context.id)
    if (filter.agent === 'unused') return users.length === 0
    return users.some(agent => agent.id === filter.agent)
  })
}

export function unusedContextCount(
  contexts: readonly TabContext[],
  agents: readonly ProjectAgentDefinition[],
): number {
  return contexts.filter(context => agentsUsingContext(agents, context.id).length === 0).length
}

/** Kinds presentes en el catálogo, en el orden en que aparecen (chips del filtro). */
export function presentContextKinds(contexts: readonly TabContext[]): TabContextKind[] {
  const seen: TabContextKind[] = []
  for (const context of contexts) {
    if (!seen.includes(context.kind)) seen.push(context.kind)
  }
  return seen
}
