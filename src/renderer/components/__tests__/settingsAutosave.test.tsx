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

vi.mock('../AgentCliTable', () => ({ AgentCliTable: () => null }))
vi.mock('../GitHubTokenField', () => ({ GitHubTokenField: () => null }))

const setConfig = vi.fn()
const config = { ...CONFIG_DEFAULTS, musicEnabled: true, reduceMotion: false }

beforeEach(() => {
  setConfig.mockReset()
  setConfig.mockResolvedValue({ ok: true })
  vi.stubGlobal('window', Object.assign(window, { api: { setConfig, openConfigFolder: vi.fn(), getAppVersion: vi.fn().mockResolvedValue('0.0.0') } }))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function gotoAppearance(): void {
  fireEvent.click(screen.getByRole('button', { name: 'settings.appearanceSection' }))
}

describe('guardado al cambiar', () => {
  it('no escribe nada sólo por abrir el modal', async () => {
    render(<SettingsModal config={config} onSave={() => {}} onClose={() => {}} />)

    await new Promise(r => setTimeout(r, 50))
    expect(setConfig).not.toHaveBeenCalled()
    expect(screen.getByText('settings.savesOnChange')).toBeTruthy()
  })

  it('una ráfaga en el volumen produce una sola escritura', async () => {
    vi.useFakeTimers()
    render(<SettingsModal config={config} onSave={() => {}} onClose={() => {}} />)
    gotoAppearance()

    const slider = document.getElementById('settings-music-volume') as HTMLInputElement
    for (const value of ['20', '40', '55']) {
      fireEvent.change(slider, { target: { value } })
      await vi.advanceTimersByTimeAsync(100)
    }
    expect(setConfig).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(700)
    expect(setConfig).toHaveBeenCalledTimes(1)
    expect(setConfig.mock.calls[0][0].musicVolume).toBe(0.55)
  })

  it('cerrar vacía el cambio pendiente en vez de perderlo', async () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<SettingsModal config={config} onSave={() => {}} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'settings.appearanceSection' }))
    fireEvent.click(screen.getByRole('button', { name: /settings.reduceMotionTitle/ }))
    await vi.advanceTimersByTimeAsync(50)

    fireEvent.click(screen.getByText('common.done'))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(setConfig).toHaveBeenCalledTimes(1)
    expect(setConfig.mock.calls[0][0].reduceMotion).toBe(true)
  })

  it('«Descartar cambios» vuelve al estado de apertura y lo persiste', async () => {
    render(<SettingsModal config={config} onSave={() => {}} onClose={() => {}} />)
    gotoAppearance()

    const slider = document.getElementById('settings-music-volume') as HTMLInputElement
    fireEvent.change(slider, { target: { value: '80' } })
    await waitFor(() => expect(setConfig).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByText('settings.discard'))

    await waitFor(() => expect(setConfig).toHaveBeenCalledTimes(2))
    expect(setConfig.mock.calls[1][0].musicVolume).toBe(CONFIG_DEFAULTS.musicVolume)
    expect((document.getElementById('settings-music-volume') as HTMLInputElement).value).toBe(
      String(Math.round(CONFIG_DEFAULTS.musicVolume * 100)),
    )
    expect(screen.getByText('settings.discarded')).toBeTruthy()
  })

  it('conserva la tipografía elegida al guardar otro ajuste', async () => {
    render(
      <SettingsModal
        config={{ ...config, fontUi: 'Optima', fontMono: 'Menlo' }}
        onSave={() => {}}
        onClose={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'settings.appearanceSection' }))
    fireEvent.click(screen.getByRole('button', { name: /settings.reduceMotionTitle/ }))

    await waitFor(() => expect(setConfig).toHaveBeenCalledTimes(1))
    expect(setConfig.mock.calls[0][0].fontUi).toBe('Optima')
    expect(setConfig.mock.calls[0][0].fontMono).toBe('Menlo')
  })

  it('los inputs de tipografía guardan fontUi y fontMono', async () => {
    render(<SettingsModal config={config} onSave={() => {}} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'settings.appearanceSection' }))

    expect(screen.getByRole('button', { name: 'settings.fontUiLabel' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'settings.fontMonoLabel' })).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('settings.fontCustomPlaceholder'), {
      target: { value: 'Optima' },
    })
    await waitFor(() => expect(setConfig).toHaveBeenCalled())
    expect(setConfig.mock.calls.at(-1)?.[0].fontUi).toBe('Optima')

    fireEvent.change(screen.getByPlaceholderText('settings.fontCustomMonoPlaceholder'), {
      target: { value: 'Menlo' },
    })
    await waitFor(() => expect(setConfig.mock.calls.at(-1)?.[0].fontMono).toBe('Menlo'))
  })

  it('el pie pasa a marca de tiempo tras guardar', async () => {
    render(<SettingsModal config={config} onSave={() => {}} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'settings.appearanceSection' }))
    fireEvent.click(screen.getByRole('button', { name: /settings.reduceMotionTitle/ }))

    await waitFor(() => expect(screen.getByText(/settings\.savedAt:/)).toBeTruthy())
  })
})
