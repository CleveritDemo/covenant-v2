import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AGENT_CLI_PROVIDER_IDS,
  AGENT_CLI_PROVIDERS,
  type AgentCliProvider,
  type AgentCliResolution,
} from '../../src/shared/agentCliProviders'
import type { AppConfig } from '../../src/shared/configSchema'
import { CONFIG_DEFAULTS } from '../../src/shared/configSchema'

const resolveAgentCli = vi.fn()

vi.mock('../agentCliResolve', () => ({
  resolveAgentCli: (...args: unknown[]) => resolveAgentCli(...args),
}))

const { detectOnboardingClis } = await import('../onboardingCliDetect')

const config = { ...CONFIG_DEFAULTS } as AppConfig

function resolution(
  provider: AgentCliProvider,
  path: string | null,
  version: string | null = null,
): AgentCliResolution {
  return {
    provider,
    command: AGENT_CLI_PROVIDERS[provider].command,
    path,
    version,
  }
}

describe('detectOnboardingClis', () => {
  beforeEach(() => {
    resolveAgentCli.mockReset()
  })

  it('todos instalados', async () => {
    resolveAgentCli.mockImplementation(async (provider: AgentCliProvider) =>
      resolution(provider, `/bin/${provider}`, '1.0.0'),
    )
    const result = await detectOnboardingClis(config)
    expect(result).toHaveLength(AGENT_CLI_PROVIDER_IDS.length)
    expect(result.map(r => r.provider)).toEqual([...AGENT_CLI_PROVIDER_IDS])
    for (const status of result) {
      expect(status.installed).toBe(true)
      expect(status.version).toBe('1.0.0')
      expect(status.label).toBe(AGENT_CLI_PROVIDERS[status.provider].label)
      expect(status.command).toBe(AGENT_CLI_PROVIDERS[status.provider].command)
    }
  })

  it('ninguno instalado', async () => {
    resolveAgentCli.mockImplementation(async (provider: AgentCliProvider) =>
      resolution(provider, null, null),
    )
    const result = await detectOnboardingClis(config)
    expect(result.every(r => !r.installed && r.version === null)).toBe(true)
  })

  it('mezcla instalados y no', async () => {
    resolveAgentCli.mockImplementation(async (provider: AgentCliProvider) => {
      if (provider === 'claude') return resolution(provider, '/bin/claude', '2.1.0')
      return resolution(provider, null, null)
    })
    const result = await detectOnboardingClis(config)
    const claude = result.find(r => r.provider === 'claude')
    expect(claude).toEqual({
      provider: 'claude',
      label: AGENT_CLI_PROVIDERS.claude.label,
      command: AGENT_CLI_PROVIDERS.claude.command,
      installed: true,
      version: '2.1.0',
    })
    expect(result.filter(r => r.provider !== 'claude').every(r => !r.installed)).toBe(true)
  })

  it('un provider que lanza no tumba al resto', async () => {
    resolveAgentCli.mockImplementation(async (provider: AgentCliProvider) => {
      if (provider === 'cursor') throw new Error('boom')
      return resolution(provider, `/bin/${provider}`, '9.9.9')
    })
    const result = await detectOnboardingClis(config)
    expect(result).toHaveLength(AGENT_CLI_PROVIDER_IDS.length)
    const cursor = result.find(r => r.provider === 'cursor')
    expect(cursor).toMatchObject({
      provider: 'cursor',
      installed: false,
      version: null,
      label: AGENT_CLI_PROVIDERS.cursor.label,
      command: AGENT_CLI_PROVIDERS.cursor.command,
    })
    expect(result.filter(r => r.provider !== 'cursor').every(r => r.installed)).toBe(true)
  })
})
