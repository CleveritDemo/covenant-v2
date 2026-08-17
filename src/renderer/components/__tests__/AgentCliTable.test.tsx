/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  AGENT_CLI_PROVIDER_IDS,
  type AgentCliProvider,
  type AgentCliResolution,
} from '@shared/agentCliProviders'
import { AgentCliTable } from '../AgentCliTable'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  }),
}))

const PROVIDER_COUNT = AGENT_CLI_PROVIDER_IDS.length

function resolution(provider: AgentCliProvider, path: string | null, version = '1.0.0'): AgentCliResolution {
  return { provider, command: provider, path, version: path ? version : null }
}

const resolveAgentCli = vi.fn()

beforeEach(() => {
  resolveAgentCli.mockReset()
  vi.stubGlobal('window', Object.assign(window, { api: { resolveAgentCli } }))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('AgentCliTable', () => {
  it('comprueba cada proveedor al montar y refleja disponible / no encontrado', async () => {
    resolveAgentCli.mockImplementation((provider: AgentCliProvider) =>
      Promise.resolve(resolution(provider, provider === 'claude' ? '/opt/homebrew/bin/claude' : null)),
    )

    render(<AgentCliTable commands={{}} onChange={() => {}} />)

    await waitFor(() => {
      expect(screen.getAllByText('settings.cliNotFound').length).toBeGreaterThan(0)
    })
    // Claude resuelto muestra la versión; el resto, no encontrado.
    expect(screen.getByText('v1.0.0')).toBeTruthy()
    expect(resolveAgentCli).toHaveBeenCalledTimes(PROVIDER_COUNT)
    expect(screen.getByText(`settings.cliAvailable:1,${PROVIDER_COUNT}`)).toBeTruthy()
  })

  it('abre la fila y muestra la ruta resuelta', async () => {
    resolveAgentCli.mockImplementation((provider: AgentCliProvider) =>
      Promise.resolve(resolution(provider, '/usr/local/bin/x')),
    )

    render(<AgentCliTable commands={{}} onChange={() => {}} />)
    await waitFor(() => expect(screen.getAllByText('v1.0.0').length).toBe(PROVIDER_COUNT))

    fireEvent.click(screen.getByText('Claude Code'))
    expect(screen.getByText('/usr/local/bin/x')).toBeTruthy()
  })

  it('descarta una respuesta que llega tarde y conserva la de la última comprobación', async () => {
    vi.useFakeTimers()
    const pending: Array<(value: AgentCliResolution) => void> = []
    resolveAgentCli.mockImplementation(
      () => new Promise<AgentCliResolution>(resolve => { pending.push(resolve) }),
    )

    const onChange = vi.fn()
    render(<AgentCliTable commands={{}} onChange={onChange} />)
    // N comprobaciones de montaje en vuelo; la de claude es la primera.
    expect(pending.length).toBe(PROVIDER_COUNT)

    fireEvent.click(screen.getByText('Claude Code'))
    const input = screen.getByLabelText('settings.cliCommandLabel:Claude Code')
    fireEvent.change(input, { target: { value: '/ruta/nueva' } })
    expect(onChange).toHaveBeenCalledWith('claude', '/ruta/nueva')

    await vi.advanceTimersByTimeAsync(500)
    expect(pending.length).toBe(PROVIDER_COUNT + 1) // la comprobación del texto nuevo

    // La nueva responde primero, la vieja del montaje después.
    pending[PROVIDER_COUNT](resolution('claude', '/ruta/nueva'))
    pending[0](resolution('claude', '/vieja/claude'))
    await vi.advanceTimersByTimeAsync(0)

    fireEvent.click(screen.getByText('Claude Code'))
    fireEvent.click(screen.getByText('Claude Code'))
    expect(screen.getByText('/ruta/nueva')).toBeTruthy()
    expect(screen.queryByText('/vieja/claude')).toBeNull()
  })
})
