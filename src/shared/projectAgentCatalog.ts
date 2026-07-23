import {
  AGENT_NAME_MAX_LENGTH,
  AGENT_OBJECTIVE_MAX_LENGTH,
  AGENT_ROLE_MAX_LENGTH,
  sanitizeAgentRulesDraft,
  sanitizeAgentTextDraft,
} from './agentIdentity'

export type AgentCliProvider = 'claude' | 'cursor'
export type AgentPermissionMode = 'ask' | 'auto' | 'plan'

/** Definición compartible en `.iaterminal/agents/<id>.json`. */
export interface ProjectAgentDefinition {
  id: string
  provider: AgentCliProvider
  permissionMode: AgentPermissionMode
  name?: string
  role?: string
  objective?: string
  rules?: string[]
  model?: string
  contextIds?: string[]
  autoImproveContexts?: boolean
  emitResults?: boolean
}

/** Enlace local pane → catálogo (+ sesión CLI). Vive en session.json. */
export interface AgentPaneBinding {
  agentId: string
  cliSessionId?: string
}

/** Vista runtime: catálogo + sesión CLI local. */
export type AgentPaneMeta = ProjectAgentDefinition & {
  cliSessionId?: string
}

export const PROJECT_AGENTS_DIR = 'agents'

/** Slug de archivo/id a partir de nombre o fallback. */
export function normalizeAgentSlug(value: string | null | undefined, fallback = 'agent'): string {
  const stem = (value ?? '')
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .toLowerCase()
    .slice(0, 64)
  return stem || fallback
}

export function projectAgentFileName(id: string): string {
  return `${normalizeAgentSlug(id)}.json`
}

export function allocateAgentSlug(
  preferred: string | null | undefined,
  existingIds: ReadonlySet<string>,
  fallback = 'agent',
): string {
  const base = normalizeAgentSlug(preferred, fallback)
  if (!existingIds.has(base)) return base
  for (let n = 2; n < 10_000; n += 1) {
    const candidate = `${base}-${n}`.slice(0, 64)
    if (!existingIds.has(candidate)) return candidate
  }
  return `${base}-${Date.now().toString(36)}`.slice(0, 64)
}

function sanitizePermissionMode(raw: unknown): AgentPermissionMode {
  if (raw === 'auto') return 'auto'
  if (raw === 'plan' || raw === 'readonly') return 'plan'
  return 'ask'
}

function sanitizeProvider(raw: unknown): AgentCliProvider {
  return raw === 'cursor' ? 'cursor' : 'claude'
}

/** Parsea y normaliza un JSON de catálogo; null si inválido. */
export function parseProjectAgentDefinition(
  raw: unknown,
  fileIdHint?: string,
): ProjectAgentDefinition | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  const idRaw = typeof data.id === 'string' && data.id.trim()
    ? data.id
    : fileIdHint
  if (!idRaw) return null
  const id = normalizeAgentSlug(idRaw)
  if (!id) return null

  const def: ProjectAgentDefinition = {
    id,
    provider: sanitizeProvider(data.provider),
    permissionMode: sanitizePermissionMode(data.permissionMode),
  }

  const name = sanitizeAgentTextDraft(
    typeof data.name === 'string' ? data.name : undefined,
    AGENT_NAME_MAX_LENGTH,
  )
  if (name) def.name = name
  const role = sanitizeAgentTextDraft(
    typeof data.role === 'string' ? data.role : undefined,
    AGENT_ROLE_MAX_LENGTH,
  )
  if (role) def.role = role
  const objective = sanitizeAgentTextDraft(
    typeof data.objective === 'string' ? data.objective : undefined,
    AGENT_OBJECTIVE_MAX_LENGTH,
  )
  if (objective) def.objective = objective
  const rules = sanitizeAgentRulesDraft(
    Array.isArray(data.rules) ? data.rules.map(String) : undefined,
  )
  if (rules.length) def.rules = rules
  if (typeof data.model === 'string' && data.model.trim()) {
    def.model = data.model.trim()
  }
  if (Array.isArray(data.contextIds)) {
    const contextIds = data.contextIds.filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0,
    )
    if (contextIds.length) def.contextIds = contextIds
  }
  if (data.autoImproveContexts === true) def.autoImproveContexts = true
  if (data.emitResults === true) def.emitResults = true
  return def
}

/** Copia compartible sin id (para clonar con nuevo slug). */
export function cloneProjectAgentDefinition(
  source: ProjectAgentDefinition,
  nameSuffix = '',
): Omit<ProjectAgentDefinition, 'id'> {
  const baseName = source.name?.trim() ?? ''
  const name = baseName
    ? `${baseName}${nameSuffix}`.slice(0, AGENT_NAME_MAX_LENGTH)
    : undefined
  return {
    provider: source.provider,
    permissionMode: source.permissionMode,
    ...(name ? { name } : {}),
    ...(source.role ? { role: source.role } : {}),
    ...(source.objective ? { objective: source.objective } : {}),
    ...(source.rules?.length ? { rules: [...source.rules] } : {}),
    ...(source.model ? { model: source.model } : {}),
    ...(source.contextIds?.length ? { contextIds: [...source.contextIds] } : {}),
    ...(source.autoImproveContexts === true ? { autoImproveContexts: true } : {}),
    ...(source.emitResults === true ? { emitResults: true } : {}),
  }
}

/** ¿Meta antigua rica en session (sin agentId)? */
export function isLegacyRichAgentMeta(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false
  const data = raw as Record<string, unknown>
  if (typeof data.agentId === 'string' && data.agentId.trim()) return false
  return data.provider === 'claude' || data.provider === 'cursor'
}

/** Convierte meta legacy de session a definición de catálogo. */
export function legacyAgentMetaToDefinition(
  paneId: string,
  raw: unknown,
  existingIds: ReadonlySet<string>,
): ProjectAgentDefinition | null {
  if (!isLegacyRichAgentMeta(raw)) return null
  const data = raw as Record<string, unknown>
  const preferred =
    typeof data.name === 'string' && data.name.trim()
      ? data.name
      : `agent-${paneId.slice(0, 8)}`
  const id = allocateAgentSlug(preferred, existingIds)
  return parseProjectAgentDefinition({ ...data, id }, id)
}

export function parseAgentPaneBinding(raw: unknown): AgentPaneBinding | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  if (typeof data.agentId !== 'string' || !data.agentId.trim()) return null
  const agentId = normalizeAgentSlug(data.agentId)
  if (!agentId) return null
  const binding: AgentPaneBinding = { agentId }
  if (typeof data.cliSessionId === 'string' && data.cliSessionId.trim()) {
    binding.cliSessionId = data.cliSessionId.trim()
  }
  return binding
}

/** Une catálogo + binding local para la UI del pane. */
export function resolveAgentPaneMeta(
  binding: AgentPaneBinding,
  definition: ProjectAgentDefinition | undefined,
): AgentPaneMeta {
  const base: ProjectAgentDefinition = definition && definition.id === binding.agentId
    ? definition
    : {
        id: binding.agentId,
        provider: 'claude',
        permissionMode: 'ask',
        autoImproveContexts: true,
      }
  return {
    ...base,
    id: binding.agentId,
    ...(binding.cliSessionId ? { cliSessionId: binding.cliSessionId } : {}),
  }
}

export function agentDefinitionFromMeta(meta: AgentPaneMeta): ProjectAgentDefinition {
  return parseProjectAgentDefinition({
    id: meta.id,
    provider: meta.provider,
    permissionMode: meta.permissionMode,
    name: meta.name,
    role: meta.role,
    objective: meta.objective,
    rules: meta.rules,
    model: meta.model,
    contextIds: meta.contextIds,
    autoImproveContexts: meta.autoImproveContexts,
    emitResults: meta.emitResults,
  }, meta.id) ?? {
    id: normalizeAgentSlug(meta.id, 'agent'),
    provider: meta.provider === 'cursor' ? 'cursor' : 'claude',
    permissionMode: meta.permissionMode === 'auto'
      ? 'auto'
      : meta.permissionMode === 'plan'
        ? 'plan'
        : 'ask',
  }
}

export function agentBindingFromMeta(meta: AgentPaneMeta): AgentPaneBinding {
  return {
    agentId: normalizeAgentSlug(meta.id, 'agent'),
    ...(typeof meta.cliSessionId === 'string' && meta.cliSessionId.trim()
      ? { cliSessionId: meta.cliSessionId.trim() }
      : {}),
  }
}

export interface AgentCatalogMigrationWrite {
  projectFolder: string
  definition: ProjectAgentDefinition
}

export interface AgentCatalogMigrationTabInput {
  projectFolder?: string
  paneIds: string[]
  paneKinds?: Record<string, string>
  agentByPane?: Record<string, unknown>
}

/**
 * Planifica migración session rica → bindings + definiciones a escribir en disco.
 * No toca el filesystem.
 */
export function planAgentCatalogMigration(
  tabs: AgentCatalogMigrationTabInput[],
  cwds: Record<string, string> = {},
): {
  tabs: Array<AgentCatalogMigrationTabInput & { agentByPane?: Record<string, AgentPaneBinding> }>
  writes: AgentCatalogMigrationWrite[]
  changed: boolean
} {
  const writes: AgentCatalogMigrationWrite[] = []
  let changed = false
  const nextTabs = tabs.map(tab => {
    const paneIds = Array.isArray(tab.paneIds) ? tab.paneIds : []
    let projectFolder =
      typeof tab.projectFolder === 'string' && tab.projectFolder.trim()
        ? tab.projectFolder.trim()
        : ''
    if (!projectFolder) {
      const terminalIds = paneIds.filter(id => tab.paneKinds?.[id] !== 'agent')
      const ordered = [
        ...terminalIds,
        ...paneIds.filter(id => !terminalIds.includes(id)),
      ]
      projectFolder = ordered.map(id => cwds[id]?.trim() || '').find(Boolean) || ''
    }

    const usedSlugs = new Set<string>()
    // Reservar ids ya en bindings slim.
    for (const paneId of paneIds) {
      if (tab.paneKinds?.[paneId] !== 'agent') continue
      const binding = parseAgentPaneBinding(tab.agentByPane?.[paneId])
      if (binding) usedSlugs.add(binding.agentId)
    }

    const agentByPane: Record<string, AgentPaneBinding> = {}
    let tabChanged = false

    for (const paneId of paneIds) {
      if (tab.paneKinds?.[paneId] !== 'agent') continue
      const raw = tab.agentByPane?.[paneId]
      const binding = parseAgentPaneBinding(raw)
      if (binding) {
        agentByPane[paneId] = binding
        continue
      }
      if (isLegacyRichAgentMeta(raw) && projectFolder) {
        const definition = legacyAgentMetaToDefinition(paneId, raw, usedSlugs)
        if (definition) {
          usedSlugs.add(definition.id)
          const cliSessionId =
            raw && typeof raw === 'object'
            && typeof (raw as { cliSessionId?: unknown }).cliSessionId === 'string'
            && (raw as { cliSessionId: string }).cliSessionId.trim()
              ? (raw as { cliSessionId: string }).cliSessionId.trim()
              : undefined
          agentByPane[paneId] = {
            agentId: definition.id,
            ...(cliSessionId ? { cliSessionId } : {}),
          }
          writes.push({ projectFolder, definition })
          tabChanged = true
          changed = true
          continue
        }
      }
      const fallbackId = allocateAgentSlug(
        `agent-${paneId.slice(0, 8)}`,
        usedSlugs,
      )
      usedSlugs.add(fallbackId)
      agentByPane[paneId] = { agentId: fallbackId }
      if (raw !== undefined) {
        tabChanged = true
        changed = true
      }
    }

    if (!tabChanged && Object.keys(agentByPane).length === 0) return tab
    if (!tabChanged) {
      // Comparar si ya era slim idéntico
      const prev = tab.agentByPane ?? {}
      const same = Object.keys(agentByPane).every(id => {
        const a = agentByPane[id]!
        const b = parseAgentPaneBinding(prev[id])
        return b?.agentId === a.agentId && b?.cliSessionId === a.cliSessionId
      })
      if (same && Object.keys(prev).length === Object.keys(agentByPane).length) return tab
    }

    return {
      ...tab,
      ...(projectFolder ? { projectFolder } : {}),
      ...(Object.keys(agentByPane).length ? { agentByPane } : { agentByPane: undefined }),
    }
  })

  return { tabs: nextTabs, writes, changed }
}
