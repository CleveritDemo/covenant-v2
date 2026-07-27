import {
  AGENT_NAME_MAX_LENGTH,
  AGENT_OBJECTIVE_MAX_LENGTH,
  AGENT_ROLE_MAX_LENGTH,
  normalizeAgentRules,
  sanitizeAgentRulesDraft,
  sanitizeAgentTextDraft,
} from './agentIdentity'
import {
  sanitizeAgentCoordination,
  sanitizeOrchestrationMaxRounds,
  persistableDelegateTo,
  MAX_ORCHESTRATION_ROUNDS,
  type AgentCoordination,
  type DelegateToPolicy,
} from './agentOrchestration'
import { normalizeContextFileName, type TabContext } from './tabContext'

export type AgentCliProvider = 'claude' | 'cursor'
export type AgentPermissionMode = 'ask' | 'auto' | 'plan'
export type { AgentCoordination, DelegateToPolicy }

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
  /** none (default) | orchestrator | productOwner: puede delegar a otros agentes. */
  coordination?: AgentCoordination
  /** Si false, no acepta subtareas del orquestador (default true). */
  acceptDelegations?: boolean
  /** Tope de oleadas de delegación (solo orquestador; default 3, omitido si default). */
  orchestrationMaxRounds?: number
  /** A quién puede delegar; omitido si equals default del coordination. */
  delegateTo?: DelegateToPolicy
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

/** Definición inicial al crear un agente (emitResults on; id desde el nombre). */
export function buildNewProjectAgentDefinition(
  provider: AgentCliProvider,
  name: string,
  existingIds: ReadonlySet<string>,
): ProjectAgentDefinition {
  const trimmed = name.trim()
  const displayName = sanitizeAgentTextDraft(trimmed, AGENT_NAME_MAX_LENGTH)
  const id = allocateAgentSlug(trimmed || displayName || provider, existingIds)
  return {
    id,
    provider: provider === 'cursor' ? 'cursor' : 'claude',
    permissionMode: 'auto',
    autoImproveContexts: true,
    emitResults: true,
    ...(displayName ? { name: displayName } : {}),
  }
}

/** Id de contexto de results ligado al slug del agente. */
export function agentResultContextIdForSlug(agentId: string): string {
  return `iaterminal:result:${normalizeAgentSlug(agentId, 'agent')}`
}

/** ¿Es el contexto results del propio agente? (no debe autoasignarse). */
export function isAgentOwnResultContext(
  agentId: string | undefined | null,
  contextId: string,
): boolean {
  const id = (agentId ?? '').trim()
  if (!id || !contextId.startsWith('iaterminal:result:')) return false
  return contextId === agentResultContextIdForSlug(id)
}

/**
 * Reescribe bindings pane→agente cuando cambia el slug del JSON en el repo.
 * Solo toca tabs con el mismo projectFolder.
 */
export function remapAgentBindingsInTabs<
  T extends {
    projectFolder?: string
    agentByPane?: Record<string, AgentPaneBinding>
  },
>(
  tabs: readonly T[],
  projectFolder: string,
  fromId: string,
  toId: string,
): T[] {
  const root = projectFolder.trim()
  const from = normalizeAgentSlug(fromId)
  const to = normalizeAgentSlug(toId)
  if (!root || !from || !to || from === to) return [...tabs]

  return tabs.map(tab => {
    if ((tab.projectFolder ?? '').trim() !== root) return tab
    const prev = tab.agentByPane
    if (!prev) return tab
    let changed = false
    const agentByPane: Record<string, AgentPaneBinding> = {}
    for (const [paneId, binding] of Object.entries(prev)) {
      if (binding.agentId === from) {
        agentByPane[paneId] = { ...binding, agentId: to }
        changed = true
      } else {
        agentByPane[paneId] = binding
      }
    }
    return changed ? { ...tab, agentByPane } : tab
  })
}

/** Sustituye contextIds de results al renombrar el slug del agente. */
export function remapAgentResultContextIds(
  contextIds: readonly string[] | undefined,
  fromId: string,
  toId: string,
): string[] | undefined {
  if (!contextIds?.length) return contextIds ? [...contextIds] : undefined
  const fromCtx = agentResultContextIdForSlug(fromId)
  const toCtx = agentResultContextIdForSlug(toId)
  if (fromCtx === toCtx) return [...contextIds]
  const seen = new Set<string>()
  const next: string[] = []
  for (const id of contextIds) {
    const mapped = id === fromCtx ? toCtx : id
    if (seen.has(mapped)) continue
    seen.add(mapped)
    next.push(mapped)
  }
  return next
}

/** Remapea assignments de results en todo el catálogo al cambiar un slug. */
export function remapAgentResultIdsInCatalog(
  agents: readonly ProjectAgentDefinition[],
  fromId: string,
  toId: string,
): ProjectAgentDefinition[] {
  const from = normalizeAgentSlug(fromId)
  const to = normalizeAgentSlug(toId)
  if (!from || !to || from === to) return [...agents]
  return agents.map(agent => {
    const remapped = remapAgentResultContextIds(agent.contextIds, from, to)
    if (!remapped) return agent
    const prev = agent.contextIds ?? []
    if (remapped.length === prev.length && remapped.every((id, i) => id === prev[i])) {
      return agent
    }
    const { contextIds: _prev, ...rest } = agent
    return {
      ...rest,
      ...(remapped.length ? { contextIds: remapped } : {}),
    }
  })
}

/** Actualiza entradas agentResult del catálogo UI al renombrar el slug. */
export function remapAgentResultTabContexts(
  contexts: readonly TabContext[],
  fromId: string,
  toId: string,
): TabContext[] {
  const from = normalizeAgentSlug(fromId)
  const to = normalizeAgentSlug(toId)
  if (!from || !to || from === to) return [...contexts]
  const fromCtx = agentResultContextIdForSlug(from)
  const toCtx = agentResultContextIdForSlug(to)
  const fromFile = `results/${from}.md`
  const toFile = `results/${to}.md`
  return contexts.map(context => {
    if (context.kind !== 'agentResult') return context
    const match = context.id === fromCtx || context.fileName === fromFile
    if (!match) return context
    return {
      ...context,
      id: toCtx,
      fileName: toFile,
    }
  })
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
    ).filter(id => !isAgentOwnResultContext(def.id, id))
    if (contextIds.length) def.contextIds = contextIds
  }
  if (data.autoImproveContexts === true) def.autoImproveContexts = true
  def.emitResults = true
  const coordination = sanitizeAgentCoordination(data.coordination)
  if (coordination === 'orchestrator' || coordination === 'productOwner') {
    def.coordination = coordination
    const maxRounds = sanitizeOrchestrationMaxRounds(data.orchestrationMaxRounds)
    if (maxRounds !== MAX_ORCHESTRATION_ROUNDS) def.orchestrationMaxRounds = maxRounds
    if (data.delegateTo !== undefined) {
      const delegateTo = persistableDelegateTo(coordination, data.delegateTo)
      if (delegateTo) def.delegateTo = delegateTo
    }
  }
  if (data.acceptDelegations === false) def.acceptDelegations = false
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
    emitResults: true,
    ...(source.coordination === 'orchestrator' || source.coordination === 'productOwner'
      ? { coordination: source.coordination }
      : {}),
    ...(source.acceptDelegations === false ? { acceptDelegations: false } : {}),
    ...((source.coordination === 'orchestrator' || source.coordination === 'productOwner')
      && typeof source.orchestrationMaxRounds === 'number'
      && source.orchestrationMaxRounds !== MAX_ORCHESTRATION_ROUNDS
      ? { orchestrationMaxRounds: sanitizeOrchestrationMaxRounds(source.orchestrationMaxRounds) }
      : {}),
    ...(() => {
      const delegateTo = persistableDelegateTo(source.coordination, source.delegateTo)
      return delegateTo ? { delegateTo } : {}
    })(),
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
export function resolveCatalogAgentId(
  agents: readonly ProjectAgentDefinition[],
  rawId: string | null | undefined,
): string {
  const normalized = normalizeAgentSlug(rawId, 'agent')
  if (!normalized) return 'agent'
  if (agents.some(agent => normalizeAgentSlug(agent.id) === normalized)) {
    return normalized
  }
  const byName = agents.filter(agent => {
    const name = (agent.name ?? '').trim()
    if (!name) return false
    const nameSlug = normalizeContextFileName(name, 'agent').replace(/\.md$/i, '')
    return normalizeAgentSlug(nameSlug) === normalized
  })
  if (byName.length === 1) return normalizeAgentSlug(byName[0].id, 'agent')
  return normalized
}

/** Une catálogo + binding local para la UI del pane. */
export function resolveAgentPaneMeta(
  binding: AgentPaneBinding,
  definition: ProjectAgentDefinition | undefined,
  catalog: readonly ProjectAgentDefinition[] = [],
): AgentPaneMeta {
  const resolvedId = definition?.id
    ?? (catalog.length ? resolveCatalogAgentId(catalog, binding.agentId) : binding.agentId)
  const resolvedDefinition = definition
    ?? catalog.find(agent => agent.id === resolvedId)
  const base: ProjectAgentDefinition = resolvedDefinition && resolvedDefinition.id === resolvedId
    ? resolvedDefinition
    : {
        id: resolvedId,
        provider: 'claude',
        permissionMode: 'ask',
      }
  return {
    ...base,
    id: resolvedId,
    emitResults: true,
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
    rules: normalizeAgentRules(meta.rules),
    model: meta.model,
    contextIds: meta.contextIds,
    autoImproveContexts: meta.autoImproveContexts,
    emitResults: true,
    coordination: meta.coordination,
    acceptDelegations: meta.acceptDelegations,
    orchestrationMaxRounds: meta.orchestrationMaxRounds,
    delegateTo: meta.delegateTo,
  }, meta.id) ?? {
    id: normalizeAgentSlug(meta.id, 'agent'),
    provider: meta.provider === 'cursor' ? 'cursor' : 'claude',
    permissionMode: meta.permissionMode === 'auto'
      ? 'auto'
      : meta.permissionMode === 'plan'
        ? 'plan'
        : 'ask',
    emitResults: true,
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
 * Normaliza session: conserva bindings slim; descarta rich meta legacy sin escribir JSON.
 * `writes` siempre [] — agentes solo viven en `.iaterminal/agents`.
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
    const rawPaneIds = Array.isArray(tab.paneIds) ? tab.paneIds : []
    let projectFolder =
      typeof tab.projectFolder === 'string' && tab.projectFolder.trim()
        ? tab.projectFolder.trim()
        : ''
    if (!projectFolder) {
      const terminalIds = rawPaneIds.filter(id => tab.paneKinds?.[id] !== 'agent')
      const ordered = [
        ...terminalIds,
        ...rawPaneIds.filter(id => !terminalIds.includes(id)),
      ]
      projectFolder = ordered.map(id => cwds[id]?.trim() || '').find(Boolean) || ''
    }

    const agentByPane: Record<string, AgentPaneBinding> = {}
    const paneKinds: Record<string, string> = { ...(tab.paneKinds ?? {}) }
    const droppedAgentPanes = new Set<string>()
    let tabChanged = false

    for (const paneId of rawPaneIds) {
      if (tab.paneKinds?.[paneId] !== 'agent') continue
      const raw = tab.agentByPane?.[paneId]
      const binding = parseAgentPaneBinding(raw)
      if (binding) {
        agentByPane[paneId] = binding
        continue
      }
      // Rich meta o inválido: strip pane (no inventar agentId, no escribir definición).
      droppedAgentPanes.add(paneId)
      delete paneKinds[paneId]
      tabChanged = true
      changed = true
    }

    const paneIds = rawPaneIds.filter(id => !droppedAgentPanes.has(id))
    if (droppedAgentPanes.size > 0) tabChanged = true

    if (!tabChanged && Object.keys(agentByPane).length === 0) return tab
    if (!tabChanged) {
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
      paneIds,
      ...(projectFolder ? { projectFolder } : {}),
      ...(Object.keys(paneKinds).length ? { paneKinds } : { paneKinds: undefined }),
      ...(Object.keys(agentByPane).length ? { agentByPane } : { agentByPane: undefined }),
    }
  })

  return { tabs: nextTabs, writes, changed }
}
