/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

vi.mock('../../components/TerminalModal', () => ({
  TerminalModal: ({ open, children }: { open: boolean; children: React.ReactNode }) => (
    open ? <div>{children}</div> : null
  ),
}))

import { AgentProviderPickerModal } from '../AgentProviderPickerModal'

beforeAll(() => {
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      resolveAgentCli: vi.fn().mockImplementation((provider: string) => Promise.resolve(
        provider === 'gemini'
          ? { provider, command: 'gemini', path: null, version: null }
          : { provider, command: provider, path: `/usr/local/bin/${provider}`, version: '1.2.3' },
      )),
    },
  })
})

afterEach(cleanup)

const card = (label: string): HTMLButtonElement =>
  screen.getByText(label).closest('button') as HTMLButtonElement

describe('AgentProviderPickerModal', () => {
  it('bloquea el proveedor que no está en el PATH y deja el resto elegible', async () => {
    const onSelect = vi.fn()
    render(<AgentProviderPickerModal open onSelect={onSelect} onClose={() => {}} />)

    await waitFor(() => expect(card('Gemini').disabled).toBe(true))
    expect(card('Claude Code').disabled).toBe(false)

    fireEvent.click(card('Gemini'))
    expect(onSelect).not.toHaveBeenCalled()

    fireEvent.click(card('Claude Code'))
    expect(onSelect).toHaveBeenCalledWith('claude')
  })

  it('bloquea también duplicar un agente cuyo CLI falta', async () => {
    const onClone = vi.fn()
    render(
      <AgentProviderPickerModal
        open
        cloneSources={[
          { paneId: 'p1', name: 'Researcher', provider: 'gemini' },
          { paneId: 'p2', name: 'Tech Lead', provider: 'claude' },
        ]}
        onSelect={() => {}}
        onClone={onClone}
        onClose={() => {}}
      />,
    )

    await waitFor(() => expect(card('Researcher').disabled).toBe(true))
    expect(card('Tech Lead').disabled).toBe(false)

    fireEvent.click(card('Researcher'))
    expect(onClone).not.toHaveBeenCalled()

    fireEvent.click(card('Tech Lead'))
    expect(onClone).toHaveBeenCalledWith('p2')
  })

  it('no afirma nada mientras resuelve: ninguna tarjeta arranca bloqueada', () => {
    render(<AgentProviderPickerModal open onSelect={() => {}} onClose={() => {}} />)
    expect(card('Gemini').disabled).toBe(false)
    expect(screen.getAllByText('agentPane.providerChecking').length).toBeGreaterThan(0)
  })
})
