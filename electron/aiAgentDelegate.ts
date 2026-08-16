import {
  DELEGATE_OBJECTIVE_MAX_LENGTH,
  MAX_ORCHESTRATION_ROUNDS,
  formatOrchestrationRoundLabel,
  isDelegationsUnlimited,
  isOrchestrationRoundsUnlimited,
  parseDelegatePayloadDetailed,
  sanitizeMaxDelegationsPerTurn,
  type DelegateParseIssue,
  type DelegateRequest,
} from '../src/shared/agentOrchestration'

const DELEGATE_FENCE_RE = /```ia-terminal-delegate\s*\n([\s\S]*?)\n```/g

export function extractAiAgentDelegates(
  text: string,
  maxDelegationsPerTurn?: number,
): {
  visibleText: string
  delegations: DelegateRequest[]
  issues: DelegateParseIssue[]
} {
  const cap = sanitizeMaxDelegationsPerTurn(maxDelegationsPerTurn)
  const collected: DelegateRequest[] = []
  const issues: DelegateParseIssue[] = []
  const visibleText = text.replace(DELEGATE_FENCE_RE, (_match, json: string) => {
    try {
      const value = JSON.parse(json) as unknown
      const parsed = parseDelegatePayloadDetailed(value, cap)
      issues.push(...parsed.issues)
      const beforeCount = collected.length
      for (const item of parsed.delegations) {
        if (!isDelegationsUnlimited(cap) && collected.length >= cap) break
        collected.push(item)
      }
      const restantes = parsed.delegations.length - (collected.length - beforeCount)
      if (restantes > 0) {
        issues.push({ reason: 'truncated', count: restantes, cap })
      }
    } catch (err) {
      issues.push({
        reason: 'invalid_json',
        detail: String((err as Error)?.message ?? '').slice(0, 160),
      })
    }
    return ''
  }).trimEnd()
  return { visibleText, delegations: collected, issues }
}

function formatAllowedAgentIdsLine(allowedAgentIds?: readonly string[]): string {
  const ids = (allowedAgentIds ?? []).map(id => id.trim()).filter(Boolean)
  if (!ids.length) {
    return 'No agents are available right now — do not emit a delegate fence.'
  }
  return `Allowed toAgentId values (from Available agents): ${ids.join(', ')}.`
}

function exampleAgentId(allowedAgentIds?: readonly string[]): string {
  const ids = (allowedAgentIds ?? []).map(id => id.trim()).filter(Boolean)
  return ids[0] || 'agent-id'
}

function orchestrationWaveCapLine(options?: {
  round?: number
  maxRounds?: number
}): string {
  const maxRounds = options?.maxRounds ?? MAX_ORCHESTRATION_ROUNDS
  const unlimited = isOrchestrationRoundsUnlimited(maxRounds)
  if (typeof options?.round === 'number') {
    const label = formatOrchestrationRoundLabel(options.round, maxRounds)
    return unlimited
      ? `Current delegation wave: ${label} (no host wave cap).`
      : `Current delegation wave: ${label} (host-enforced).`
  }
  return unlimited
    ? 'No host wave cap (unlimited delegation waves per user request).'
    : `At most ${maxRounds} delegation waves per user request (host-enforced).`
}

function delegationsPerTurnRuleLine(maxDelegationsPerTurn?: number): string {
  const cap = sanitizeMaxDelegationsPerTurn(maxDelegationsPerTurn)
  const capPhrase = isDelegationsUnlimited(cap)
    ? 'no per-turn delegation cap'
    : `max ${cap} delegations per turn`
  return `Rules: use toAgentId only from Available agents; objective must be concrete (max ${DELEGATE_OBJECTIVE_MAX_LENGTH} chars); ${capPhrase}; optional contextIds array of context ids to prefer.`
}

function productOwnerDelegationsPerTurnRuleLine(maxDelegationsPerTurn?: number): string {
  const cap = sanitizeMaxDelegationsPerTurn(maxDelegationsPerTurn)
  const capPhrase = isDelegationsUnlimited(cap)
    ? 'no per-turn delegation cap'
    : `max ${cap} delegations per turn`
  return `Rules: use toAgentId only from Available agents; objective must be a concrete slice toward the user request (max ${DELEGATE_OBJECTIVE_MAX_LENGTH} chars); ${capPhrase}; optional contextIds array of context ids to prefer.`
}

export function buildAiAgentDelegateInstruction(options?: {
  allowDelegations?: boolean
  round?: number
  maxRounds?: number
  maxDelegationsPerTurn?: number
  allowedAgentIds?: readonly string[]
  allowParallelLanes?: boolean
  /** @deprecated */
  allowExpertReplicas?: boolean
  workStyle?: 'linear' | 'turbo'
  orchestrationJobId?: string
}): string {
  const allow = options?.allowDelegations !== false
  if (!allow) {
    return [
      '## Agent orchestration',
      'You are an orchestrator, but further delegations are DISABLED for this turn.',
      'Do NOT emit ```ia-terminal-delegate```.',
      'Reply to the user with a final outcome based on specialist results you already have.',
    ].join('\n')
  }
  const exampleId = exampleAgentId(options?.allowedAgentIds)
  const turbo = options?.workStyle === 'turbo'
  const allowParallelLanes = options?.allowParallelLanes !== false
    || options?.allowExpertReplicas === true
    || turbo
  const parallelLaneLines = allowParallelLanes
    ? [
      'Parallel lanes: you may delegate multiple slices to the same specialist role at once.',
      'Use the listed agentId repeatedly, or agentId#2 / agentId-2 for another lane of the same expert.',
    ]
    : []
  const turboLines = turbo
    ? [
      '## Work style: turbo',
      'A single CLI runs on this pane; specialist waves from multiple jobs may run in parallel.',
      options?.orchestrationJobId?.trim()
        ? `Current job id: ${options.orchestrationJobId.trim()}. Treat each human message as its own job/thread.`
        : 'Treat each human message as its own job/thread; follow-ups name the job they belong to.',
      'New user messages may arrive without aborting prior specialist waves.',
      'Do not assume the git working tree is quiet — other jobs may still be merging.',
      'Delegation wave caps apply per job/user message, not globally across the pane.',
    ]
    : []
  return [
    '## Agent orchestration',
    'You are an orchestrator. Your job is to decompose work, delegate to specialists, integrate results, and report to the user.',
    'Do not implement large code changes yourself. Prefer delegating when a specialist fits the work.',
    'Trivial answers (clarifications, short factual replies) may be answered directly — without delegating.',
    'Specialists work in dedicated git worktrees. When their turns complete, the host merges those branches into the base branch in order — you integrate outcomes in chat; you do not run git merge yourself.',
    formatAllowedAgentIdsLine(options?.allowedAgentIds),
    ...parallelLaneLines,
    ...turboLines,
    orchestrationWaveCapLine(options),
    'Stop delegating when: the user goal is met, specialists already answered, or another wave would only repeat work.',
    'When the goal is met, reply to the user and do NOT emit a delegate fence.',
    'When you still need specialists, emit exactly one fenced JSON block (and keep user-facing text outside it):',
    '```ia-terminal-delegate',
    '{',
    '  "delegations": [',
    `    { "toAgentId": "${exampleId}", "objective": "Verify login fails on bad password and report the failing assert." }`,
    '  ]',
    '}',
    '```',
    'Front-load the objective: first line is a one-sentence imperative the specialist can act on without reading the rest.',
    'Objective style: FIRST LINE = imperative TL;DR (verb + goal + expected result), self-contained; below that you may add long detail (files, numbered tasks, acceptance criteria) within the objective length cap.',
    delegationsPerTurnRuleLine(options?.maxDelegationsPerTurn),
  ].join('\n')
}

export function buildAiAgentProductOwnerInstruction(options?: {
  allowDelegations?: boolean
  round?: number
  maxRounds?: number
  maxDelegationsPerTurn?: number
  allowedAgentIds?: readonly string[]
  allowParallelLanes?: boolean
  /** @deprecated */
  allowExpertReplicas?: boolean
}): string {
  const maxRounds = options?.maxRounds ?? MAX_ORCHESTRATION_ROUNDS
  const unlimited = isOrchestrationRoundsUnlimited(maxRounds)
  const allow = options?.allowDelegations !== false
  if (!allow) {
    return [
      '## Product owner coordination',
      'You are the product owner, but further delegations are DISABLED for this turn.',
      'Do NOT emit ```ia-terminal-delegate```.',
      'Reply to the user with a final outcome based on results you already have (PASS/FAIL, slices shipped).',
    ].join('\n')
  }
  const exampleId = exampleAgentId(options?.allowedAgentIds)
  const stopLine = unlimited
    ? 'Stop ONLY when the user request is satisfied or no remaining work exists in that scope (no host wave cap).'
    : 'Stop ONLY when: the wave cap is reached (host-enforced), or the user request is satisfied / no remaining work in that scope.'
  const continueLine = unlimited
    ? 'When work remains in the user request scope, emit exactly one fenced JSON block (user-facing text outside it):'
    : 'When work remains in the user request scope and waves remain, emit exactly one fenced JSON block (user-facing text outside it):'
  const parallelLaneLines = options?.allowParallelLanes !== false || options?.allowExpertReplicas
    ? [
      'Parallel lanes: you may delegate multiple slices to the same orchestrator/specialist role; the host opens separate conversation lanes per delegation.',
    ]
    : []
  return [
    '## Product owner coordination',
    'You are the product owner steering continuous delivery of the user\'s initial request.',
    'Prioritize and decompose the user\'s initial request (and attached contexts / agent results PASS/FAIL / changelog).',
    'Do not invent unrelated product features. You do NOT write code or implement UI.',
    'Delegate only to agents listed under Available agents (host-enforced). Prefer orchestrators for build work.',
    'Delegates run in isolated git worktrees; the host merges into the base branch when integrating results.',
    formatAllowedAgentIdsLine(options?.allowedAgentIds),
    ...parallelLaneLines,
    orchestrationWaveCapLine(options),
    'After a slice PASSes, immediately emit the next ```ia-terminal-delegate``` fence to the orchestrator for the next concrete slice toward the user request.',
    'FORBIDDEN: asking "should we continue?", "¿seguimos?", or requesting human priority/approval between slices.',
    stopLine,
    continueLine,
    '```ia-terminal-delegate',
    '{',
    '  "delegations": [',
    `    { "toAgentId": "${exampleId}", "objective": "Ship the next slice of the user request: …" }`,
    '  ]',
    '}',
    '```',
    'Front-load the objective: first line is a one-sentence imperative the specialist can act on without reading the rest.',
    'Objective style: FIRST LINE = imperative TL;DR (verb + goal + expected result), self-contained; below that you may add long detail (files, numbered tasks, acceptance criteria) within the objective length cap.',
    productOwnerDelegationsPerTurnRuleLine(options?.maxDelegationsPerTurn),
  ].join('\n')
}
