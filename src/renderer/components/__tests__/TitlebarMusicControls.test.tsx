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

type FakeAudioInstance = {
  src: string
  play: ReturnType<typeof vi.fn>
  pause: ReturnType<typeof vi.fn>
}

const audioInstances: FakeAudioInstance[] = []

beforeEach(() => {
  audioInstances.length = 0
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
    constructor() {
      audioInstances.push(this as unknown as FakeAudioInstance)
    }
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
      <TitlebarMusicControls config={{ ...CONFIG_DEFAULTS, themeId: 'credicorp', musicEnabled: true }} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('no renderiza controles si musicEnabled es false', () => {
    const { container } = render(
      <TitlebarMusicControls config={{ ...CONFIG_DEFAULTS, themeId: 'matrix', musicEnabled: false }} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('muestra solo play/pausa integrado en el spectrum cuando hay track', () => {
    const { container } = render(
      <TitlebarMusicControls config={{ ...CONFIG_DEFAULTS, themeId: 'matrix', musicEnabled: true }} />,
    )
    const wave = container.querySelector('.titlebar-music-wave')
    const btn = screen.getByLabelText('music.play')
    expect(wave).toBeTruthy()
    expect(wave?.contains(btn)).toBe(true)
    expect(wave?.querySelector('.titlebar-music-spectrum')).toBeTruthy()
    expect(container.querySelectorAll('button')).toHaveLength(1)
    expect(screen.queryByLabelText('music.stop')).toBeNull()
    expect(screen.queryByLabelText('music.volume')).toBeNull()
  })

  it('Dragon Ball Z tiene track y muestra play', () => {
    render(
      <TitlebarMusicControls config={{ ...CONFIG_DEFAULTS, themeId: 'dragonBallZ', musicEnabled: true }} />,
    )
    expect(screen.getByLabelText('music.play')).toBeTruthy()
  })

  it('render inicial con track no llama play automáticamente', () => {
    render(
      <TitlebarMusicControls config={{ ...CONFIG_DEFAULTS, themeId: 'matrix', musicEnabled: true }} />,
    )
    const audio = audioInstances[0]
    expect(audio).toBeTruthy()
    expect(audio.play).not.toHaveBeenCalled()
  })

  it('cambiar themeId de un tema con track a otro llama play aunque estuviera pausado', () => {
    const { rerender } = render(
      <TitlebarMusicControls config={{ ...CONFIG_DEFAULTS, themeId: 'matrix', musicEnabled: true }} />,
    )
    const audio = audioInstances[0]
    expect(audio).toBeTruthy()
    expect(audio.play).not.toHaveBeenCalled()

    rerender(
      <TitlebarMusicControls config={{ ...CONFIG_DEFAULTS, themeId: 'interstellar', musicEnabled: true }} />,
    )
    expect(audio.play).toHaveBeenCalled()
  })

  it('con musicEnabled=false, cambiar themeId no llama play y oculta controles', () => {
    const { container, rerender } = render(
      <TitlebarMusicControls config={{ ...CONFIG_DEFAULTS, themeId: 'matrix', musicEnabled: false }} />,
    )
    expect(container.firstChild).toBeNull()
    const audio = audioInstances[0]
    expect(audio).toBeTruthy()

    rerender(
      <TitlebarMusicControls config={{ ...CONFIG_DEFAULTS, themeId: 'interstellar', musicEnabled: false }} />,
    )
    expect(audio.play).not.toHaveBeenCalled()
    expect(container.firstChild).toBeNull()
  })

  it('play/pausa alterna el audio', () => {
    render(
      <TitlebarMusicControls config={{ ...CONFIG_DEFAULTS, themeId: 'matrix', musicEnabled: true }} />,
    )
    const audio = audioInstances[0]
    fireEvent.click(screen.getByLabelText('music.play'))
    expect(audio.play).toHaveBeenCalled()
  })
})
