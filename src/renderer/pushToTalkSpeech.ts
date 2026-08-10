import { useCallback, useEffect, useRef, useState } from 'react'

/** Subconjunto tipado de la Web Speech API (Chromium / Electron). */
interface SpeechRecognitionAlternativeLike {
  transcript: string
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean
  readonly length: number
  [index: number]: SpeechRecognitionAlternativeLike
}

interface SpeechRecognitionEventLike {
  readonly resultIndex: number
  readonly results: {
    readonly length: number
    [index: number]: SpeechRecognitionResultLike
  }
}

interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function speechRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isPushToTalkSpeechSupported(): boolean {
  return speechRecognitionCtor() != null
}

export interface UsePushToTalkSpeechOptions {
  /** BCP-47, p. ej. es-ES / en-US. */
  lang?: string
  /** Transcript final al soltar (ya trim); no se llama si queda vacío. */
  onTranscript: (text: string) => void
  /** Error de permiso / no-soporte / runtime (mensaje corto para UI). */
  onError?: (message: string) => void
}

export interface UsePushToTalkSpeechResult {
  supported: boolean
  listening: boolean
  start: () => void
  stop: () => void
}

/**
 * Push-to-talk con Web Speech API: start al mantener, stop al soltar.
 * Acumula resultados finales (+ interim pendiente) y entrega el transcript.
 */
export function usePushToTalkSpeech(
  options: UsePushToTalkSpeechOptions,
): UsePushToTalkSpeechResult {
  const { lang = 'en-US', onTranscript, onError } = options
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const finalRef = useRef('')
  const interimRef = useRef('')
  const wantListenRef = useRef(false)
  const onTranscriptRef = useRef(onTranscript)
  const onErrorRef = useRef(onError)
  onTranscriptRef.current = onTranscript
  onErrorRef.current = onError

  const supported = isPushToTalkSpeechSupported()

  const cleanupRecognition = useCallback(() => {
    const recognition = recognitionRef.current
    recognitionRef.current = null
    if (!recognition) return
    recognition.onresult = null
    recognition.onerror = null
    recognition.onend = null
    try {
      recognition.abort()
    } catch {
      /* ya parado */
    }
  }, [])

  useEffect(() => () => {
    wantListenRef.current = false
    cleanupRecognition()
  }, [cleanupRecognition])

  const finishSession = useCallback(() => {
    const text = `${finalRef.current}${interimRef.current}`.replace(/\s+/g, ' ').trim()
    finalRef.current = ''
    interimRef.current = ''
    setListening(false)
    recognitionRef.current = null
    if (text) onTranscriptRef.current(text)
  }, [])

  const start = useCallback(() => {
    if (wantListenRef.current) return
    if (!supported) {
      onErrorRef.current?.('unsupported')
      return
    }
    const Ctor = speechRecognitionCtor()
    if (!Ctor) {
      onErrorRef.current?.('unsupported')
      return
    }
    cleanupRecognition()
    finalRef.current = ''
    interimRef.current = ''
    wantListenRef.current = true

    const recognition = new Ctor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = lang
    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        const piece = result[0]?.transcript ?? ''
        if (result.isFinal) finalRef.current += piece
        else interim += piece
      }
      interimRef.current = interim
    }
    recognition.onerror = (event) => {
      const code = event.error ?? 'error'
      // aborted: stop/abort voluntario; no es error de UX.
      if (code !== 'aborted' && code !== 'no-speech') {
        onErrorRef.current?.(code)
      }
      wantListenRef.current = false
      // Algunos errores no disparan onend a tiempo; desbloquear UI ya.
      setListening(false)
    }
    recognition.onend = () => {
      if (!wantListenRef.current) {
        finishSession()
        return
      }
      // Chromium a veces corta continuous; reanudar si seguimos pulsando.
      try {
        recognition.start()
      } catch {
        wantListenRef.current = false
        finishSession()
      }
    }

    recognitionRef.current = recognition
    setListening(true)
    try {
      recognition.start()
    } catch {
      wantListenRef.current = false
      setListening(false)
      recognitionRef.current = null
      onErrorRef.current?.('start-failed')
    }
  }, [cleanupRecognition, finishSession, lang, supported])

  const stop = useCallback(() => {
    if (!wantListenRef.current && !recognitionRef.current) return
    wantListenRef.current = false
    const recognition = recognitionRef.current
    if (!recognition) {
      finishSession()
      return
    }
    try {
      recognition.stop()
    } catch {
      finishSession()
    }
  }, [finishSession])

  return { supported, listening, start, stop }
}
