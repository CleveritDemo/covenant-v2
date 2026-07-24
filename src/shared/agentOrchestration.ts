/** Coordinación multi-agente (orquestador → especialistas). */

export type AgentCoordination = 'none' | 'orchestrator'

export const MAX_DELEGATIONS_PER_TURN = 5
/** Oleadas de delegación por pedido del usuario (host corta el ciclo). */
export const MAX_ORCHESTRATION_ROUNDS = 3
export const DELEGATE_OBJECTIVE_MAX_LENGTH = 2000

export interface OrchestrationAgentRef {
  agentId: string
  paneId: string
  name: string
  role?: string
}

export interface DelegateRequest {
  id: string
  toAgentId: string
  objective: string
  contextIds?: string[]
}

export type DelegateResultStatus = 'ok' | 'fail' | 'aborted'

export interface DelegateResult {
  id: string
  status: DelegateResultStatus
  summary: string
  resultContextId?: string
  toAgentId?: string
  toPaneId?: string
}

export function sanitizeAgentCoordination(raw: unknown): AgentCoordination {
  return raw === 'orchestrator' ? 'orchestrator' : 'none'
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
  const id =
    typeof data.id === 'string' && data.id.trim()
      ? data.id.trim().slice(0, 64)
      : newDelegateId()
  const contextIds = sanitizeContextIds(data.contextIds)
  return {
    id,
    toAgentId,
    objective,
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
export function buildOrchestratorAgentsBlock(agents: readonly OrchestrationAgentRef[]): string {
  if (!agents.length) {
    return [
      '## Available agents',
      'No specialist agents are available to receive delegations right now.',
    ].join('\n')
  }
  const lines = [
    '## Available agents',
    'Delegate work to these specialists by agentId. Do not implement their work yourself.',
  ]
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
  options?: { round?: number; maxRounds?: number; batchRemaining?: number },
): string {
  const lines = [
    '## Delegation result',
    `id: ${result.id}`,
    `status: ${result.status}`,
    `summary: ${result.summary.trim() || '(empty)'}`,
  ]
  if (result.toAgentId) lines.push(`toAgentId: ${result.toAgentId}`)
  if (result.resultContextId) lines.push(`resultContextId: ${result.resultContextId}`)
  const round = options?.round
  const maxRounds = options?.maxRounds ?? MAX_ORCHESTRATION_ROUNDS
  if (typeof round === 'number') {
    lines.push(`orchestrationRound: ${round}/${maxRounds}`)
  }
  const remaining = options?.batchRemaining
  if (typeof remaining === 'number' && remaining > 0) {
    lines.push(`pendingInBatch: ${remaining}`)
    lines.push('', 'Wait for the remaining specialist results before deciding next steps.')
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
