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
const config = { ...CONFIG_DEFAULTS, musicEnabled: true }

/** El input compacto del mood, por su htmlFor conocido. */
function moodInput(id: string): HTMLInputElement {
  return document.getElementById(`settings-pl-${id}`) as HTMLInputElement
}

/** Los campos de playlist viven tras el riel de categorías. */
function gotoMusic(): void {
  fireEvent.click(screen.getByRole('button', { name: 'settings.spotifySection' }))
}

beforeEach(() => {
  setConfig.mockReset()
  setConfig.mockResolvedValue({ ok: true })
  vi.stubGlobal('window', Object.assign(window, { api: { setConfig, openConfigFolder: vi.fn() } }))
})

afterEach(cleanup)

describe('validación inline de playlists', () => {
  it('no marca error mientras se escribe; sólo al salir del campo', () => {
    render(<SettingsModal config={config} onSave={() => {}} onClose={() => {}} />)
    gotoMusic()

    fireEvent.change(moodInput('focus'), { target: { value: 'no-es-una-playlist' } })
    expect(screen.queryByText(/spotifyError/)).toBeNull()

    fireEvent.blur(moodInput('focus'))
    expect(screen.getByText('settings.spotifyError:Focus')).toBeTruthy()
    expect(moodInput('focus').getAttribute('aria-invalid')).toBe('true')
  })

  it('el error desaparece en cuanto el valor pasa a ser válido', () => {
    render(<SettingsModal config={config} onSave={() => {}} onClose={() => {}} />)
    gotoMusic()

    fireEvent.change(moodInput('chill'), { target: { value: 'malo' } })
    fireEvent.blur(moodInput('chill'))
    expect(screen.getByText('settings.spotifyError:Chill')).toBeTruthy()

    fireEvent.change(moodInput('chill'), { target: { value: '37i9dQZF1DX4sWSpwq3LiO' } })
    expect(screen.queryByText('settings.spotifyError:Chill')).toBeNull()
  })

  it('guardar con un ID inválido no persiste y revela el campo culpable', async () => {
    render(<SettingsModal config={config} onSave={() => {}} onClose={() => {}} />)
    gotoMusic()

    fireEvent.change(moodInput('energy'), { target: { value: 'basura' } })
    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => expect(screen.getByText('settings.spotifyError:Energy')).toBeTruthy())
    expect(setConfig).not.toHaveBeenCalled()
  })

  it('guardar canonicaliza un enlace completo al ID de 22 caracteres', async () => {
    render(<SettingsModal config={config} onSave={() => {}} onClose={() => {}} />)
    gotoMusic()

    fireEvent.change(moodInput('focus'), {
      target: { value: 'https://open.spotify.com/playlist/37i9dQZF1DX4sWSpwq3LiO?si=abc' },
    })
    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => expect(setConfig).toHaveBeenCalledTimes(1))
    expect(setConfig.mock.calls[0][0].musicPlaylistIdsByMood.focus).toBe('37i9dQZF1DX4sWSpwq3LiO')
  })
})
