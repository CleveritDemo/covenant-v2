import { afterEach, describe, expect, it, vi } from 'vitest'
import { playVoiceMessageSound, resetVoiceMessageSoundForTests } from '../uiSounds'

vi.mock('../assets/sounds/voice-message.mp3?url', () => ({
  default: 'voice-message.mp3',
}))

describe('playVoiceMessageSound', () => {
  afterEach(() => {
    resetVoiceMessageSoundForTests()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('plays from the start on each call', () => {
    const play = vi.fn(async () => {})
    const audio = {
      currentTime: 1,
      play,
    }
    const AudioMock = vi.fn(function Audio() {
      return audio
    })
    vi.stubGlobal('Audio', AudioMock)

    playVoiceMessageSound()
    playVoiceMessageSound()

    expect(AudioMock).toHaveBeenCalledTimes(1)
    expect(audio.currentTime).toBe(0)
    expect(play).toHaveBeenCalledTimes(2)
  })
})
