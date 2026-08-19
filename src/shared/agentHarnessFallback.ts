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
  'usage limit',
  'session limit',
  'hit your limit',
]

export interface ProviderPair {
  provider?: AgentCliProvider
  fallbackProvider?: AgentCliProvider
  model?: string
  fallbackModel?: string
}

function compactProviderPair(pair: ProviderPair): ProviderPair {
  return {
    ...(pair.provider ? { provider: pair.provider } : {}),
    ...(pair.fallbackProvider ? { fallbackProvider: pair.fallbackProvider } : {}),
    ...(pair.model?.trim() ? { model: pair.model.trim() } : {}),
    ...(pair.fallbackModel?.trim() ? { fallbackModel: pair.fallbackModel.trim() } : {}),
  }
}

/**
 * Clic en una card del grid de motores:
 * sin primario → esa card es primario;
 * con primario → card libre es respaldo;
 * clic en primario o respaldo los quita;
 * al quitar el primario, el respaldo (y su modelo) pasan a serlo.
 */
export function pickProviderChoice(
  current: ProviderPair,
  picked: AgentCliProvider,
): ProviderPair {
  if (picked === current.provider) {
    if (!current.fallbackProvider) return {}
    return compactProviderPair({
      provider: current.fallbackProvider,
      model: current.fallbackModel,
    })
  }
  if (picked === current.fallbackProvider) {
    return compactProviderPair({
      provider: current.provider,
      model: current.model,
    })
  }
  if (!current.provider) {
    return { provider: picked }
  }
  return compactProviderPair({
    ...current,
    fallbackProvider: picked,
    fallbackModel: undefined,
  })
}

/** pi / hermes / grok ignoran `mode === 'plan'` en sus args. */
const PLAN_UNMAPPED = new Set<AgentCliProvider>(['pi', 'hermes', 'grok'])

/**
 * Texto de un `result` de Claude con `is_error`. Undefined si no es ese caso.
 * El runtime lo usa para no pintar el error como `assistant_final`.
 */
export function claudeResultErrorText(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  const obj = value as Record<string, unknown>
  if (obj.type !== 'result' || obj.is_error !== true) return undefined
  if (typeof obj.result === 'string' && obj.result) return obj.result
  if (typeof obj.subtype === 'string' && obj.subtype) return obj.subtype
  return 'provider error'
}

/**
 * True si el stderr/mensaje es un outage clasificado (529/overloaded/503/429,
 * rate/usage/session limit). Cursor a veces lo pinta como `assistant_final`.
 */
export function isRetryableHarnessOutage(text: string): boolean {
  const sample = text.trim()
  if (!sample) return false
  const haystack = sample.toLowerCase()
  if (RETRYABLE_OUTAGE.some(token => haystack.includes(token))) return true
  return haystack.includes("you've hit your") && haystack.includes('limit')
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
