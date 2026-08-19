import { describe, expect, it } from 'vitest'
import {
  claudeResultErrorText,
  isRetryableHarnessOutage,
  pickProviderChoice,
  providerMapsPlanMode,
  sanitizeFallbackProvider,
  shouldAttemptHarnessFallback,
} from '../agentHarnessFallback'
import { AGENT_CLI_PROVIDER_IDS } from '../agentCliProviders'

describe('claudeResultErrorText', () => {
  it('devuelve result si type=result e is_error', () => {
    expect(claudeResultErrorText({
      type: 'result',
      subtype: 'error_during_execution',
      is_error: true,
      result: 'API Error: 529 Overloaded.',
      session_id: 'x',
    })).toBe('API Error: 529 Overloaded.')
  })

  it('cae a subtype si result no es string no vacío', () => {
    expect(claudeResultErrorText({
      type: 'result',
      is_error: true,
      subtype: 'error_during_execution',
      result: '',
    })).toBe('error_during_execution')
  })

  it('cae a provider error si no hay result ni subtype útiles', () => {
    expect(claudeResultErrorText({ type: 'result', is_error: true })).toBe('provider error')
  })

  it('undefined si no es result de error', () => {
    expect(claudeResultErrorText({ type: 'result', result: 'ok' })).toBeUndefined()
    expect(claudeResultErrorText({ type: 'result', is_error: false, result: 'x' })).toBeUndefined()
    expect(claudeResultErrorText({ type: 'assistant', is_error: true })).toBeUndefined()
    expect(claudeResultErrorText(null)).toBeUndefined()
  })
})

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
    "You've hit your session limit · resets 4:30pm (America/Santiago)",
    'usage limit reached',
    'hit your limit',
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

describe('pickProviderChoice', () => {
  const primary = { provider: 'claude' as const }

  it('sin primario, la card libre pasa a serlo', () => {
    expect(pickProviderChoice({}, 'cursor')).toEqual({ provider: 'cursor' })
  })

  it('click en primario sin respaldo deja el par vacío', () => {
    expect(pickProviderChoice(primary, 'claude')).toEqual({})
    expect(pickProviderChoice(primary, 'claude')).not.toHaveProperty('provider')
  })

  it('click en primario con respaldo lo promueve y sube su modelo', () => {
    expect(pickProviderChoice({
      provider: 'claude',
      model: 'opus',
      fallbackProvider: 'cursor',
      fallbackModel: 'gpt-4',
    }, 'claude')).toEqual({ provider: 'cursor', model: 'gpt-4' })
  })

  it('click en respaldo lo quita y conserva el primario', () => {
    expect(pickProviderChoice({ provider: 'claude', fallbackProvider: 'cursor' }, 'cursor'))
      .toEqual({ provider: 'claude' })
    expect(pickProviderChoice({ provider: 'claude', fallbackProvider: 'cursor' }, 'cursor'))
      .not.toHaveProperty('fallbackProvider')
  })

  it('click en otro proveedor lo asigna como respaldo', () => {
    expect(pickProviderChoice(primary, 'cursor'))
      .toEqual({ provider: 'claude', fallbackProvider: 'cursor' })
  })

  it('click en otro proveedor reemplaza el respaldo anterior y tira su modelo', () => {
    expect(pickProviderChoice(
      { provider: 'claude', fallbackProvider: 'cursor', fallbackModel: 'gpt-4' },
      'codex',
    )).toEqual({ provider: 'claude', fallbackProvider: 'codex' })
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
