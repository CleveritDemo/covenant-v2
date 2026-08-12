/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CONFIG_DEFAULTS, sanitizeMusicVolume } from '@shared/configSchema'
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

vi.mock('../AgentCliTable', () => ({ AgentCliTable: () => null }))
vi.mock('../GitHubTokenField', () => ({ GitHubTokenField: () => null }))

const setConfig = vi.fn()
const config = { ...CONFIG_DEFAULTS, musicEnabled: true }

function gotoSoundMusic(): void {
  fireEvent.click(screen.getByRole('button', { name: 'settings.soundSection' }))
}

beforeEach(() => {
  setConfig.mockReset()
  setConfig.mockResolvedValue({ ok: true })
  vi.stubGlobal('window', Object.assign(window, {
    api: {
      setConfig,
      openConfigFolder: vi.fn(),
      getAppVersion: vi.fn().mockResolvedValue('0.0.0'),
      getUpdateState: vi.fn().mockResolvedValue({ kind: 'idle' }),
      onUpdateState: vi.fn().mockReturnValue(() => {}),
    },
  }))
})

afterEach(cleanup)

describe('audio del tema en Sonido', () => {
  it('sanitizeMusicVolume clampea a 0..1 sin interpretar 35 como 35%', () => {
    expect(sanitizeMusicVolume(0.35)).toBe(0.35)
    expect(sanitizeMusicVolume(35)).toBe(1)
    expect(sanitizeMusicVolume(-2)).toBe(0)
    expect(sanitizeMusicVolume('nope')).toBe(CONFIG_DEFAULTS.musicVolume)
  })

  it('el slider persiste musicVolume en escala 0..1', async () => {
    render(<SettingsModal config={config} onSave={() => {}} onClose={() => {}} />)
    gotoSoundMusic()

    fireEvent.change(document.getElementById('settings-music-volume') as HTMLInputElement, {
      target: { value: '70' },
    })

    await waitFor(() => expect(setConfig).toHaveBeenCalledTimes(1))
    expect(setConfig.mock.calls[0][0].musicVolume).toBe(0.7)
  })

  it('el toggle musicEnabled se guarda (desactivar audio)', async () => {
    render(<SettingsModal config={config} onSave={() => {}} onClose={() => {}} />)
    gotoSoundMusic()

    fireEvent.click(screen.getByRole('button', { name: /settings.musicEnabledTitle/ }))

    await waitFor(() => expect(setConfig).toHaveBeenCalled())
    expect(setConfig.mock.calls.at(-1)?.[0].musicEnabled).toBe(false)
  })

  it('el toggle systemSoundsEnabled se guarda', async () => {
    render(<SettingsModal config={config} onSave={() => {}} onClose={() => {}} />)
    gotoSoundMusic()

    fireEvent.click(screen.getByRole('button', { name: /settings.systemSoundsEnabledTitle/ }))

    await waitFor(() => expect(setConfig).toHaveBeenCalled())
    expect(setConfig.mock.calls.at(-1)?.[0].systemSoundsEnabled).toBe(false)
  })
})
