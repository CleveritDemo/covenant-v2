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
})
