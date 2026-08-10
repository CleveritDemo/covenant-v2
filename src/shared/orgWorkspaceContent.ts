import {
  parseProjectAgentDefinition,
  type ProjectAgentDefinition,
} from './projectAgentCatalog'
import {
  ALL_CONTEXT_KINDS,
  type TabContext,
  type TabContextKind,
} from './tabContext'
import type {
  CovenantWorkspaceAgentRecord,
  CovenantWorkspaceContextPayload,
  CovenantWorkspaceContextRecord,
} from './covenantTypes'

function isTabContextKind(value: string): value is TabContextKind {
  return (ALL_CONTEXT_KINDS as readonly string[]).includes(value)
}

/** Segmento de ruta seguro: solo [A-Za-z0-9._-]; el resto se colapsa a '-'. */
export function sanitizeSlugSegment(s: string): string {
  return s.trim().replace(/[^A-Za-z0-9._-]+/g, '-')
}

/** Cuerpos markdown de contextos org (no viven en TabContext). */
const workspaceContextBodyById = new Map<string, string>()

export function rememberWorkspaceContextBody(contextId: string, body: string): void {
  const id = contextId.trim()
  if (!id) return
  workspaceContextBodyById.set(id, body)
}

export function forgetWorkspaceContextBody(contextId: string): void {
  const id = contextId.trim()
  if (!id) return
  workspaceContextBodyById.delete(id)
}

export function workspaceContextBody(contextId: string): string {
  return workspaceContextBodyById.get(contextId.trim()) ?? ''
}

/** Payload PUT para upsert de contexto org. */
export function workspaceContextUpsertPayload(
  context: TabContext,
  body?: string,
): CovenantWorkspaceContextPayload {
  const resolvedBody = body ?? workspaceContextBody(context.id)
  const meta: Record<string, unknown> = {
    fileName: context.fileName,
  }
  if (context.icon?.trim()) meta.icon = context.icon.trim()
  if (context.color?.trim()) meta.color = context.color.trim()
  if (context.rootPath?.trim()) meta.rootPath = context.rootPath.trim()
  if (context.paths?.length) meta.paths = context.paths
  if (context.symbolKinds?.length) meta.symbolKinds = context.symbolKinds
  return {
    kind: context.kind,
    name: context.name,
    body: resolvedBody,
    meta,
  }
}

export interface RenameWorkspaceContextDeps {
  upsert: (
    contextId: string,
    payload: CovenantWorkspaceContextPayload,
  ) => Promise<CovenantWorkspaceContextRecord>
  delete: (contextId: string) => Promise<void>
}

export interface RenameWorkspaceContextResult {
  record: CovenantWorkspaceContextRecord
  /** true si se borró previousId tras el upsert (ids distintos). */
  deletedPrevious: boolean
}

/**
 * Upsert del contexto en `nextId`; si `previousId` es otro id, DELETE tras upsert OK.
 * Fallback cuando el producto exige ids name-derived. Prefer `orgWorkspacePersistContext`
 * (stable API id) for org edit renames in TabContextFormModal.
 */
export async function renameWorkspaceContext(
  previousId: string,
  nextId: string,
  payload: CovenantWorkspaceContextPayload,
  deps: RenameWorkspaceContextDeps,
): Promise<RenameWorkspaceContextResult> {
  const prev = previousId.trim()
  const next = nextId.trim()
  if (!next) throw new Error('next context id required')

  const record = await deps.upsert(next, payload)
  rememberWorkspaceContextBody(next, payload.body ?? '')

  if (prev && prev !== next) {
    await deps.delete(prev)
    forgetWorkspaceContextBody(prev)
    return { record, deletedPrevious: true }
  }
  return { record, deletedPrevious: false }
}

/**
 * Variante tipada TabContext: arma el payload y renombra/upserta.
 * Usar cuando el id canónico puede cambiar con el name.
 */
export async function renameWorkspaceContextFromTab(
  slug: string,
  workspaceId: string,
  previousId: string,
  nextContext: TabContext,
  body: string | undefined,
  deps: {
    upsert: (
      slug: string,
      workspaceId: string,
      contextId: string,
      payload: CovenantWorkspaceContextPayload,
    ) => Promise<CovenantWorkspaceContextRecord>
    delete: (slug: string, workspaceId: string, contextId: string) => Promise<void>
  },
): Promise<RenameWorkspaceContextResult> {
  const payload = workspaceContextUpsertPayload(nextContext, body)
  return renameWorkspaceContext(previousId, nextContext.id, payload, {
    upsert: (contextId, p) => deps.upsert(slug, workspaceId, contextId, p),
    delete: contextId => deps.delete(slug, workspaceId, contextId),
  })
}

/**
 * Org workspace contexts keep a stable API `contextId` on rename.
 * Local `.gravity` materialization may regenerate id/fileName from the name;
 * for endpoint-backed org rows we upsert under the original id and only update
 * name/body/meta (fileName, icon, color, …). Avoids upsert(newId) leaving the
 * old id behind as a twin.
 */
export function orgWorkspacePersistContext(args: {
  mode: 'create' | 'edit'
  originalId: string
  normalized: TabContext
}): { persistId: string; context: TabContext } {
  const originalId = args.originalId.trim()
  if (args.mode === 'edit' && originalId) {
    return {
      persistId: originalId,
      context: { ...args.normalized, id: originalId },
    }
  }
  return { persistId: args.normalized.id, context: args.normalized }
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
    if (typeof item.body === 'string') rememberWorkspaceContextBody(contextId, item.body)
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
