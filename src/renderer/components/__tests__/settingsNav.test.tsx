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
  vi.stubGlobal('window', Object.assign(window, {
    api: {
      setConfig,
      openConfigFolder: vi.fn(),
      getAppVersion: vi.fn().mockResolvedValue('0.0.0'),
      checkForUpdates: vi.fn().mockResolvedValue({ kind: 'idle' }),
      installUpdate: vi.fn(),
    },
  }))
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

  it('Actualizaciones muestra toggle y acciones de update', () => {
    render(<SettingsModal config={config} onSave={() => {}} onClose={() => {}} />)

    fireEvent.click(nav('settings.updatesSection'))

    expect(screen.getByText('settings.autoUpdatesTitle')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'settings.checkUpdates' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'settings.forceUpdate' })).toBeTruthy()
  })

  it('Música muestra toggle y volumen', async () => {
    render(<SettingsModal config={config} onSave={() => {}} onClose={() => {}} />)

    fireEvent.click(nav('settings.musicSection'))

    expect(screen.getByText('settings.musicEnabledTitle')).toBeTruthy()
    expect(screen.getByLabelText('settings.musicVolumeLabel')).toBeTruthy()
    fireEvent.change(document.getElementById('settings-music-volume') as HTMLInputElement, {
      target: { value: '42' },
    })
    await waitFor(() => expect(setConfig).toHaveBeenCalled())
    expect(setConfig.mock.calls.at(-1)?.[0].musicVolume).toBe(0.42)
  })
})
