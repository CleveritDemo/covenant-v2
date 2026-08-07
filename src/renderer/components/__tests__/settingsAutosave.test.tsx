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
  vi.stubGlobal('window', Object.assign(window, { api: { setConfig, openConfigFolder: vi.fn() } }))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function gotoMusic(): void {
  fireEvent.click(screen.getByRole('button', { name: 'settings.spotifySection' }))
}

describe('guardado al cambiar', () => {
  it('no escribe nada sólo por abrir el modal', async () => {
    render(<SettingsModal config={config} onSave={() => {}} onClose={() => {}} />)

    await new Promise(r => setTimeout(r, 50))
    expect(setConfig).not.toHaveBeenCalled()
    expect(screen.getByText('settings.savesOnChange')).toBeTruthy()
  })

  it('una ráfaga de tecleo produce una sola escritura', async () => {
    vi.useFakeTimers()
    render(<SettingsModal config={config} onSave={() => {}} onClose={() => {}} />)
    gotoMusic()

    const input = document.getElementById('settings-pl-focus') as HTMLInputElement
    for (const value of ['3', '37', '37i9dQZF1DX4sWSpwq3LiO']) {
      fireEvent.change(input, { target: { value } })
      await vi.advanceTimersByTimeAsync(100)
    }
    expect(setConfig).not.toHaveBeenCalled() // el debounce aún no venció

    await vi.advanceTimersByTimeAsync(700)
    expect(setConfig).toHaveBeenCalledTimes(1)
    expect(setConfig.mock.calls[0][0].musicPlaylistIdsByMood.focus).toBe('37i9dQZF1DX4sWSpwq3LiO')
  })

  it('cerrar vacía el cambio pendiente en vez de perderlo', async () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<SettingsModal config={config} onSave={() => {}} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'settings.appearanceSection' }))
    fireEvent.click(screen.getByRole('button', { name: /settings.reduceMotionTitle/ }))
    await vi.advanceTimersByTimeAsync(50) // muy por debajo del debounce

    fireEvent.click(screen.getByText('common.done'))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(setConfig).toHaveBeenCalledTimes(1)
    expect(setConfig.mock.calls[0][0].reduceMotion).toBe(true)
  })

  it('«Descartar cambios» vuelve al estado de apertura y lo persiste', async () => {
    render(<SettingsModal config={config} onSave={() => {}} onClose={() => {}} />)
    gotoMusic()

    const input = document.getElementById('settings-pl-focus') as HTMLInputElement
    fireEvent.change(input, { target: { value: '37i9dQZF1DX4sWSpwq3LiO' } })
    await waitFor(() => expect(setConfig).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByText('settings.discard'))

    await waitFor(() => expect(setConfig).toHaveBeenCalledTimes(2))
    expect(setConfig.mock.calls[1][0].musicPlaylistIdsByMood.focus).toBeUndefined()
    expect((document.getElementById('settings-pl-focus') as HTMLInputElement).value).toBe('')
  })

  it('el pie pasa a marca de tiempo tras guardar', async () => {
    render(<SettingsModal config={config} onSave={() => {}} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'settings.appearanceSection' }))
    fireEvent.click(screen.getByRole('button', { name: /settings.reduceMotionTitle/ }))

    await waitFor(() => expect(screen.getByText(/settings\.savedAt:/)).toBeTruthy())
  })
})
