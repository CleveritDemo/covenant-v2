import {
  parseProjectAgentDefinition,
  type ProjectAgentDefinition,
} from './projectAgentCatalog'
import {
  ALL_CONTEXT_KINDS,
  type TabContext,
  type TabContextKind,
} from './tabContext'
import type { CovenantWorkspaceAgentRecord, CovenantWorkspaceContextRecord } from './covenantTypes'

function isTabContextKind(value: string): value is TabContextKind {
  return (ALL_CONTEXT_KINDS as readonly string[]).includes(value)
}

/** Convierte agentes del backend a definiciones de catálogo en memoria. */
export function projectAgentsFromWorkspaceAgents(
  items: readonly CovenantWorkspaceAgentRecord[],
): ProjectAgentDefinition[] {
  const out: ProjectAgentDefinition[] = []
  for (const item of items) {
    const agentId = typeof item.agentId === 'string' ? item.agentId.trim() : ''
    if (!agentId) continue
    const raw =
      item.definition && typeof item.definition === 'object'
        ? { ...item.definition, id: agentId }
        : { id: agentId }
    const parsed = parseProjectAgentDefinition(raw, agentId)
    if (parsed) out.push(parsed)
  }
  return out.sort((a, b) => a.id.localeCompare(b.id))
}

/** Convierte contextos del backend a TabContext en memoria (sin filesystem). */
export function tabContextsFromWorkspaceContexts(
  items: readonly CovenantWorkspaceContextRecord[],
): TabContext[] {
  const out: TabContext[] = []
  for (const item of items) {
    const contextId = typeof item.contextId === 'string' ? item.contextId.trim() : ''
    const kindRaw = typeof item.kind === 'string' ? item.kind.trim() : ''
    const name = typeof item.name === 'string' ? item.name.trim() : ''
    if (!contextId || !name || !isTabContextKind(kindRaw)) continue
    const meta = item.meta && typeof item.meta === 'object' ? item.meta : {}
    const fileName =
      typeof meta.fileName === 'string' && meta.fileName.trim()
        ? meta.fileName.trim()
        : `${name}.md`
    const context: TabContext = {
      id: contextId,
      name,
      fileName,
      kind: kindRaw,
    }
    if (typeof meta.icon === 'string' && meta.icon.trim()) context.icon = meta.icon.trim()
    if (typeof meta.color === 'string' && meta.color.trim()) context.color = meta.color.trim()
    if (typeof meta.rootPath === 'string' && meta.rootPath.trim()) {
      context.rootPath = meta.rootPath.trim()
    }
    if (Array.isArray(meta.paths)) {
      const paths = meta.paths.filter((p): p is string => typeof p === 'string' && !!p.trim())
      if (paths.length) context.paths = paths
    }
    out.push(context)
  }
  return out
}
