import { useCallback, useEffect, useRef, useState } from 'react'
import {
  classifyDictationError,
  isIgnorableDictationError,
  type DictationUiErrorKind,
} from '../shared/dictation'

export type { DictationUiErrorKind }
export { classifyDictationError }

function hasNativeDictationApi(): boolean {
  const api = window.api as Window['api'] | undefined
  return Boolean(
    api
    && typeof api.dictationAvailable === 'function'
    && typeof api.dictationStart === 'function'
    && typeof api.dictationStop === 'function',
  )
}

/** true si hay bridge IPC de dictado nativo (Electron); no usa Web Speech. */
export function isPushToTalkSpeechSupported(): boolean {
  return hasNativeDictationApi()
}

export interface UsePushToTalkSpeechOptions {
  /** BCP-47, p. ej. es-ES / en-US. */
  lang?: string
  /** Transcript final al soltar (ya trim); no se llama si queda vacío. */
  onTranscript: (text: string) => void
  /** Código de error corto para mapear a i18n (`classifyDictationError`). */
  onError?: (message: string) => void
}

export interface UsePushToTalkSpeechResult {
  supported: boolean
  listening: boolean
  start: () => void
  stop: () => void
}

/**
 * Push-to-talk vía dictado nativo del SO (macOS SFSpeechRecognizer por IPC).
 * Win/Linux: start reporta unsupported.
 */
export function usePushToTalkSpeech(
  options: UsePushToTalkSpeechOptions,
): UsePushToTalkSpeechResult {
  const { lang = 'en-US', onTranscript, onError } = options
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(() => hasNativeDictationApi())
  const wantListenRef = useRef(false)
  const startingRef = useRef(false)
  const onTranscriptRef = useRef(onTranscript)
  const onErrorRef = useRef(onError)
  onTranscriptRef.current = onTranscript
  onErrorRef.current = onError

  const reportError = useCallback((code: string) => {
    if (isIgnorableDictationError(code)) return
    onErrorRef.current?.(code)
  }, [])

  useEffect(() => {
    let cancelled = false
    const api = window.api
    if (!hasNativeDictationApi()) {
      setSupported(false)
      return
    }
    void api.dictationAvailable().then(info => {
      if (!cancelled) setSupported(Boolean(info?.ok))
    }).catch(() => {
      if (!cancelled) setSupported(false)
    })
    const offError = api.onDictationError?.(err => {
      if (!wantListenRef.current && !startingRef.current) return
      wantListenRef.current = false
      startingRef.current = false
      setListening(false)
      reportError(err?.code || 'error')
    })
    return () => {
      cancelled = true
      offError?.()
      if (wantListenRef.current || startingRef.current) {
        wantListenRef.current = false
        startingRef.current = false
        void api.dictationStop().catch(() => {})
      }
    }
  }, [reportError])

  const start = useCallback(() => {
    if (wantListenRef.current || startingRef.current) return
    if (!hasNativeDictationApi()) {
      reportError('unsupported')
      return
    }
    wantListenRef.current = true
    startingRef.current = true
    setListening(true)
    void window.api.dictationStart(lang).then(result => {
      startingRef.current = false
      if (!wantListenRef.current) {
        // Soltó antes de que arrancara: parar ya.
        void window.api.dictationStop().then(stopResult => {
          setListening(false)
          if (!stopResult?.ok) {
            if (stopResult?.error) reportError(stopResult.error)
            return
          }
          const text = stopResult.text?.replace(/\s+/g, ' ').trim() ?? ''
          if (text) onTranscriptRef.current(text)
        }).catch(() => setListening(false))
        return
      }
      if (!result?.ok) {
        wantListenRef.current = false
        setListening(false)
        reportError(result?.error || 'start-failed')
      }
    }).catch(() => {
      startingRef.current = false
      wantListenRef.current = false
      setListening(false)
      reportError('start-failed')
    })
  }, [lang, reportError])

  const stop = useCallback(() => {
    if (!wantListenRef.current && !startingRef.current) return
    wantListenRef.current = false
    if (startingRef.current) {
      // start() en vuelo: él hará stop al resolver.
      return
    }
    void window.api.dictationStop().then(result => {
      setListening(false)
      if (!result?.ok) {
        if (result?.error) reportError(result.error)
        return
      }
      const text = result.text?.replace(/\s+/g, ' ').trim() ?? ''
      if (text) onTranscriptRef.current(text)
    }).catch(() => {
      setListening(false)
      reportError('error')
    })
  }, [reportError])

  return { supported, listening, start, stop }
}
