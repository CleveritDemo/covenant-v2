/**
 * @vitest-environment jsdom
 */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  classifyDictationError,
  isPushToTalkSpeechSupported,
  usePushToTalkSpeech,
} from '../pushToTalkSpeech'

type DictationMock = {
  dictationAvailable: ReturnType<typeof vi.fn>
  dictationStart: ReturnType<typeof vi.fn>
  dictationStop: ReturnType<typeof vi.fn>
  onDictationError: ReturnType<typeof vi.fn>
  onDictationPartial?: ReturnType<typeof vi.fn>
  onDictationResult?: ReturnType<typeof vi.fn>
}

function installDictationApi(overrides?: Partial<DictationMock>): DictationMock {
  const api: DictationMock = {
    dictationAvailable: vi.fn(async () => ({
      ok: true,
      platform: 'darwin' as NodeJS.Platform,
    })),
    dictationStart: vi.fn(async (_lang?: string) => ({ ok: true })),
    dictationStop: vi.fn(async () => ({ ok: true, text: '' })),
    onDictationError: vi.fn(() => () => {}),
    onDictationPartial: vi.fn(() => () => {}),
    onDictationResult: vi.fn(() => () => {}),
    ...overrides,
  }
  ;(window as unknown as { api: DictationMock }).api = api
  return api
}

function clearApi(): void {
  delete (window as unknown as { api?: unknown }).api
}

afterEach(() => {
  cleanup()
  clearApi()
  vi.restoreAllMocks()
})

describe('classifyDictationError', () => {
  it('maps network to electronUnavailable', () => {
    expect(classifyDictationError('network')).toBe('electronUnavailable')
  })

  it('maps permission-denied and legacy not-allowed', () => {
    expect(classifyDictationError('permission-denied')).toBe('permission')
    expect(classifyDictationError('not-allowed')).toBe('permission')
  })

  it('maps helper-missing to unsupported', () => {
    expect(classifyDictationError('helper-missing')).toBe('unsupported')
  })
})

describe('isPushToTalkSpeechSupported', () => {
  it('reports unsupported without dictation bridge', () => {
    clearApi()
    expect(isPushToTalkSpeechSupported()).toBe(false)
  })

  it('reports supported when preload exposes dictation API', () => {
    installDictationApi()
    expect(isPushToTalkSpeechSupported()).toBe(true)
  })
})

describe('usePushToTalkSpeech', () => {
  it('start() sets listening and calls dictationStart(lang)', async () => {
    const api = installDictationApi()
    const onTranscript = vi.fn()
    const { result } = renderHook(() =>
      usePushToTalkSpeech({ onTranscript, lang: 'es-ES' }),
    )

    act(() => {
      result.current.start()
    })

    expect(result.current.listening).toBe(true)
    await waitFor(() => {
      expect(api.dictationStart).toHaveBeenCalledWith('es-ES')
    })
  })

  it('stop() delivers trimmed transcript and clears listening', async () => {
    const api = installDictationApi({
      dictationStop: vi.fn(async () => ({
        ok: true,
        text: '  hola mundo  ',
      })),
    })
    const onTranscript = vi.fn()
    const { result } = renderHook(() => usePushToTalkSpeech({ onTranscript }))

    act(() => {
      result.current.start()
    })
    await waitFor(() => expect(api.dictationStart).toHaveBeenCalled())
    await act(async () => {
      await Promise.resolve()
    })

    act(() => {
      result.current.stop()
    })

    await waitFor(() => {
      expect(onTranscript).toHaveBeenCalledWith('hola mundo')
      expect(result.current.listening).toBe(false)
    })
  })

  it('stop() without speech does not call onTranscript', async () => {
    const api = installDictationApi()
    const onTranscript = vi.fn()
    const { result } = renderHook(() => usePushToTalkSpeech({ onTranscript }))

    act(() => {
      result.current.start()
    })
    await waitFor(() => expect(api.dictationStart).toHaveBeenCalled())
    await act(async () => {
      await Promise.resolve()
    })

    act(() => {
      result.current.stop()
    })

    await waitFor(() => {
      expect(result.current.listening).toBe(false)
    })
    expect(onTranscript).not.toHaveBeenCalled()
  })

  it('unsupported start() reports onError without crashing', () => {
    clearApi()
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

  it('permission-denied from start clears listening and calls onError', async () => {
    const api = installDictationApi({
      dictationStart: vi.fn(async () => ({
        ok: false,
        error: 'permission-denied',
      })),
    })
    const onTranscript = vi.fn()
    const onError = vi.fn()
    const { result } = renderHook(() => usePushToTalkSpeech({ onTranscript, onError }))

    act(() => {
      result.current.start()
    })
    expect(result.current.listening).toBe(true)

    await waitFor(() => {
      expect(api.dictationStart).toHaveBeenCalled()
      expect(onError).toHaveBeenCalledWith('permission-denied')
      expect(result.current.listening).toBe(false)
    })
    expect(onTranscript).not.toHaveBeenCalled()
  })

  it('network error stays mappable to electron-unavailable UI', async () => {
    const api = installDictationApi({
      dictationStart: vi.fn(async () => ({
        ok: false,
        error: 'network',
      })),
    })
    const onError = vi.fn()
    const { result } = renderHook(() => usePushToTalkSpeech({ onTranscript: vi.fn(), onError }))

    act(() => {
      result.current.start()
    })
    await waitFor(() => expect(api.dictationStart).toHaveBeenCalled())
    await waitFor(() => expect(onError).toHaveBeenCalledWith('network'))
    expect(classifyDictationError('network')).toBe('electronUnavailable')
  })

  it('onDictationError clears listening', async () => {
    let errorCb: ((err: { code: string; message: string }) => void) | null = null
    const api = installDictationApi({
      onDictationError: vi.fn((cb: (err: { code: string; message: string }) => void) => {
        errorCb = cb
        return () => {
          errorCb = null
        }
      }),
    })
    const onError = vi.fn()
    const { result } = renderHook(() => usePushToTalkSpeech({ onTranscript: vi.fn(), onError }))

    await waitFor(() => expect(api.onDictationError).toHaveBeenCalled())

    act(() => {
      result.current.start()
    })
    await waitFor(() => expect(api.dictationStart).toHaveBeenCalled())
    await act(async () => {
      await Promise.resolve()
    })

    act(() => {
      errorCb?.({ code: 'permission-denied', message: 'denied' })
    })

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('permission-denied')
      expect(result.current.listening).toBe(false)
    })
  })

  it('unmount while listening calls dictationStop', async () => {
    const api = installDictationApi()
    const { result, unmount } = renderHook(() =>
      usePushToTalkSpeech({ onTranscript: vi.fn() }),
    )

    act(() => {
      result.current.start()
    })
    await waitFor(() => expect(api.dictationStart).toHaveBeenCalled())

    unmount()

    expect(api.dictationStop).toHaveBeenCalled()
  })

  it('second start while already listening is a no-op', async () => {
    const api = installDictationApi()
    const { result } = renderHook(() => usePushToTalkSpeech({ onTranscript: vi.fn() }))

    act(() => {
      result.current.start()
    })
    act(() => {
      result.current.start()
    })

    await waitFor(() => expect(api.dictationStart).toHaveBeenCalledTimes(1))
  })

  it('press → transcript → send path via onTranscript', async () => {
    const api = installDictationApi({
      dictationStop: vi.fn(async () => ({
        ok: true,
        text: 'enviar esto',
      })),
    })
    const send = vi.fn()
    const { result } = renderHook(() =>
      usePushToTalkSpeech({ onTranscript: text => send(text) }),
    )

    act(() => {
      result.current.start()
    })
    await waitFor(() => expect(api.dictationStart).toHaveBeenCalled())
    await act(async () => {
      await Promise.resolve()
    })

    act(() => {
      result.current.stop()
    })

    await waitFor(() => {
      expect(send).toHaveBeenCalledWith('enviar esto')
      expect(result.current.listening).toBe(false)
    })
  })
})
