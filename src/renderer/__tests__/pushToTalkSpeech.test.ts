/**
 * @vitest-environment jsdom
 */
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isPushToTalkSpeechSupported,
  usePushToTalkSpeech,
} from '../pushToTalkSpeech'

type ResultLike = {
  isFinal: boolean
  0: { transcript: string }
  length: number
}

type RecognitionHandlers = {
  onresult: ((event: {
    resultIndex: number
    results: ResultLike[] & { length: number }
  }) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
}

class MockSpeechRecognition implements RecognitionHandlers {
  continuous = false
  interimResults = false
  lang = ''
  onresult: RecognitionHandlers['onresult'] = null
  onerror: RecognitionHandlers['onerror'] = null
  onend: RecognitionHandlers['onend'] = null
  start = vi.fn(() => {})
  stop = vi.fn(() => {
    // Como Chromium: stop() acaba en onend.
    this.onend?.()
  })
  abort = vi.fn(() => {
    this.onend?.()
  })

  emitResult(results: Array<{ transcript: string; isFinal: boolean }>, resultIndex = 0): void {
    const list = results.map(item => ({
      isFinal: item.isFinal,
      0: { transcript: item.transcript },
      length: 1,
    })) as ResultLike[] & { length: number }
    list.length = results.length
    this.onresult?.({ resultIndex, results: list })
  }

  emitError(error: string): void {
    this.onerror?.({ error })
    this.onend?.()
  }
}

let lastRecognition: MockSpeechRecognition | null = null

function installMockCtor(): void {
  lastRecognition = null
  const Ctor = vi.fn(function MockCtor(this: MockSpeechRecognition) {
    const instance = new MockSpeechRecognition()
    lastRecognition = instance
    return instance
  }) as unknown as new () => MockSpeechRecognition
  ;(window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = Ctor
  delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
}

function clearSpeechGlobals(): void {
  const w = window as unknown as {
    SpeechRecognition?: unknown
    webkitSpeechRecognition?: unknown
  }
  delete w.SpeechRecognition
  delete w.webkitSpeechRecognition
  lastRecognition = null
}

afterEach(() => {
  cleanup()
  clearSpeechGlobals()
  vi.restoreAllMocks()
})

describe('isPushToTalkSpeechSupported', () => {
  it('reports unsupported without SpeechRecognition', () => {
    clearSpeechGlobals()
    expect(isPushToTalkSpeechSupported()).toBe(false)
  })

  it('reports supported with webkitSpeechRecognition', () => {
    clearSpeechGlobals()
    ;(window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = vi.fn()
    expect(isPushToTalkSpeechSupported()).toBe(true)
  })
})

describe('usePushToTalkSpeech', () => {
  it('start() sets listening and calls recognition.start', () => {
    installMockCtor()
    const onTranscript = vi.fn()
    const { result } = renderHook(() => usePushToTalkSpeech({ onTranscript }))

    act(() => {
      result.current.start()
    })

    expect(result.current.listening).toBe(true)
    expect(lastRecognition?.start).toHaveBeenCalledTimes(1)
    expect(lastRecognition?.continuous).toBe(true)
    expect(lastRecognition?.interimResults).toBe(true)
  })

  it('final onresult + stop() delivers trimmed transcript and clears listening', () => {
    installMockCtor()
    const onTranscript = vi.fn()
    const { result } = renderHook(() => usePushToTalkSpeech({ onTranscript }))

    act(() => {
      result.current.start()
    })
    act(() => {
      lastRecognition?.emitResult([{ transcript: '  hola mundo  ', isFinal: true }])
    })
    act(() => {
      result.current.stop()
    })

    expect(onTranscript).toHaveBeenCalledTimes(1)
    expect(onTranscript).toHaveBeenCalledWith('hola mundo')
    expect(result.current.listening).toBe(false)
  })

  it('interim-only + stop() still delivers non-empty transcript', () => {
    installMockCtor()
    const onTranscript = vi.fn()
    const { result } = renderHook(() => usePushToTalkSpeech({ onTranscript }))

    act(() => {
      result.current.start()
    })
    act(() => {
      lastRecognition?.emitResult([{ transcript: 'borrador', isFinal: false }])
    })
    act(() => {
      result.current.stop()
    })

    expect(onTranscript).toHaveBeenCalledWith('borrador')
    expect(result.current.listening).toBe(false)
  })

  it('stop() without speech does not call onTranscript', () => {
    installMockCtor()
    const onTranscript = vi.fn()
    const { result } = renderHook(() => usePushToTalkSpeech({ onTranscript }))

    act(() => {
      result.current.start()
    })
    act(() => {
      result.current.stop()
    })

    expect(onTranscript).not.toHaveBeenCalled()
    expect(result.current.listening).toBe(false)
  })

  it('unsupported start() reports onError without crashing', () => {
    clearSpeechGlobals()
    const onTranscript = vi.fn()
    const onError = vi.fn()
    const { result } = renderHook(() => usePushToTalkSpeech({ onTranscript, onError }))

    expect(result.current.supported).toBe(false)
    act(() => {
      result.current.start()
    })

    expect(onError).toHaveBeenCalledWith('unsupported')
    expect(onTranscript).not.toHaveBeenCalled()
    expect(result.current.listening).toBe(false)
  })

  it('onerror not-allowed calls onError and clears listening', () => {
    installMockCtor()
    const onTranscript = vi.fn()
    const onError = vi.fn()
    const { result } = renderHook(() => usePushToTalkSpeech({ onTranscript, onError }))

    act(() => {
      result.current.start()
    })
    expect(result.current.listening).toBe(true)

    act(() => {
      lastRecognition?.emitError('not-allowed')
    })

    expect(onError).toHaveBeenCalledWith('not-allowed')
    expect(result.current.listening).toBe(false)
    expect(onTranscript).not.toHaveBeenCalled()
  })

  it('unmount while listening aborts recognition', () => {
    installMockCtor()
    const onTranscript = vi.fn()
    const { result, unmount } = renderHook(() => usePushToTalkSpeech({ onTranscript }))

    act(() => {
      result.current.start()
    })
    const recognition = lastRecognition
    expect(recognition?.start).toHaveBeenCalled()

    unmount()

    expect(recognition?.abort).toHaveBeenCalled()
  })

  it('second start while already listening is a no-op (single session)', () => {
    installMockCtor()
    const onTranscript = vi.fn()
    const { result } = renderHook(() => usePushToTalkSpeech({ onTranscript }))

    act(() => {
      result.current.start()
    })
    const first = lastRecognition
    const Ctor = (window as unknown as { SpeechRecognition: ReturnType<typeof vi.fn> }).SpeechRecognition

    act(() => {
      result.current.start()
    })

    expect(Ctor).toHaveBeenCalledTimes(1)
    expect(lastRecognition).toBe(first)
    expect(first?.start).toHaveBeenCalledTimes(1)
  })

  it('press → transcript → send: onTranscript is the composer send path', () => {
    installMockCtor()
    const send = vi.fn()
    const { result } = renderHook(() =>
      usePushToTalkSpeech({ onTranscript: text => send(text) }),
    )

    act(() => {
      result.current.start()
    })
    act(() => {
      lastRecognition?.emitResult([
        { transcript: 'enviar ', isFinal: true },
        { transcript: 'esto', isFinal: true },
      ])
    })
    act(() => {
      result.current.stop()
    })

    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith('enviar esto')
    expect(result.current.listening).toBe(false)
  })
})
