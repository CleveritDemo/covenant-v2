/** Coordinación multi-agente (orquestador / product owner → especialistas). */

export type AgentCoordination = 'none' | 'orchestrator' | 'productOwner'

/** Solo orchestrator. Omitido / 'linear' = espera ola; turbo = jobs humanos en paralelo. */
export type OrchestrationWorkStyle = 'linear' | 'turbo'

export const MAX_DELEGATIONS_PER_TURN = 5
/** Oleadas de delegación por pedido del usuario (default / omitido en catálogo). */
export const MAX_ORCHESTRATION_ROUNDS = 3
/** Tope configurable en UI/catálogo. */
export const ORCHESTRATION_MAX_ROUNDS_CAP = 10
/** Sentinel: sin tope de oleadas (persistir como orchestrationMaxRounds: 0). */
export const ORCHESTRATION_UNLIMITED_ROUNDS = 0
export const DELEGATE_OBJECTIVE_MAX_LENGTH = 4000

export function isOrchestrationRoundsUnlimited(n: number): boolean {
  return n === ORCHESTRATION_UNLIMITED_ROUNDS
}

/** Tras completar `round`: ¿ya no se permiten más delegaciones? */
export function orchestrationRoundsAtCap(round: number, maxRounds: number): boolean {
  if (isOrchestrationRoundsUnlimited(maxRounds)) return false
  return round >= maxRounds
}

export function formatOrchestrationRoundLabel(round: number, maxRounds: number): string {
  if (isOrchestrationRoundsUnlimited(maxRounds)) return `${round}/∞`
  return `${round}/${maxRounds}`
}

export function sanitizeOrchestrationMaxRounds(raw: unknown): number {
  const n = typeof raw === 'number'
    ? raw
    : typeof raw === 'string' && raw.trim()
      ? Number(raw)
      : NaN
  if (!Number.isFinite(n)) return MAX_ORCHESTRATION_ROUNDS
  const int = Math.trunc(n)
  if (int === ORCHESTRATION_UNLIMITED_ROUNDS) return ORCHESTRATION_UNLIMITED_ROUNDS
  if (int < 1) return MAX_ORCHESTRATION_ROUNDS
  return Math.min(ORCHESTRATION_MAX_ROUNDS_CAP, int)
}

export function resolveOrchestrationMaxRounds(value?: number): number {
  return sanitizeOrchestrationMaxRounds(value)
}

/** Solo orquestador; cualquier otro valor → linear (omitido en disco). */
export function sanitizeOrchestrationWorkStyle(raw: unknown): OrchestrationWorkStyle {
  return raw === 'turbo' ? 'turbo' : 'linear'
}

/**
 * Efectivo: turbo solo si coordination === orchestrator y raw === 'turbo'.
 * Overload de 1 arg: trata el valor como raw (compat host/helpers).
 */
export function resolveOrchestrationWorkStyle(
  coordinationOrRaw?: AgentCoordination | OrchestrationWorkStyle | string | null,
  raw?: unknown,
): OrchestrationWorkStyle {
  if (arguments.length >= 2) {
    if (coordinationOrRaw !== 'orchestrator') return 'linear'
    return sanitizeOrchestrationWorkStyle(raw)
  }
  return sanitizeOrchestrationWorkStyle(coordinationOrRaw)
}

/**
 * Linear: abort/cleanup al empezar un turno humano (la ola ya cerró; awaiting bloquea).
 * Turbo: false — jobs previos siguen vivos en paralelo.
 */
export function shouldAbortOnHumanTurn(workStyle?: OrchestrationWorkStyle): boolean {
  return resolveOrchestrationWorkStyle(workStyle) !== 'turbo'
}

export interface OrchestrationAgentRef {
  agentId: string
  paneId: string
  name: string
  role?: string
}

export interface DelegateRequest {
  /** Host-generated delegation id; never taken from the model payload. */
  id: string
  toAgentId: string
  objective: string
  /**
   * Optional model-supplied id from the fence payload (sanitized). Used only so
   * the coordinator recognizes its own delegation in follow-ups — not for routing.
   */
  ref?: string
  contextIds?: string[]
  /**
   * Runtime linkage: cuando un orquestador anidado emite delegaciones dentro
   * de un turno delegado por otro (PO → Orq → Especialista), este campo
   * apunta al delegationId activo del padre. El fence del CLI NO lo emite:
   * lo anota AgentPane al despachar, para que App enlace la delegación
   * anidada con la delegación padre en el registry.
   */
  parentDelegationId?: string
}

export type DelegateResultStatus = 'ok' | 'fail' | 'aborted'

export interface DelegateResult {
  id: string
  status: DelegateResultStatus
  summary: string
  /** Orquestador que emitió la delegación (dirección de retorno). */
  fromPaneId: string
  /** Job de orquestación que originó la delegación. */
  orchestrationJobId: string
  resultContextId?: string
  toAgentId?: string
  toPaneId?: string
  toThreadId?: string
  /** Model ref from the original DelegateRequest, if any. */
  ref?: string
}

/** A quién puede delegar un coordinador (portable vía catálogo / meta). */
export interface DelegateToPolicy {
  /** agentIds exactos (case-insensitive). '*' = cualquier especialista (!canDelegate) */
  agentIds?: string[]
  /** panes cuyo coordination esté en esta lista */
  coordinations?: AgentCoordination[]
  /** Ids excluidos tras el match de grupos (case-insensitive). */
  excludeAgentIds?: string[]
}

export function sanitizeAgentCoordination(raw: unknown): AgentCoordination {
  if (raw === 'orchestrator') return 'orchestrator'
  if (raw === 'productOwner') return 'productOwner'
  return 'none'
}

export function isOrchestrator(coordination?: AgentCoordination | null): boolean {
  return coordination === 'orchestrator'
}

export function isProductOwner(coordination?: AgentCoordination | null): boolean {
  return coordination === 'productOwner'
}

/** Orquestador o product owner: pueden emitir fences de delegación. */
export function coordinationCanDelegate(coordination?: AgentCoordination | null): boolean {
  return isOrchestrator(coordination) || isProductOwner(coordination)
}

export function defaultDelegateToPolicy(
  coordination?: AgentCoordination | null,
): DelegateToPolicy {
  if (coordination === 'orchestrator') return { agentIds: ['*'] }
  if (coordination === 'productOwner') {
    return { coordinations: ['orchestrator'] }
  }
  return {}
}

function parseCoordinationList(raw: unknown): AgentCoordination[] {
  if (!Array.isArray(raw)) return []
  const out: AgentCoordination[] = []
  for (const item of raw) {
    if (item === 'none' || item === 'orchestrator' || item === 'productOwner') {
      if (!out.includes(item)) out.push(item)
    }
  }
  return out
}

function parseAgentIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string' || !item.trim()) continue
    const trimmed = item.trim()
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
    if (out.length >= 64) break
  }
  return out
}

/** Normaliza policy cruda; undefined solo si el valor está ausente. */
export function sanitizeDelegateToPolicy(raw: unknown): DelegateToPolicy | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw !== 'object') return undefined
  const data = raw as Record<string, unknown>
  const agentIds = parseAgentIdList(data.agentIds)
  const excludeAgentIds = parseAgentIdList(data.excludeAgentIds).filter(id => id !== '*')
  const coordinations = parseCoordinationList(data.coordinations)
  return {
    ...(agentIds.length ? { agentIds } : {}),
    ...(coordinations.length ? { coordinations } : {}),
    ...(excludeAgentIds.length ? { excludeAgentIds } : {}),
  }
}

function normalizePolicyForCompare(policy: DelegateToPolicy): string {
  const agentIds = [...(policy.agentIds ?? [])]
    .map(id => id.trim().toLowerCase())
    .filter(Boolean)
    .sort()
  const coordinations = [...(policy.coordinations ?? [])].slice().sort()
  const excludeAgentIds = [...(policy.excludeAgentIds ?? [])]
    .map(id => id.trim().toLowerCase())
    .filter(Boolean)
    .sort()
  return JSON.stringify({ agentIds, coordinations, excludeAgentIds })
}

export function delegateToPoliciesEqual(
  a?: DelegateToPolicy | null,
  b?: DelegateToPolicy | null,
): boolean {
  const left = a === undefined || a === null ? {} : (sanitizeDelegateToPolicy(a) ?? {})
  const right = b === undefined || b === null ? {} : (sanitizeDelegateToPolicy(b) ?? {})
  return normalizePolicyForCompare(left) === normalizePolicyForCompare(right)
}

/** Policy efectiva: override explícito (puede ser vacío) o default del rol.
 * Product owner: siempre solo orquestadores (ignora override).
 */
export function resolveDelegateToPolicy(
  coordination?: AgentCoordination | null,
  override?: DelegateToPolicy | null,
): DelegateToPolicy {
  if (coordination === 'productOwner') {
    return defaultDelegateToPolicy('productOwner')
  }
  if (override !== undefined && override !== null) {
    return sanitizeDelegateToPolicy(override) ?? {}
  }
  return defaultDelegateToPolicy(coordination)
}

/** Para persistir: omite si equals default del coordination.
 * Product owner: nunca persiste override (regla fija).
 */
export function persistableDelegateTo(
  coordination?: AgentCoordination | null,
  policy?: DelegateToPolicy | null,
): DelegateToPolicy | undefined {
  if (coordination === 'productOwner') return undefined
  if (policy === undefined || policy === null) return undefined
  const sanitized = sanitizeDelegateToPolicy(policy) ?? {}
  if (delegateToPoliciesEqual(sanitized, defaultDelegateToPolicy(coordination))) {
    return undefined
  }
  if (
    !sanitized.agentIds?.length
    && !sanitized.coordinations?.length
    && !sanitized.excludeAgentIds?.length
  ) {
    return { agentIds: [] }
  }
  return sanitized
}

/** Pane mínimo para resolver destinos de delegación. */
export interface DelegationTargetPane {
  paneId: string
  meta: {
    id: string
    name?: string
    role?: string
    coordination?: AgentCoordination
    acceptDelegations?: boolean
    delegateTo?: DelegateToPolicy
  }
}

export type ProductOwnerTargetPane = DelegationTargetPane

export interface DelegationSourceMeta {
  id?: string
  coordination?: AgentCoordination
  delegateTo?: DelegateToPolicy
}

/**
 * Match de grupos (sin exclusiones):
 * ('*' y !canDelegate) OR id en agentIds OR coordination en list.
 */
export function agentMatchesDelegateGroups(
  agent: { id: string; coordination?: AgentCoordination | null },
  policy: DelegateToPolicy,
): boolean {
  const agentIds = policy.agentIds ?? []
  const coordinations = policy.coordinations ?? []
  const hasStar = agentIds.some(id => id === '*')
  const wantedIds = new Set(
    agentIds.filter(id => id !== '*').map(id => id.trim().toLowerCase()).filter(Boolean),
  )
  const idLower = agent.id.trim().toLowerCase()
  const paneCoord = agent.coordination ?? 'none'
  return (
    (hasStar && !coordinationCanDelegate(agent.coordination))
    || wantedIds.has(idLower)
    || coordinations.includes(paneCoord)
  )
}

function paneMatchesPolicy(
  pane: DelegationTargetPane,
  policy: DelegateToPolicy,
): boolean {
  if (!agentMatchesDelegateGroups(pane.meta, policy)) return false
  const excluded = new Set(
    (policy.excludeAgentIds ?? []).map(id => id.trim().toLowerCase()).filter(Boolean),
  )
  return !excluded.has(pane.meta.id.trim().toLowerCase())
}

/**
 * Destinos legales según policy del emisor.
 * Base: skip self; skip acceptDelegations===false.
 */
export function listDelegationTargets(
  panes: readonly DelegationTargetPane[],
  fromMeta: DelegationSourceMeta,
  exceptPaneId?: string,
): OrchestrationAgentRef[] {
  const policy = resolveDelegateToPolicy(fromMeta.coordination, fromMeta.delegateTo)
  const out: OrchestrationAgentRef[] = []
  for (const pane of panes) {
    if (exceptPaneId && pane.paneId === exceptPaneId) continue
    if (pane.meta.acceptDelegations === false) continue
    if (!paneMatchesPolicy(pane, policy)) continue
    out.push({
      agentId: pane.meta.id,
      paneId: pane.paneId,
      name: pane.meta.name?.trim() || pane.meta.id,
      ...(pane.meta.role?.trim() ? { role: pane.meta.role.trim() } : {}),
    })
  }
  return out
}

/** Compat: especialistas vía default de orchestrator (`agentIds: ['*']`). */
export function listOrchestrationTargets(
  panes: readonly DelegationTargetPane[],
  exceptPaneId?: string,
): OrchestrationAgentRef[] {
  return listDelegationTargets(panes, { coordination: 'orchestrator' }, exceptPaneId)
}

/**
 * Compat: destinos default del PO (solo orquestadores).
 */
export function listProductOwnerTargets(
  panes: readonly DelegationTargetPane[],
  exceptPaneId?: string,
): OrchestrationAgentRef[] {
  return listDelegationTargets(panes, { coordination: 'productOwner' }, exceptPaneId)
}

function newDelegateId(): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return uuid
  return `dlg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function sanitizeObjective(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const text = raw.trim().slice(0, DELEGATE_OBJECTIVE_MAX_LENGTH)
  return text || null
}

function sanitizeContextIds(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const ids = raw
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map(item => item.trim())
    .slice(0, 32)
  return ids.length ? ids : undefined
}

function sanitizeDelegateRef(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined
  return raw.trim().slice(0, 64)
}

/** Normaliza un item crudo del fence a DelegateRequest. */
export function sanitizeDelegateRequest(raw: unknown): DelegateRequest | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  const toAgentId =
    typeof data.toAgentId === 'string' && data.toAgentId.trim()
      ? data.toAgentId.trim()
      : typeof data.agentId === 'string' && data.agentId.trim()
        ? data.agentId.trim()
        : ''
  const objective = sanitizeObjective(data.objective ?? data.prompt ?? data.task)
  if (!toAgentId || !objective) return null
  const ref = sanitizeDelegateRef(data.id)
  const id = newDelegateId()
  const contextIds = sanitizeContextIds(data.contextIds)
  return {
    id,
    toAgentId,
    objective,
    ...(ref ? { ref } : {}),
    ...(contextIds ? { contextIds } : {}),
  }
}

/** Parsea delegaciones desde JSON del fence (objeto con delegations[] o array). */
export function parseDelegatePayload(raw: unknown): DelegateRequest[] {
  if (Array.isArray(raw)) {
    return raw
      .map(sanitizeDelegateRequest)
      .filter((item): item is DelegateRequest => item !== null)
      .slice(0, MAX_DELEGATIONS_PER_TURN)
  }
  if (!raw || typeof raw !== 'object') return []
  const data = raw as Record<string, unknown>
  const list = Array.isArray(data.delegations)
    ? data.delegations
    : Array.isArray(data.tasks)
      ? data.tasks
      : null
  if (!list) {
    const single = sanitizeDelegateRequest(raw)
    return single ? [single] : []
  }
  return list
    .map(sanitizeDelegateRequest)
    .filter((item): item is DelegateRequest => item !== null)
    .slice(0, MAX_DELEGATIONS_PER_TURN)
}

/** Bloque de agentes disponibles para el prompt del orquestador. */
export function buildOrchestratorAgentsBlock(
  agents: readonly OrchestrationAgentRef[],
  options?: { allowParallelLanes?: boolean },
): string {
  if (!agents.length) {
    return [
      '## Available agents',
      'No specialist agents are available to receive delegations right now.',
    ].join('\n')
  }
  const lines = [
    '## Available agents',
    'Delegate work to these specialists by agentId. Do not implement their work yourself.',
    'Each specialist runs in an isolated git worktree; the host merges their branches into the base branch when you integrate results (you do not merge yourself).',
  ]
  if (options?.allowParallelLanes !== false) {
    lines.push(
      'Parallel lanes: you may emit several parallel delegations to the same specialist role.',
      'The host opens a separate conversation lane within that expert pane for each delegation (up to 3 active at once; extras wait in queue).',
      'agentId#2 / agentId-2 are accepted aliases for another lane of the same expert — not a new agentId.',
    )
  }
  for (const agent of agents) {
    const role = agent.role?.trim()
    lines.push(
      role
        ? `- ${agent.name} (agentId: ${agent.agentId}) — ${role}`
        : `- ${agent.name} (agentId: ${agent.agentId})`,
    )
  }
  return lines.join('\n')
}

/** Mensaje de seguimiento al orquestador cuando termina una delegación. */
export function formatDelegationResultFollowUp(
  result: DelegateResult,
  options?: {
    round?: number
    maxRounds?: number
    batchRemaining?: number
    /** PO autónomo: tras PASS, seguir con el siguiente slice sin preguntar. */
    continuousProductOwner?: boolean
    /** Turbo: hilo/job al que pertenece este resultado. */
    orchestrationJobId?: string
    workStyle?: OrchestrationWorkStyle
  },
): string {
  const idLine = result.ref?.trim()
    ? `id: ${result.id} (ref: ${result.ref.trim()})`
    : `id: ${result.id}`
  const lines = [
    '## Delegation result',
    idLine,
    `status: ${result.status}`,
    `summary: ${result.summary.trim() || '(empty)'}`,
  ]
  if (result.toAgentId) lines.push(`toAgentId: ${result.toAgentId}`)
  if (result.resultContextId) lines.push(`resultContextId: ${result.resultContextId}`)
  const jobId = result.orchestrationJobId?.trim() || options?.orchestrationJobId?.trim()
  if (jobId) {
    lines.push(`orchestrationJobId: ${jobId}`)
  }
  if (result.status === 'fail' || result.status === 'aborted') {
    lines.push(
      '',
      '## Delegation failed',
      'This delegation did not produce a usable result (specialist runtime error or aborted turn), which is NOT the same as a task that reported a negative finding.',
      'Do NOT re-emit the same delegation automatically. Re-delegating the identical objective will hit the same failure.',
      'Report the failure to the user, name the specialist and the reason from the summary, and stop unless the user asks to retry.',
    )
  }
  const round = options?.round
  const maxRounds = options?.maxRounds ?? MAX_ORCHESTRATION_ROUNDS
  const unlimited = isOrchestrationRoundsUnlimited(maxRounds)
  if (typeof round === 'number') {
    const roundScope = resolveOrchestrationWorkStyle(options?.workStyle) === 'turbo'
      ? ' (per job/user message)'
      : ''
    lines.push(
      `orchestrationRound: ${formatOrchestrationRoundLabel(round, maxRounds)}${roundScope}`,
    )
  }
  const remaining = options?.batchRemaining
  if (typeof remaining === 'number' && remaining > 0) {
    lines.push(`pendingInBatch: ${remaining}`)
    lines.push('', 'Wait for the remaining specialist results before deciding next steps.')
  } else if (options?.continuousProductOwner) {
    if (unlimited) {
      lines.push(
        '',
        'If the slice PASSED, choose the next slice toward the user request and emit ia-terminal-delegate; do not ask the user.',
        'There is no host wave cap for this coordinator (unlimited).',
      )
    } else {
      lines.push(
        '',
        'If the slice PASSED, choose the next slice toward the user request and emit ia-terminal-delegate; do not ask the user; stop only if round>=maxRounds.',
        `At most ${maxRounds} delegation waves are allowed per user request (host-enforced).`,
      )
    }
  } else if (unlimited) {
    lines.push(
      '',
      'Stop condition: if the user goal is satisfied, reply to the user now with a clear outcome.',
      'Do NOT emit ```ia-terminal-delegate``` unless a specialist is still strictly required.',
      'There is no host wave cap for this coordinator (unlimited); prefer finishing over re-delegating.',
    )
  } else {
    lines.push(
      '',
      'Stop condition: if the user goal is satisfied, reply to the user now with a clear outcome.',
      'Do NOT emit ```ia-terminal-delegate``` unless a specialist is still strictly required.',
      `At most ${maxRounds} delegation waves are allowed per user request; prefer finishing over re-delegating.`,
    )
  }
  return lines.join('\n')
}

/**
 * Un solo follow-up al orquestador cuando el batch de especialistas ya terminó.
 * Concatena un formatDelegationResultFollowUp por resultado (batchRemaining: 0);
 * continuousProductOwner solo en el último bloque.
 */
export function buildBatchedDelegationFollowUp(
  results: readonly DelegateResult[],
  options?: {
    round?: number
    maxRounds?: number
    continuousProductOwner?: boolean
    orchestrationJobId?: string
    workStyle?: OrchestrationWorkStyle
  },
): string {
  if (results.length === 0) return ''
  const last = results.length - 1
  const body = results
    .map((result, index) => formatDelegationResultFollowUp(result, {
      round: options?.round,
      maxRounds: options?.maxRounds,
      batchRemaining: 0,
      continuousProductOwner:
        options?.continuousProductOwner === true && index === last,
      orchestrationJobId: options?.orchestrationJobId,
      workStyle: options?.workStyle,
    }))
    .join('\n\n')
  if (resolveOrchestrationWorkStyle(options?.workStyle) !== 'turbo') return body
  const jobLine = options?.orchestrationJobId?.trim()
    ? `These results belong to job ${options.orchestrationJobId.trim()} only.`
    : 'These results belong to one concurrent job only.'
  return [
    body,
    '',
    '## Concurrent jobs (turbo)',
    jobLine,
    'Other jobs/waves may still be in flight; do not assume the repo or working tree is quiet.',
    'Integrate only this batch; do not cancel or rewrite unrelated parallel jobs.',
  ].join('\n')
}

/**
 * Instrucciones extra del modo turbo (hilos/jobs concurrentes entre mensajes humanos).
 * Vacío en linear. Turbo asume carriles paralelos por conversación cuando el pane está ocupado.
 */
export function buildOrchestratorTurboWorkStyleBlock(options?: {
  jobId?: string
  maxRounds?: number
}): string {
  const maxRounds = options?.maxRounds ?? MAX_ORCHESTRATION_ROUNDS
  const unlimited = isOrchestrationRoundsUnlimited(maxRounds)
  const waveCap = unlimited
    ? 'There is no host wave cap per job (unlimited).'
    : `Delegation wave cap is per job/user message (at most ${maxRounds} waves), not global across the pane.`
  const jobLine = options?.jobId?.trim()
    ? `Current job id: ${options.jobId.trim()}. Treat each human message as its own job/thread.`
    : 'Treat each human message as its own job/thread; follow-ups name the job they belong to.'
  return [
    '## Work style: turbo',
    'The host keeps a single CLI on this pane but runs specialist waves from multiple jobs in parallel.',
    jobLine,
    'New user messages may arrive without waiting for prior specialist waves to finish; do not assume previous jobs were aborted.',
    'When a role is busy, emit another parallel delegation with the same agentId or agentId#2 / agentId-2; the host queues overflow beyond three active lanes per expert pane.',
    'Do not assume the git working tree is stable between messages — other jobs may still be merging.',
    waveCap,
  ].join('\n')
}

/** Host: despertar al orquestador solo cuando no quedan especialistas en la oleada. */
export function shouldWakeOrchestratorOnDelegationComplete(pendingRemaining: number): boolean {
  return pendingRemaining <= 0
}

/** Compara jobId (trim; ausente = '') y text para no apilar el mismo follow-up. */
export function isDuplicateOrchestrationQueueItem(
  existing: { text: string; orchestrationJobId?: string },
  next: { text: string; orchestrationJobId?: string },
): boolean {
  return (existing.orchestrationJobId?.trim() ?? '') === (next.orchestrationJobId?.trim() ?? '')
    && existing.text === next.text
}

/**
 * Identidad de un follow-up ya despachado (job + texto). El dedupe de la cola
 * solo mira lo encolado; esta clave recuerda lo que ya se consumió, que es lo
 * que permitía reenviar la misma delegación en bucle.
 */
export function orchestrationFollowUpKey(
  item: { text: string; orchestrationJobId?: string },
): string {
  return `${item.orchestrationJobId?.trim() ?? ''} ${item.text}`
}

/** Host cortó el ciclo: el modelo debe responder al usuario sin más fences. */
export function formatDelegationRoundCapFollowUp(
  maxRounds = MAX_ORCHESTRATION_ROUNDS,
): string {
  return [
    '## Orchestration limit',
    `Delegation wave cap reached (${maxRounds}/${maxRounds}).`,
    'Do NOT emit ```ia-terminal-delegate```.',
    'Reply to the user now with the best outcome from the results you already have.',
    'If something is still incomplete, say what is missing and stop.',
  ].join('\n')
}
