import {
  isAgentCliProvider,
  type AgentCliProvider,
  type AgentPermissionMode,
} from './agentCliProviders'

const RETRYABLE_OUTAGE = [
  '529',
  'overloaded',
  '503',
  '429',
  'rate_limit',
  'rate limit',
  'rate-limit',
  'too many requests',
]

/** pi / hermes / grok ignoran `mode === 'plan'` en sus args. */
const PLAN_UNMAPPED = new Set<AgentCliProvider>(['pi', 'hermes', 'grok'])

/** True si el stderr/mensaje es un outage clasificado (529/overloaded/503/429/rate limit). */
export function isRetryableHarnessOutage(text: string): boolean {
  const haystack = text.toLowerCase()
  return RETRYABLE_OUTAGE.some(token => haystack.includes(token))
}

/** Válido y distinto del primario; si no, undefined. */
export function sanitizeFallbackProvider(
  primary: AgentCliProvider,
  raw: unknown,
): AgentCliProvider | undefined {
  if (!isAgentCliProvider(raw) || raw === primary) return undefined
  return raw
}

export function providerMapsPlanMode(provider: AgentCliProvider): boolean {
  return !PLAN_UNMAPPED.has(provider)
}

export function shouldAttemptHarnessFallback(input: {
  primary: AgentCliProvider
  fallback: AgentCliProvider | undefined
  permissionMode: AgentPermissionMode
  alreadyAttempted: boolean
}): boolean {
  if (input.alreadyAttempted) return false
  if (!input.fallback || input.fallback === input.primary) return false
  if (input.permissionMode === 'plan' && !providerMapsPlanMode(input.fallback)) {
    return false
  }
  return true
}
