import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { type AppConfig, parseSpotifyPlaylistId } from '@shared/configSchema'
import { MUSIC_MOODS, type MusicMoodId } from '@shared/musicMoods'
import { useT } from '@i18n/useT'
import { MusicSpectrum } from './MusicSpectrum'
import { Icon } from './ui/Icon'
import './TitlebarMusicControls.css'

interface Props {
  config: AppConfig
  onOpenSettings?: () => void
  onConfigPatch?: (partial: Partial<AppConfig>) => void | Promise<void>
}

export const TitlebarMusicControls: React.FC<Props> = ({ config, onOpenSettings, onConfigPatch }) => {
  const { t } = useT()
  const [installed, setInstalled] = useState<boolean | null>(null)
  const [playing, setPlaying] = useState(false)
  const [activeMood, setActiveMood] = useState<MusicMoodId>(
    (config.musicMood as MusicMoodId) || 'focus',
  )

  useEffect(() => {
    if (config.musicMood) setActiveMood(config.musicMood as MusicMoodId)
  }, [config.musicMood])

  const playlistId = useMemo(() => {
    const raw = (config.musicPlaylistIdsByMood ?? {})[activeMood] ?? ''
    return parseSpotifyPlaylistId(raw) ?? ''
  }, [config.musicPlaylistIdsByMood, activeMood])

  const hasValidPlaylistId = playlistId.length === 22
  const loadingInstall = installed === null
  const noClient = installed === false
  const playPauseDisabled = installed !== true || loadingInstall

  const refreshState = useCallback(async (): Promise<void> => {
    try {
      const [ok, st] = await Promise.all([
        window.api.spotifyDesktopInstalled(),
        window.api.spotifyGetState(),
      ])
      setInstalled(ok)
      setPlaying(ok && st.playerState === 'playing')
    } catch {
      setInstalled(false)
      setPlaying(false)
    }
  }, [])

  useEffect(() => {
    void refreshState()
    const t = window.setInterval(() => { void refreshState() }, 2000)
    return () => window.clearInterval(t)
  }, [refreshState])

  const cycleMood = useCallback(async (): Promise<void> => {
    const ids = MUSIC_MOODS.map(m => m.id)
    const i = ids.indexOf(activeMood)
    const nextId = ids[(i + 1) % ids.length] as MusicMoodId
    setActiveMood(nextId)
    void onConfigPatch?.({ musicMood: nextId })
    if (installed !== true) { void refreshState(); return }
    const r = await window.api.spotifyPause()
    if (!r.ok) console.warn('[Spotify]', r.error)
    void refreshState()
  }, [activeMood, installed, refreshState])

  const onPlayPause = useCallback(async (): Promise<void> => {
    if (installed !== true) return
    if (playing) {
      const r = await window.api.spotifyPause()
      if (!r.ok) console.warn('[Spotify]', r.error)
    } else if (hasValidPlaylistId) {
      const r = await window.api.spotifyPlayPlaylist(playlistId)
      if (!r.ok) console.warn('[Spotify]', r.error)
    } else {
      onOpenSettings?.()
    }
    void refreshState()
  }, [hasValidPlaylistId, installed, onOpenSettings, playing, playlistId, refreshState])

  const moodLabel = t(`music.moods.${activeMood}` as 'music.moods.focus')

  const playPauseTitle = playing
    ? t('music.pause')
    : hasValidPlaylistId
      ? t('music.playPlaylist', { mood: moodLabel })
      : t('music.configurePlaylist', { mood: moodLabel })

  if (noClient) {
    return (
      <div className="titlebar-music">
        <span className="titlebar-music-mood" aria-hidden>—</span>
      </div>
    )
  }

  return (
    <div className="titlebar-music">
      <MoodButton
        label={moodLabel}
        disabled={playPauseDisabled}
        title={t('music.nextMoodTitle')}
        onClick={() => void cycleMood()}
      />
      {installed === true && <MusicSpectrum animating={playing} />}
      <PlayPauseButton
        playing={playing}
        disabled={playPauseDisabled}
        title={playPauseTitle}
        onClick={() => void onPlayPause()}
      />
    </div>
  )
}

interface MoodButtonProps {
  label: string
  disabled: boolean
  title: string
  onClick: () => void
}

const MoodButton: React.FC<MoodButtonProps> = ({ label, disabled, title, onClick }) => (
  <button
    type="button"
    tabIndex={-1}
    className="titlebar-music-btn titlebar-music-btn--mood"
    aria-label={title}
    onClick={onClick}
    disabled={disabled}
  >
    <span className="titlebar-music-mood">{label}</span>
  </button>
)

interface PlayPauseButtonProps {
  playing: boolean
  disabled: boolean
  title: string
  onClick: () => void
}

const PlayPauseButton: React.FC<PlayPauseButtonProps> = ({ playing, disabled, title, onClick }) => (
  <button
    type="button"
    tabIndex={-1}
    className="titlebar-music-btn"
    aria-label={title}
    onClick={onClick}
    disabled={disabled}
  >
    <Icon name={playing ? 'pause' : 'play'} size={14} />
  </button>
)
