import { describe, expect, it } from 'vitest'
import { detectAgentCli, detectAgentClis } from '../agentCliDetect'
import { AGENT_CLI_PROVIDER_IDS } from '../../src/shared/agentCliProviders'

describe('detectAgentCli', () => {
  it('marca found con una ruta absoluta que existe', () => {
    const status = detectAgentCli('claude', { agentCliCommands: { claude: '/bin/sh' } })
    expect(status.found).toBe(true)
    expect(status.command).toBe('/bin/sh')
    expect(status.path).toBeTruthy()
  })

  it('marca not found cuando el comando no está en el PATH', () => {
    const status = detectAgentCli('gemini', {
      agentCliCommands: { gemini: 'gravity-binario-que-no-existe' },
    })
    expect(status.found).toBe(false)
    expect(status.path).toBeUndefined()
  })

  it('cubre todos los proveedores del registro', () => {
    const map = detectAgentClis({ agentCliCommands: {} })
    expect(Object.keys(map).sort()).toEqual([...AGENT_CLI_PROVIDER_IDS].sort())
  })
})
