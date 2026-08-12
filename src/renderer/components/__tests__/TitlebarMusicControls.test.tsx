/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CONFIG_DEFAULTS } from '@shared/configSchema'
import { resolveThemeMusic } from '@shared/themeMusic'
import { TitlebarMusicControls } from '../TitlebarMusicControls'

/**
 * Id que el registro de música nunca va a tener. Antes esto era `credicorp`, un
 * tema real, y el test se rompió en cuanto v0.39.64 le dio track a esa familia
 * —hoy los 38 temas tienen música, así que no queda ninguno real que sirva—.
 * Ejercita el mismo contrato: «solo match explícito, sin fallback».
 */
const THEME_WITHOUT_TRACK = 'tema-sin-musica'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string) => key,
  }),
}))

const attachThemeMusicAnalyser = vi.fn()
const detachThemeMusicAnalyser = vi.fn()
const resumeThemeMusicEnergyContext = vi.fn(() => Promise.resolve())

vi.mock('../../themeMusicEnergy', () => ({
  attachThemeMusicAnalyser: (...args: unknown[]) => attachThemeMusicAnalyser(...args),
  detachThemeMusicAnalyser: (...args: unknown[]) => detachThemeMusicAnalyser(...args),
  resumeThemeMusicEnergyContext: (...args: unknown[]) => resumeThemeMusicEnergyContext(...args),
}))

type FakeAudioInstance = {
  src: string
  play: ReturnType<typeof vi.fn>
  pause: ReturnType<typeof vi.fn>
}

const audioInstances: FakeAudioInstance[] = []

beforeEach(() => {
  audioInstances.length = 0
  attachThemeMusicAnalyser.mockClear()
  detachThemeMusicAnalyser.mockClear()
  resumeThemeMusicEnergyContext.mockClear()
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
    // La premisa primero: si falla aquí, es el fixture y no el componente.
    expect(resolveThemeMusic(THEME_WITHOUT_TRACK)).toBeNull()
    const { container } = render(
      <TitlebarMusicControls
        config={{ ...CONFIG_DEFAULTS, themeId: THEME_WITHOUT_TRACK, musicEnabled: true }}
      />,
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
      <TitlebarMusicControls
        config={{ ...CONFIG_DEFAULTS, themeId: 'matrix', musicEnabled: true, musicPaused: true }}
      />,
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
      <TitlebarMusicControls
        config={{ ...CONFIG_DEFAULTS, themeId: 'dragonBallZ', musicEnabled: true, musicPaused: true }}
      />,
    )
    expect(screen.getByLabelText('music.play')).toBeTruthy()
  })

  it('arranque con musicPaused=false reproduce tras configReady', async () => {
    render(
      <TitlebarMusicControls
        config={{ ...CONFIG_DEFAULTS, themeId: 'matrix', musicEnabled: true, musicPaused: false }}
        configReady
      />,
    )
    const audio = audioInstances[0]
    expect(audio).toBeTruthy()
    await waitFor(() => expect(audio.play).toHaveBeenCalled())
    expect(resumeThemeMusicEnergyContext).toHaveBeenCalled()
  })

  it('arranque con musicPaused=true no reproduce', () => {
    render(
      <TitlebarMusicControls
        config={{ ...CONFIG_DEFAULTS, themeId: 'matrix', musicEnabled: true, musicPaused: true }}
        configReady
      />,
    )
    const audio = audioInstances[0]
    expect(audio).toBeTruthy()
    expect(audio.play).not.toHaveBeenCalled()
    expect(screen.getByLabelText('music.play')).toBeTruthy()
  })

  it('sin configReady no autoplay aunque musicPaused=false', () => {
    render(
      <TitlebarMusicControls
        config={{ ...CONFIG_DEFAULTS, themeId: 'matrix', musicEnabled: true, musicPaused: false }}
        configReady={false}
      />,
    )
    const audio = audioInstances[0]
    expect(audio.play).not.toHaveBeenCalled()
  })

  it('attach al montar y detach al desmontar', () => {
    const { unmount } = render(
      <TitlebarMusicControls
        config={{ ...CONFIG_DEFAULTS, themeId: 'matrix', musicEnabled: true, musicPaused: true }}
      />,
    )
    const audio = audioInstances[0]
    expect(attachThemeMusicAnalyser).toHaveBeenCalledTimes(1)
    expect(attachThemeMusicAnalyser).toHaveBeenCalledWith(audio)
    unmount()
    expect(detachThemeMusicAnalyser).toHaveBeenCalledWith(audio)
  })

  it('cambiar themeId con musicPaused=false autoplay del nuevo track', async () => {
    const { rerender } = render(
      <TitlebarMusicControls
        config={{ ...CONFIG_DEFAULTS, themeId: 'matrix', musicEnabled: true, musicPaused: false }}
        configReady
      />,
    )
    const audio = audioInstances[0]
    await waitFor(() => expect(audio.play).toHaveBeenCalled())
    audio.play.mockClear()

    rerender(
      <TitlebarMusicControls
        config={{ ...CONFIG_DEFAULTS, themeId: 'interstellar', musicEnabled: true, musicPaused: false }}
        configReady
      />,
    )
    await waitFor(() => expect(audio.play).toHaveBeenCalled())
  })

  it('cambiar themeId con musicPaused=true no autoplay', () => {
    const { rerender } = render(
      <TitlebarMusicControls
        config={{ ...CONFIG_DEFAULTS, themeId: 'matrix', musicEnabled: true, musicPaused: true }}
        configReady
      />,
    )
    const audio = audioInstances[0]
    expect(audio.play).not.toHaveBeenCalled()

    rerender(
      <TitlebarMusicControls
        config={{ ...CONFIG_DEFAULTS, themeId: 'interstellar', musicEnabled: true, musicPaused: true }}
        configReady
      />,
    )
    expect(audio.play).not.toHaveBeenCalled()
  })

  it('con musicEnabled=false, cambiar themeId no llama play y oculta controles', () => {
    const { container, rerender } = render(
      <TitlebarMusicControls
        config={{ ...CONFIG_DEFAULTS, themeId: 'matrix', musicEnabled: false }}
      />,
    )
    expect(container.firstChild).toBeNull()
    const audio = audioInstances[0]
    expect(audio).toBeTruthy()

    rerender(
      <TitlebarMusicControls
        config={{ ...CONFIG_DEFAULTS, themeId: 'interstellar', musicEnabled: false }}
      />,
    )
    expect(audio.play).not.toHaveBeenCalled()
    expect(container.firstChild).toBeNull()
  })

  it('click pausa persiste musicPaused true', async () => {
    const onMusicPausedChange = vi.fn()
    render(
      <TitlebarMusicControls
        config={{ ...CONFIG_DEFAULTS, themeId: 'matrix', musicEnabled: true, musicPaused: false }}
        configReady
        onMusicPausedChange={onMusicPausedChange}
      />,
    )
    const audio = audioInstances[0]
    await waitFor(() => expect(audio.play).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByLabelText('music.pause')).toBeTruthy())

    fireEvent.click(screen.getByLabelText('music.pause'))
    expect(audio.pause).toHaveBeenCalled()
    expect(onMusicPausedChange).toHaveBeenCalledWith(true)
  })

  it('click play persiste musicPaused false', async () => {
    const onMusicPausedChange = vi.fn()
    render(
      <TitlebarMusicControls
        config={{ ...CONFIG_DEFAULTS, themeId: 'matrix', musicEnabled: true, musicPaused: true }}
        configReady
        onMusicPausedChange={onMusicPausedChange}
      />,
    )
    const audio = audioInstances[0]
    fireEvent.click(screen.getByLabelText('music.play'))
    await waitFor(() => expect(audio.play).toHaveBeenCalled())
    expect(resumeThemeMusicEnergyContext).toHaveBeenCalled()
    expect(onMusicPausedChange).toHaveBeenCalledWith(false)
  })
})
