import voiceMessageUrl from './assets/sounds/voice-message.mp3?url'
import finishUrl from './assets/sounds/finish.mp3?url'

let voiceMessageAudio: HTMLAudioElement | null = null
let agentFinishAudio: HTMLAudioElement | null = null

/**
 * SFX al iniciar push-to-talk (botón de micrófono).
 * Best-effort: fallos de autoplay/Audio se ignoran.
 */
export function playVoiceMessageSound(): void {
  try {
    if (typeof Audio === 'undefined') return
    if (!voiceMessageAudio) {
      voiceMessageAudio = new Audio(voiceMessageUrl)
    }
    voiceMessageAudio.currentTime = 0
    void voiceMessageAudio.play().catch(() => {})
  } catch {
    // Sin audio en tests / entornos restringidos.
  }
}

/** Solo tests: resetea el elemento cacheado. */
export function resetVoiceMessageSoundForTests(): void {
  voiceMessageAudio = null
}

/**
 * SFX al completar un turno de agente con éxito.
 * Best-effort: fallos de autoplay/Audio se ignoran.
 */
export function playAgentFinishSound(): void {
  try {
    if (typeof Audio === 'undefined') return
    if (!agentFinishAudio) {
      agentFinishAudio = new Audio(finishUrl)
    }
    agentFinishAudio.currentTime = 0
    void agentFinishAudio.play().catch(() => {})
  } catch {
    // Sin audio en tests / entornos restringidos.
  }
}

/** Solo tests: resetea el elemento cacheado. */
export function resetAgentFinishSoundForTests(): void {
  agentFinishAudio = null
}
