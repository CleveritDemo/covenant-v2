/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CONFIG_DEFAULTS } from '@shared/configSchema'
import { SettingsModal } from '../SettingsModal'

const platform = vi.hoisted(() => ({ isStoreBuild: false }))

vi.mock('../../platform', () => ({
  get isStoreBuild() {
    return platform.isStoreBuild
  },
}))

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
vi.mock('../GitHubAccountsField', () => ({
  GitHubAccountsField: () => <div data-testid="accounts-field" />,
}))

const setConfig = vi.fn()
const getUpdateState = vi.fn()
const onUpdateState = vi.fn()
const checkForUpdates = vi.fn()
const installUpdate = vi.fn()
const config = { ...CONFIG_DEFAULTS, musicEnabled: true }

function openUpdates(): void {
  fireEvent.click(screen.getByRole('button', { name: 'settings.updatesSection' }))
}

beforeEach(() => {
  platform.isStoreBuild = false
  setConfig.mockReset()
  setConfig.mockResolvedValue({ ok: true })
  getUpdateState.mockReset()
  getUpdateState.mockResolvedValue({ kind: 'idle' })
  onUpdateState.mockReset()
  onUpdateState.mockReturnValue(() => {})
  checkForUpdates.mockReset()
  checkForUpdates.mockResolvedValue({ kind: 'idle' })
  installUpdate.mockReset()
  vi.stubGlobal('window', Object.assign(window, {
    api: {
      setConfig,
      openConfigFolder: vi.fn(),
      getAppVersion: vi.fn().mockResolvedValue('0.0.0'),
      getUpdateState,
      onUpdateState,
      checkForUpdates,
      installUpdate,
    },
  }))
})

afterEach(cleanup)

describe('actualizaciones en paquete Store', () => {
  it('oculta el toggle y muestra el aviso cuando isStoreBuild es true', () => {
    platform.isStoreBuild = true
    render(<SettingsModal config={config} onSave={() => {}} onClose={() => {}} />)
    openUpdates()

    expect(screen.queryByText('settings.autoUpdatesTitle')).toBeNull()
    expect(screen.queryByRole('button', { name: 'settings.checkUpdates' })).toBeNull()
    expect(screen.getByText('settings.updatesStoreManaged')).toBeTruthy()
  })

  it('muestra el toggle y oculta el aviso cuando isStoreBuild es false', () => {
    platform.isStoreBuild = false
    render(<SettingsModal config={config} onSave={() => {}} onClose={() => {}} />)
    openUpdates()

    expect(screen.getByText('settings.autoUpdatesTitle')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'settings.checkUpdates' })).toBeTruthy()
    expect(screen.queryByText('settings.updatesStoreManaged')).toBeNull()
  })
})
