import {
  DELEGATE_OBJECTIVE_MAX_LENGTH,
  MAX_DELEGATIONS_PER_TURN,
  MAX_ORCHESTRATION_ROUNDS,
  formatOrchestrationRoundLabel,
  isOrchestrationRoundsUnlimited,
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

export function buildAiAgentDelegateInstruction(options?: {
  allowDelegations?: boolean
  round?: number
  maxRounds?: number
  allowedAgentIds?: readonly string[]
  allowExpertReplicas?: boolean
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
  const replicaLines = options?.allowExpertReplicas
    ? [
      'Parallel experts: you may delegate multiple slices to the same specialist role at once.',
      'Use the listed agentId repeatedly, or agentId#2 / agentId-2; the host clones busy experts into temporary replicas.',
    ]
    : []
  return [
    '## Agent orchestration',
    'You are an orchestrator. Your job is to decompose work, delegate to specialists, integrate results, and report to the user.',
    'Do not implement large code changes yourself. Prefer delegating when a specialist fits the work.',
    'Trivial answers (clarifications, short factual replies) may be answered directly — without delegating.',
    'Specialists work in dedicated git worktrees. When their turns complete, the host merges those branches into the base branch in order — you integrate outcomes in chat; you do not run git merge yourself.',
    formatAllowedAgentIdsLine(options?.allowedAgentIds),
    ...replicaLines,
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
    `Rules: use toAgentId only from Available agents; objective must be concrete (max ${DELEGATE_OBJECTIVE_MAX_LENGTH} chars); max ${MAX_DELEGATIONS_PER_TURN} delegations per turn; optional contextIds array of context ids to prefer.`,
  ].join('\n')
}

export function buildAiAgentProductOwnerInstruction(options?: {
  allowDelegations?: boolean
  round?: number
  maxRounds?: number
  allowedAgentIds?: readonly string[]
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
  const replicaLines = options?.allowExpertReplicas
    ? [
      'Parallel experts: you may delegate multiple slices to the same orchestrator/specialist role; the host clones busy experts into temporary replicas.',
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
    ...replicaLines,
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
    `Rules: use toAgentId only from Available agents; objective must be a concrete slice toward the user request (max ${DELEGATE_OBJECTIVE_MAX_LENGTH} chars); max ${MAX_DELEGATIONS_PER_TURN} delegations per turn; optional contextIds array of context ids to prefer.`,
  ].join('\n')
}
