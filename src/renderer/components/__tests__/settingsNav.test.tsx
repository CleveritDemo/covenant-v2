/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CONFIG_DEFAULTS } from '@shared/configSchema'
import { SettingsModal } from '../SettingsModal'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  }),
}))

vi.mock('../TerminalModal', () => ({
  TerminalModal: ({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) => (
    <div>{children}<div>{footer}</div></div>
  ),
}))

vi.mock('../AgentCliTable', () => ({
  AgentCliTable: () => <div data-testid="cli-table" />,
}))
vi.mock('../GitHubTokenField', () => ({
  GitHubTokenField: () => <div data-testid="token-field" />,
}))

const setConfig = vi.fn()
const config = { ...CONFIG_DEFAULTS, musicEnabled: true }

function nav(name: string): HTMLElement {
  return screen.getByRole('button', { name })
}

beforeEach(() => {
  setConfig.mockReset()
  setConfig.mockResolvedValue({ ok: true })
  vi.stubGlobal('window', Object.assign(window, { api: { setConfig, openConfigFolder: vi.fn(), getAppVersion: vi.fn().mockResolvedValue('0.0.0') } }))
})

afterEach(cleanup)

describe('riel de categorías', () => {
  it('abre en Agentes CLI y sólo muestra esa categoría', () => {
    render(<SettingsModal config={config} onSave={() => {}} onClose={() => {}} />)

    expect(screen.getByTestId('cli-table')).toBeTruthy()
    expect(screen.queryByTestId('token-field')).toBeNull()
    expect(nav('settings.agentCliSection').getAttribute('aria-current')).toBe('page')
  })

  it('cambiar de categoría intercambia el panel y marca el riel', () => {
    render(<SettingsModal config={config} onSave={() => {}} onClose={() => {}} />)

    fireEvent.click(nav('settings.githubSection'))

    expect(screen.getByTestId('token-field')).toBeTruthy()
    expect(screen.queryByTestId('cli-table')).toBeNull()
    expect(nav('settings.githubSection').getAttribute('aria-current')).toBe('page')
    expect(nav('settings.agentCliSection').getAttribute('aria-current')).toBeNull()
  })

  it('Apariencia agrupa idioma y movimiento en un solo panel', () => {
    render(<SettingsModal config={config} onSave={() => {}} onClose={() => {}} />)

    fireEvent.click(nav('settings.appearanceSection'))

    expect(screen.getByText('settings.languageLabel')).toBeTruthy()
    expect(screen.getByText('settings.reduceMotionTitle')).toBeTruthy()
  })

  it('el pie avisa del campo inválido aunque estés en otra categoría', async () => {
    render(<SettingsModal config={config} onSave={() => {}} onClose={() => {}} />)

    fireEvent.click(nav('settings.spotifySection'))
    fireEvent.change(document.getElementById('settings-pl-focus') as HTMLInputElement, {
      target: { value: 'basura' },
    })
    fireEvent.click(nav('settings.advancedSection'))
    expect(document.getElementById('settings-pl-focus')).toBeNull()

    // El error de campo ya no se ve, pero el pie sigue diciendo dónde está.
    await waitFor(() =>
      expect(screen.getByText('settings.notSavedInvalid:settings.spotifySection')).toBeTruthy())
  })
})
