import { describe, expect, it } from 'vitest'
import {
  isRetryableHarnessOutage,
  providerMapsPlanMode,
  sanitizeFallbackProvider,
  shouldAttemptHarnessFallback,
} from '../agentHarnessFallback'
import { AGENT_CLI_PROVIDER_IDS } from '../agentCliProviders'

describe('isRetryableHarnessOutage', () => {
  it.each([
    'HTTP 529',
    'model overloaded',
    '503 Service Unavailable',
    'status 429',
    'rate_limit exceeded',
    'hit a rate limit',
    'rate-limit: slow down',
    'Too Many Requests',
    'OVERLOADED 529',
  ])('true for %s', text => {
    expect(isRetryableHarnessOutage(text)).toBe(true)
  })

  it.each([
    'spawn claude ENOENT',
    'command not found',
    'not in PATH',
    'configúralo en Ajustes',
    '401 Unauthorized',
    '403 forbidden',
    'unauthorized',
    'invalid api key',
    'got SIGTERM',
    'process killed',
    'abort',
  ])('false for %s', text => {
    expect(isRetryableHarnessOutage(text)).toBe(false)
  })

  it('false for empty text', () => {
    expect(isRetryableHarnessOutage('')).toBe(false)
  })
})

describe('sanitizeFallbackProvider', () => {
  it('acepta un proveedor válido distinto del primario', () => {
    expect(sanitizeFallbackProvider('claude', 'cursor')).toBe('cursor')
  })

  it('omite ausente, basura e igual al primario', () => {
    expect(sanitizeFallbackProvider('claude', undefined)).toBeUndefined()
    expect(sanitizeFallbackProvider('claude', 'nope')).toBeUndefined()
    expect(sanitizeFallbackProvider('claude', 'claude')).toBeUndefined()
    expect(sanitizeFallbackProvider('claude', 3)).toBeUndefined()
  })
})

describe('providerMapsPlanMode', () => {
  it('false solo para pi, hermes y grok', () => {
    expect(providerMapsPlanMode('pi')).toBe(false)
    expect(providerMapsPlanMode('hermes')).toBe(false)
    expect(providerMapsPlanMode('grok')).toBe(false)
  })

  it('true para el resto del registro', () => {
    for (const id of AGENT_CLI_PROVIDER_IDS) {
      if (id === 'pi' || id === 'hermes' || id === 'grok') continue
      expect(providerMapsPlanMode(id)).toBe(true)
    }
  })
})

describe('shouldAttemptHarnessFallback', () => {
  const base = {
    primary: 'claude' as const,
    fallback: 'cursor' as const,
    permissionMode: 'auto' as const,
    alreadyAttempted: false,
  }

  it('true cuando hay recambio distinto y no se intentó', () => {
    expect(shouldAttemptHarnessFallback(base)).toBe(true)
  })

  it('false si alreadyAttempted, sin fallback o igual al primario', () => {
    expect(shouldAttemptHarnessFallback({ ...base, alreadyAttempted: true })).toBe(false)
    expect(shouldAttemptHarnessFallback({ ...base, fallback: undefined })).toBe(false)
    expect(shouldAttemptHarnessFallback({ ...base, fallback: 'claude' })).toBe(false)
  })

  it('false en plan si el fallback no mapea plan', () => {
    expect(shouldAttemptHarnessFallback({
      ...base,
      fallback: 'grok',
      permissionMode: 'plan',
    })).toBe(false)
    expect(shouldAttemptHarnessFallback({
      ...base,
      fallback: 'cursor',
      permissionMode: 'plan',
    })).toBe(true)
  })
})
