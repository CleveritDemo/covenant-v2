import { describe, expect, it } from 'vitest'
import {
  AGENT_CLI_PROVIDER_IDS,
  type AgentCliProvider,
  type AgentCliResolution,
} from '../agentCliProviders'
import { pickableProviderIds } from '../agentCliPickList'

function resolution(provider: AgentCliProvider, path: string | null): AgentCliResolution {
  return { provider, command: provider, path, version: path ? '1.0.0' : null }
}

describe('pickableProviderIds', () => {
  it('mapa vacío → devuelve los 10 en orden', () => {
    expect(pickableProviderIds({}, 'claude')).toEqual(AGENT_CLI_PROVIDER_IDS)
    expect(AGENT_CLI_PROVIDER_IDS).toHaveLength(10)
  })

  it('solo claude y cursor con path → devuelve esos dos', () => {
    const statuses = {
      claude: resolution('claude', '/usr/bin/claude'),
      cursor: resolution('cursor', '/usr/bin/cursor'),
    }
    expect(pickableProviderIds(statuses, 'claude')).toEqual(['claude', 'cursor'])
  })

  it('selected no instalado → aparece igual y al final', () => {
    const statuses = {
      claude: resolution('claude', '/usr/bin/claude'),
      cursor: resolution('cursor', '/usr/bin/cursor'),
    }
    expect(pickableProviderIds(statuses, 'grok')).toEqual(['claude', 'cursor', 'grok'])
  })

  it('selected instalado → no se duplica', () => {
    const statuses = {
      claude: resolution('claude', '/usr/bin/claude'),
      cursor: resolution('cursor', '/usr/bin/cursor'),
    }
    expect(pickableProviderIds(statuses, 'cursor')).toEqual(['claude', 'cursor'])
  })

  it('un provider con path: null no aparece', () => {
    const statuses = {
      claude: resolution('claude', '/usr/bin/claude'),
      cursor: resolution('cursor', null),
    }
    expect(pickableProviderIds(statuses, 'claude')).toEqual(['claude'])
  })
})
