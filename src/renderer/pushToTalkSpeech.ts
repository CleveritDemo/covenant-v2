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

function clampLevel(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
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
  /** Texto parcial del motor (si llega); vacío mientras solo hay silencio. */
  interim: string
  /** Nivel de mic 0–1 (onDictationLevel); 0 si el backend no emite. */
  level: number
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
  const [interim, setInterim] = useState('')
  const [level, setLevel] = useState(0)
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

  const clearLive = useCallback(() => {
    setListening(false)
    setInterim('')
    setLevel(0)
  }, [])

  const deliverStopResult = useCallback((stopResult: {
    ok?: boolean
    text?: string
    error?: string
  } | null | undefined) => {
    clearLive()
    if (!stopResult?.ok) {
      if (stopResult?.error) reportError(stopResult.error)
      return
    }
    const text = stopResult.text?.replace(/\s+/g, ' ').trim() ?? ''
    if (text) {
      onTranscriptRef.current(text)
      return
    }
    reportError('no-speech')
  }, [clearLive, reportError])

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
    const offPartial = api.onDictationPartial?.(text => {
      if (!wantListenRef.current && !startingRef.current) return
      setInterim(typeof text === 'string' ? text : '')
    })
    const offLevel = api.onDictationLevel?.(value => {
      if (!wantListenRef.current && !startingRef.current) return
      setLevel(clampLevel(value))
    })
    const offError = api.onDictationError?.(err => {
      if (!wantListenRef.current && !startingRef.current) return
      wantListenRef.current = false
      startingRef.current = false
      clearLive()
      reportError(err?.code || 'error')
    })
    return () => {
      cancelled = true
      offPartial?.()
      offLevel?.()
      offError?.()
      if (wantListenRef.current || startingRef.current) {
        wantListenRef.current = false
        startingRef.current = false
        void api.dictationStop().catch(() => {})
      }
    }
  }, [clearLive, reportError])

  const start = useCallback(() => {
    if (wantListenRef.current || startingRef.current) return
    if (!hasNativeDictationApi()) {
      reportError('unsupported')
      return
    }
    wantListenRef.current = true
    startingRef.current = true
    setInterim('')
    setLevel(0)
    setListening(true)
    void window.api.dictationStart(lang).then(result => {
      startingRef.current = false
      if (!wantListenRef.current) {
        void window.api.dictationStop().then(deliverStopResult).catch(() => clearLive())
        return
      }
      if (!result?.ok) {
        wantListenRef.current = false
        clearLive()
        reportError(result?.error || 'start-failed')
      }
    }).catch(() => {
      startingRef.current = false
      wantListenRef.current = false
      clearLive()
      reportError('start-failed')
    })
  }, [clearLive, deliverStopResult, lang, reportError])

  const stop = useCallback(() => {
    if (!wantListenRef.current && !startingRef.current) return
    wantListenRef.current = false
    if (startingRef.current) {
      return
    }
    void window.api.dictationStop().then(deliverStopResult).catch(() => {
      clearLive()
      reportError('error')
    })
  }, [clearLive, deliverStopResult, reportError])

  return { supported, listening, interim, level, start, stop }
}
