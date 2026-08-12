/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CONFIG_DEFAULTS } from '@shared/configSchema'
import { TitlebarMusicControls } from '../TitlebarMusicControls'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string) => key,
  }),
}))

beforeEach(() => {
  class FakeAudio {
    src = ''
    volume = 1
    loop = false
    currentTime = 0
    pause = vi.fn()
    load = vi.fn()
    play = vi.fn(() => Promise.resolve())
    addEventListener = vi.fn()
    removeEventListener = vi.fn()
    removeAttribute = vi.fn((name: string) => {
      if (name === 'src') this.src = ''
    })
  }
  vi.stubGlobal('Audio', FakeAudio)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('TitlebarMusicControls', () => {
  it('no renderiza controles si el tema no tiene track', () => {
    const { container } = render(
      <TitlebarMusicControls config={{ ...CONFIG_DEFAULTS, themeId: 'dragonBallZ', musicEnabled: true }} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('no renderiza controles si musicEnabled es false', () => {
    const { container } = render(
      <TitlebarMusicControls config={{ ...CONFIG_DEFAULTS, themeId: 'matrix', musicEnabled: false }} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('muestra play, stop y volumen cuando hay track', () => {
    render(
      <TitlebarMusicControls config={{ ...CONFIG_DEFAULTS, themeId: 'matrix', musicEnabled: true }} />,
    )
    expect(screen.getByLabelText('music.play')).toBeTruthy()
    expect(screen.getByLabelText('music.stop')).toBeTruthy()
    expect(screen.getByLabelText('music.volume')).toBeTruthy()
  })

  it('persiste el volumen al mover el slider', () => {
    const onConfigPatch = vi.fn()
    render(
      <TitlebarMusicControls
        config={{ ...CONFIG_DEFAULTS, themeId: 'interstellar', musicEnabled: true, musicVolume: 0.35 }}
        onConfigPatch={onConfigPatch}
      />,
    )
    fireEvent.change(screen.getByLabelText('music.volume'), { target: { value: '50' } })
    expect(onConfigPatch).toHaveBeenCalledWith({ musicVolume: 0.5 })
  })
})
