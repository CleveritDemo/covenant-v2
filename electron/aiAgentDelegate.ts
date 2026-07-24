import {
  MAX_DELEGATIONS_PER_TURN,
  MAX_ORCHESTRATION_ROUNDS,
  parseDelegatePayload,
  type DelegateRequest,
} from '../src/shared/agentOrchestration'

const DELEGATE_FENCE_RE = /```ia-terminal-delegate\s*\n([\s\S]*?)\n```/g

export function extractAiAgentDelegates(text: string): {
  visibleText: string
  delegations: DelegateRequest[]
} {
  const collected: DelegateRequest[] = []
  const visibleText = text.replace(DELEGATE_FENCE_RE, (_match, json: string) => {
    try {
      const value = JSON.parse(json) as unknown
      for (const item of parseDelegatePayload(value)) {
        if (collected.length >= MAX_DELEGATIONS_PER_TURN) break
        if (collected.some(existing => existing.id === item.id)) continue
        collected.push(item)
      }
    } catch { /* bloque inválido: se oculta */ }
    return ''
  }).trimEnd()
  return { visibleText, delegations: collected }
}

export function buildAiAgentDelegateInstruction(options?: {
  allowDelegations?: boolean
  round?: number
  maxRounds?: number
}): string {
  const maxRounds = options?.maxRounds ?? MAX_ORCHESTRATION_ROUNDS
  const allow = options?.allowDelegations !== false
  if (!allow) {
    return [
      '## Agent orchestration',
      'You are an orchestrator, but further delegations are DISABLED for this turn.',
      'Do NOT emit ```ia-terminal-delegate```.',
      'Reply to the user with a final outcome based on specialist results you already have.',
    ].join('\n')
  }
  const roundLine = typeof options?.round === 'number'
    ? `Current delegation wave: ${options.round}/${maxRounds} (host-enforced).`
    : `At most ${maxRounds} delegation waves per user request (host-enforced).`
  return [
    '## Agent orchestration',
    'You are an orchestrator. Your job is to decompose work, delegate to specialists, integrate results, and report to the user.',
    'Do not implement large code changes yourself. Prefer delegating when a specialist fits the work.',
    'Trivial answers (clarifications, short factual replies) may be answered directly — without delegating.',
    roundLine,
    'Stop delegating when: the user goal is met, specialists already answered, or another wave would only repeat work.',
    'When the goal is met, reply to the user and do NOT emit a delegate fence.',
    'When you still need specialists, emit exactly one fenced JSON block (and keep user-facing text outside it):',
    '```ia-terminal-delegate',
    '{',
    '  "delegations": [',
    '    { "toAgentId": "qa", "objective": "Verify the login flow and report failures" }',
    '  ]',
    '}',
    '```',
    `Rules: use toAgentId from Available agents; objective must be concrete; max ${MAX_DELEGATIONS_PER_TURN} delegations per turn; optional contextIds array of context ids to prefer.`,
  ].join('\n')
}
