import { describe, expect, it } from 'vitest'
import type { AppConfig } from '../../src/shared/configSchema'
import {
  CONFIG_DEFAULTS,
  mergeWithDefaults,
  validateConfig,
} from '../../src/shared/configSchema'
import { otelEnvFromConfig } from '../otelEnv'

/** Helper: minimal config with otel overrides. */
function otelConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return { ...CONFIG_DEFAULTS, ...overrides }
}

// ---------------------------------------------------------------------------
// otelEnvFromConfig — core env builder
// ---------------------------------------------------------------------------

describe('otelEnvFromConfig', () => {
  it('returns empty record when endpoint is empty', () => {
    const env = otelEnvFromConfig(otelConfig({ otelEndpoint: '', otelEnabled: true }))
    expect(env).toEqual({})
  })

  it('returns correct OTEL vars when endpoint set and enabled', () => {
    const env = otelEnvFromConfig(otelConfig({
      otelEndpoint: 'https://otel.example.com:4318',
      otelProtocol: 'http/protobuf',
      otelEnabled: true,
    }))
    expect(env).toMatchObject({
      OTEL_EXPORTER_OTLP_ENDPOINT: 'https://otel.example.com:4318',
      OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
      CLAUDE_CODE_ENABLE_TELEMETRY: '1',
    })
  })

  it('returns empty record when disabled even with endpoint', () => {
    const env = otelEnvFromConfig(otelConfig({
      otelEndpoint: 'https://otel.example.com:4318',
      otelEnabled: false,
    }))
    expect(env).toEqual({})
  })

  it('includes headers when non-empty', () => {
    const env = otelEnvFromConfig(otelConfig({
      otelEndpoint: 'https://otel.example.com:4318',
      otelEnabled: true,
      otelHeaders: 'Authorization=Bearer tok123',
    }))
    expect(env.OTEL_EXPORTER_OTLP_HEADERS).toBe('Authorization=Bearer tok123')
  })

  it('omits headers key when field is empty', () => {
    const env = otelEnvFromConfig(otelConfig({
      otelEndpoint: 'https://otel.example.com:4318',
      otelEnabled: true,
      otelHeaders: '',
    }))
    expect(env).not.toHaveProperty('OTEL_EXPORTER_OTLP_HEADERS')
  })

  it('emits prompt logging vars when otelLogPrompts is true', () => {
    const env = otelEnvFromConfig(otelConfig({
      otelEndpoint: 'https://otel.example.com:4318',
      otelEnabled: true,
      otelLogPrompts: true,
    }))
    expect(env.OTEL_LOG_USER_PROMPTS).toBe('true')
    expect(env.OTEL_LOG_ASSISTANT_RESPONSES).toBe('true')
  })

  it('omits prompt logging vars when otelLogPrompts is false', () => {
    const env = otelEnvFromConfig(otelConfig({
      otelEndpoint: 'https://otel.example.com:4318',
      otelEnabled: true,
      otelLogPrompts: false,
    }))
    expect(env).not.toHaveProperty('OTEL_LOG_USER_PROMPTS')
    expect(env).not.toHaveProperty('OTEL_LOG_ASSISTANT_RESPONSES')
  })

  it('emits tool logging vars when otelLogToolIO is true', () => {
    const env = otelEnvFromConfig(otelConfig({
      otelEndpoint: 'https://otel.example.com:4318',
      otelEnabled: true,
      otelLogToolIO: true,
    }))
    expect(env.OTEL_LOG_TOOL_DETAILS).toBe('true')
    expect(env.OTEL_LOG_TOOL_CONTENT).toBe('true')
  })

  it('uses http/protobuf protocol by default', () => {
    const env = otelEnvFromConfig(otelConfig({
      otelEndpoint: 'https://otel.example.com:4318',
      otelEnabled: true,
      otelProtocol: 'http/protobuf',
    }))
    expect(env.OTEL_EXPORTER_OTLP_PROTOCOL).toBe('http/protobuf')
  })

  it('supports grpc protocol', () => {
    const env = otelEnvFromConfig(otelConfig({
      otelEndpoint: 'https://otel.example.com:4317',
      otelEnabled: true,
      otelProtocol: 'grpc',
    }))
    expect(env.OTEL_EXPORTER_OTLP_PROTOCOL).toBe('grpc')
  })

  it('supports http/json protocol', () => {
    const env = otelEnvFromConfig(otelConfig({
      otelEndpoint: 'https://otel.example.com:4318',
      otelEnabled: true,
      otelProtocol: 'http/json',
    }))
    expect(env.OTEL_EXPORTER_OTLP_PROTOCOL).toBe('http/json')
  })
})

// ---------------------------------------------------------------------------
// Spawn-site merge semantics
// ---------------------------------------------------------------------------

describe('spawn env merge', () => {
  it('merges otel vars over process.env', () => {
    const base: Record<string, string> = { HOME: '/home/user' }
    const otel = otelEnvFromConfig(otelConfig({
      otelEndpoint: 'https://otel.example.com:4318',
      otelEnabled: true,
    }))
    const env = { ...base, ...otel }
    expect(env.OTEL_EXPORTER_OTLP_ENDPOINT).toBe('https://otel.example.com:4318')
    expect(env.CLAUDE_CODE_ENABLE_TELEMETRY).toBe('1')
    expect(env.HOME).toBe('/home/user')
  })

  it('config values override existing OTEL vars', () => {
    const base: Record<string, string> = {
      OTEL_EXPORTER_OTLP_ENDPOINT: 'https://old.example.com',
    }
    const otel = otelEnvFromConfig(otelConfig({
      otelEndpoint: 'https://new.example.com',
      otelEnabled: true,
    }))
    const env = { ...base, ...otel }
    expect(env.OTEL_EXPORTER_OTLP_ENDPOINT).toBe('https://new.example.com')
  })

  it('preserves shell-profile headers when config headers empty', () => {
    const base: Record<string, string> = {
      OTEL_EXPORTER_OTLP_HEADERS: 'Authorization=Bearer shelltoken',
    }
    const otel = otelEnvFromConfig(otelConfig({
      otelEndpoint: 'https://otel.example.com:4318',
      otelEnabled: true,
      otelHeaders: '',
    }))
    const env = { ...base, ...otel }
    expect(env.OTEL_EXPORTER_OTLP_HEADERS).toBe('Authorization=Bearer shelltoken')
  })

  it('shell-profile OTEL vars survive when config is disabled', () => {
    const base: Record<string, string> = {
      OTEL_EXPORTER_OTLP_ENDPOINT: 'https://shell.example.com',
      CLAUDE_CODE_ENABLE_TELEMETRY: '1',
    }
    const otel = otelEnvFromConfig(otelConfig({
      otelEndpoint: '',
      otelEnabled: false,
    }))
    const env = { ...base, ...otel }
    expect(env.OTEL_EXPORTER_OTLP_ENDPOINT).toBe('https://shell.example.com')
    expect(env.CLAUDE_CODE_ENABLE_TELEMETRY).toBe('1')
  })
})

// ---------------------------------------------------------------------------
// Config schema: mergeWithDefaults fills otel fields
// ---------------------------------------------------------------------------

describe('config schema otel fields', () => {
  it('mergeWithDefaults fills otel defaults from CONFIG_DEFAULTS', () => {
    const merged = mergeWithDefaults({})
    expect(merged.otelEndpoint).toBe('')
    expect(merged.otelProtocol).toBe('http/protobuf')
    expect(merged.otelEnabled).toBe(false)
    expect(merged.otelHeaders).toBe('')
    expect(merged.otelLogPrompts).toBe(false)
    expect(merged.otelLogToolIO).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Config schema: validateConfig for otel fields
// ---------------------------------------------------------------------------

describe('validateConfig otel fields', () => {
  it('accepts valid otel config', () => {
    const errors = validateConfig(otelConfig({
      otelEndpoint: 'https://otel.example.com:4318',
      otelProtocol: 'http/protobuf',
    }))
    const otelErrors = errors.filter(e => /otel/i.test(e))
    expect(otelErrors).toEqual([])
  })

  it('rejects invalid otelProtocol', () => {
    const errors = validateConfig(otelConfig({
      otelProtocol: 'websocket' as AppConfig['otelProtocol'],
    }))
    expect(errors.some(e => /otelProtocol/i.test(e))).toBe(true)
  })

  it('accepts empty endpoint (disabled)', () => {
    const errors = validateConfig(otelConfig({ otelEndpoint: '' }))
    const otelErrors = errors.filter(e => /otelEndpoint/i.test(e))
    expect(otelErrors).toEqual([])
  })

  it('rejects malformed endpoint URL', () => {
    const errors = validateConfig(otelConfig({ otelEndpoint: 'not a url' }))
    expect(errors.some(e => /otelEndpoint/i.test(e))).toBe(true)
  })

  it('rejects non-http endpoint protocol', () => {
    const errors = validateConfig(otelConfig({ otelEndpoint: 'ftp://otel.example.com:4318' }))
    expect(errors.some(e => /otelEndpoint/i.test(e))).toBe(true)
  })
})
