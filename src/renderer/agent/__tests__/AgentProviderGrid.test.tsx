/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { AgentCliResolution } from '@shared/agentCliProviders'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

import { AgentProviderGrid } from '../AgentProviderGrid'

afterEach(cleanup)

const card = (label: string): HTMLButtonElement =>
  screen.getByText(label).closest('button') as HTMLButtonElement

const installedStatuses: Partial<Record<string, AgentCliResolution>> = {
  claude: { provider: 'claude', command: 'claude', path: '/usr/bin/claude', version: '1.0.0' },
  cursor: { provider: 'cursor', command: 'cursor', path: '/usr/bin/cursor', version: '2.0.0' },
  gemini: { provider: 'gemini', command: 'gemini', path: '/usr/bin/gemini', version: '3.0.0' },
}

describe('AgentProviderGrid', () => {
  it('click en card libre llama onPick con ese proveedor', () => {
    const onPick = vi.fn()
    render(
      <AgentProviderGrid
        value="claude"
        statuses={installedStatuses}
        onPick={onPick}
      />,
    )

    fireEvent.click(card('Cursor Agent'))
    expect(onPick).toHaveBeenCalledWith('cursor')
  })

  it('primario y respaldo tienen aria-pressed true y su badge', () => {
    render(
      <AgentProviderGrid
        value="claude"
        fallbackValue="cursor"
        statuses={installedStatuses}
        onPick={() => {}}
      />,
    )

    expect(card('Claude Code').getAttribute('aria-pressed')).toBe('true')
    expect(card('Cursor Agent').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('agentPane.providerPrimaryBadge')).toBeTruthy()
    expect(screen.getByText('agentPane.providerFallbackBadge')).toBeTruthy()
  })

  it('las demás cards tienen aria-pressed false y sin badge', () => {
    render(
      <AgentProviderGrid
        value="claude"
        fallbackValue="cursor"
        statuses={installedStatuses}
        onPick={() => {}}
      />,
    )

    expect(card('Gemini').getAttribute('aria-pressed')).toBe('false')
    expect(screen.queryAllByText('agentPane.providerPrimaryBadge')).toHaveLength(1)
    expect(screen.queryAllByText('agentPane.providerFallbackBadge')).toHaveLength(1)
  })

  it('con disabled no se llama onPick', () => {
    const onPick = vi.fn()
    render(
      <AgentProviderGrid
        value="claude"
        statuses={installedStatuses}
        disabled
        onPick={onPick}
      />,
    )

    fireEvent.click(card('Cursor Agent'))
    expect(onPick).not.toHaveBeenCalled()
  })

  it('fallbackDisabledIds bloquea onPick', () => {
    const onPick = vi.fn()
    render(
      <AgentProviderGrid
        value="claude"
        statuses={installedStatuses}
        fallbackDisabledIds={['cursor']}
        onPick={onPick}
      />,
    )

    fireEvent.click(card('Cursor Agent'))
    expect(onPick).not.toHaveBeenCalled()
  })

  it('el contenedor no es radiogroup', () => {
    const { container } = render(
      <AgentProviderGrid
        value="claude"
        statuses={installedStatuses}
        onPick={() => {}}
      />,
    )

    const group = container.querySelector('.agent-provider-grid')
    expect(group?.getAttribute('role')).toBe('group')
    expect(group?.getAttribute('role')).not.toBe('radiogroup')
  })
})
