/**
 * Persistencia local de chats de agente (UI transcript).
 * Clave estable por agentId + scope de workspace; nunca se sube al servidor.
 */

export interface AgentChatScope {
  projectFolder?: string
  orgWorkspace?: { slug: string; workspaceId: string }
}

/** Referencia IPC: archivo estable + opcional legacy por paneId. */
export interface AgentChatRef {
  storageKey: string
  legacyPaneId?: string
}

/** Hash corto estable (FNV-1a 32-bit) para nombres de archivo acotados. */
export function agentChatKeyDigest(value: string): string {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function readableAgentId(agentId: string): string {
  const cleaned = agentId.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '')
  return (cleaned || 'agent').slice(0, 64)
}

/**
 * Basename (sin .json) del transcript: mismo agentId + scope ⇒ mismo archivo
 * aunque el paneId cambie tras sync/catalog align.
 */
export function resolveAgentChatStorageKey(
  scope: AgentChatScope,
  agentId: string,
  fallbackPaneId?: string,
): string {
  const id = agentId.trim()
  if (!id) {
    const pane = fallbackPaneId?.trim()
    return pane || 'unknown'
  }

  const slug = scope.orgWorkspace?.slug?.trim() ?? ''
  const workspaceId = scope.orgWorkspace?.workspaceId?.trim() ?? ''
  if (slug && workspaceId) {
    const scopeDigest = agentChatKeyDigest(`${slug}\0${workspaceId}`)
    return `agent__org__${scopeDigest}__${agentChatKeyDigest(id)}__${readableAgentId(id)}`
  }

  const folder = scope.projectFolder?.trim() ?? ''
  if (folder) {
    return `agent__local__${agentChatKeyDigest(folder)}__${agentChatKeyDigest(id)}__${readableAgentId(id)}`
  }

  const pane = fallbackPaneId?.trim()
  if (pane) return pane
  return `agent__id__${agentChatKeyDigest(id)}__${readableAgentId(id)}`
}

export function agentChatRefFor(
  scope: AgentChatScope,
  agentId: string | undefined,
  paneId: string,
): AgentChatRef {
  const pane = paneId.trim()
  const id = agentId?.trim()
  if (!id) return { storageKey: pane || 'unknown' }
  const storageKey = resolveAgentChatStorageKey(scope, id, pane)
  return storageKey === pane
    ? { storageKey }
    : { storageKey, legacyPaneId: pane || undefined }
}

export function normalizeAgentChatRef(ref: AgentChatRef | string): AgentChatRef {
  if (typeof ref === 'string') {
    const key = ref.trim()
    return { storageKey: key || 'unknown' }
  }
  const storageKey = ref.storageKey.trim() || 'unknown'
  const legacyPaneId = ref.legacyPaneId?.trim()
  return legacyPaneId && legacyPaneId !== storageKey
    ? { storageKey, legacyPaneId }
    : { storageKey }
}

/** En cleanup por sync de catálogo: borrar solo si el agente ya no está. */
export function shouldDeleteAgentChatOnCatalogCleanup(
  agentId: string | undefined,
  catalogAgentIds: ReadonlySet<string>,
): boolean {
  const id = agentId?.trim()
  if (!id) return true
  return !catalogAgentIds.has(id)
}

export type AgentChatCleanupAction =
  | { type: 'delete'; ref: AgentChatRef }
  | { type: 'preserve'; ref: AgentChatRef }

/** Plan de cleanup de chats al quitar panes por align con el catálogo. */
export function planAgentChatCleanupForRemovedPanes(
  removed: ReadonlyArray<{ paneId: string; agentId?: string }>,
  catalogAgentIds: ReadonlySet<string>,
  scope: AgentChatScope,
): AgentChatCleanupAction[] {
  return removed.map(({ paneId, agentId }) => {
    const ref = agentChatRefFor(scope, agentId, paneId)
    if (shouldDeleteAgentChatOnCatalogCleanup(agentId, catalogAgentIds)) {
      return { type: 'delete', ref }
    }
    return { type: 'preserve', ref }
  })
}
