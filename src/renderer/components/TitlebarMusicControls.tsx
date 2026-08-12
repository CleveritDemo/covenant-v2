import React, { useCallback, useEffect, useRef, useState } from 'react'
import { type AppConfig, sanitizeMusicVolume } from '@shared/configSchema'
import { resolveThemeMusic } from '@shared/themeMusic'
import { useT } from '@i18n/useT'
import { MusicSpectrum } from './MusicSpectrum'
import { Icon } from './ui/Icon'
import { Tooltip } from './ui/Tooltip'
import './TitlebarMusicControls.css'

interface Props {
  config: AppConfig
}

export const TitlebarMusicControls: React.FC<Props> = ({ config }) => {
  const { t } = useT()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playingRef = useRef(false)
  const isInitialTrackSyncRef = useRef(true)
  const prevTrackKeyRef = useRef<string | null>(null)
  const [playing, setPlaying] = useState(false)

  const track = config.musicEnabled ? resolveThemeMusic(config.themeId) : null
  const volume = sanitizeMusicVolume(config.musicVolume)

  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio
    const onEnded = (): void => {
      if (!audio.loop) {
        playingRef.current = false
        setPlaying(false)
      }
    }
    const onError = (): void => {
      playingRef.current = false
      setPlaying(false)
    }
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    return () => {
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      try {
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
      } catch {
        // jsdom / entornos sin media
      }
      audioRef.current = null
    }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume
  }, [volume])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (!track) {
      try {
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
      } catch {
        // ignore
      }
      playingRef.current = false
      setPlaying(false)
      prevTrackKeyRef.current = null
      isInitialTrackSyncRef.current = false
      return
    }

    const trackKey = `${track.id}\0${track.src}`
    const shouldAutoplayOnTrackChange =
      !isInitialTrackSyncRef.current && prevTrackKeyRef.current !== trackKey

    audio.loop = track.loop !== false
    try {
      const absolute = new URL(track.src, window.location.href).href
      if (audio.src !== absolute) {
        audio.src = track.src
        audio.load()
      }
    } catch {
      audio.src = track.src
    }

    if (shouldAutoplayOnTrackChange || playingRef.current) {
      void audio.play().then(() => {
        playingRef.current = true
        setPlaying(true)
      }).catch(() => {
        playingRef.current = false
        setPlaying(false)
      })
    } else {
      try { audio.pause() } catch { /* ignore */ }
      playingRef.current = false
      setPlaying(false)
    }

    prevTrackKeyRef.current = trackKey
    isInitialTrackSyncRef.current = false
  }, [track?.id, track?.src, track?.loop])

  const setPlayingState = useCallback((next: boolean): void => {
    playingRef.current = next
    setPlaying(next)
  }, [])

  const onPlayPause = useCallback((): void => {
    const audio = audioRef.current
    if (!audio || !track) return
    if (playingRef.current) {
      try { audio.pause() } catch { /* ignore */ }
      setPlayingState(false)
      return
    }
    void audio.play().then(() => {
      setPlayingState(true)
    }).catch(() => {
      setPlayingState(false)
    })
  }, [setPlayingState, track])

  if (!track) return null

  const playPauseLabel = playing ? t('music.pause') : t('music.play')

  return (
    <div className="titlebar-music">
      <div className="titlebar-music-wave">
        <MusicSpectrum animating={playing} />
        <Tooltip content={playPauseLabel}>
          <button
            type="button"
            tabIndex={-1}
            className="titlebar-music-btn"
            aria-label={playPauseLabel}
            onClick={onPlayPause}
          >
            <Icon name={playing ? 'pause' : 'play'} size={12} />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
