/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEffect, useRef } from 'react'
import { createAgentChatSaveSchedule } from '../agentChatSaveSchedule'

type Message = { id: string; content: string }

/** Patrón de guardado del AgentPane: debounce en messages, flush en unmount/thread. */
function useAgentPaneChatSavePattern({
  messages,
  activeThreadId,
  loaded,
  save,
}: {
  messages: Message[]
  activeThreadId: string
  loaded: boolean
  save: (messages: Message[]) => void
}) {
  const chatSaveScheduleRef = useRef(createAgentChatSaveSchedule())
  const prevThreadRef = useRef(activeThreadId)

  useEffect(() => {
    if (!loaded) return
    const schedule = chatSaveScheduleRef.current
    schedule.schedule(() => {
      save(messages)
    })
  }, [activeThreadId, loaded, messages, save])

  useEffect(() => () => {
    chatSaveScheduleRef.current.flush()
  }, [])

  useEffect(() => {
    if (prevThreadRef.current !== activeThreadId) {
      chatSaveScheduleRef.current.flush()
      prevThreadRef.current = activeThreadId
    }
  }, [activeThreadId])
}

/** Anti-patrón: flush en cleanup del effect con dep `[messages]` anula el debounce. */
function useBrokenChatSavePattern({
  messages,
  loaded,
  save,
}: {
  messages: Message[]
  loaded: boolean
  save: (messages: Message[]) => void
}) {
  const chatSaveScheduleRef = useRef(createAgentChatSaveSchedule())

  useEffect(() => {
    if (!loaded) return
    const schedule = chatSaveScheduleRef.current
    schedule.schedule(() => {
      save(messages)
    })
    return () => {
      schedule.flush()
    }
  }, [loaded, messages, save])
}

describe('agentChatSaveDebounce integration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces rapid message deltas without flush in messages cleanup', () => {
    const save = vi.fn<(messages: Message[]) => void>()
    let messages: Message[] = [{ id: '1', content: 'a' }]

    const { rerender } = renderHook(
      ({ msgs }) =>
        useAgentPaneChatSavePattern({
          messages: msgs,
          activeThreadId: 'thread-1',
          loaded: true,
          save,
        }),
      { initialProps: { msgs: messages } },
    )

    for (let i = 2; i <= 5; i += 1) {
      messages = [{ id: String(i), content: `token-${i}` }]
      act(() => {
        rerender({ msgs: messages })
      })
      vi.advanceTimersByTime(50)
    }

    expect(save).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith([{ id: '5', content: 'token-5' }])
  })

  it('flushes pending save on thread change', () => {
    const save = vi.fn<(messages: Message[]) => void>()
    const messages: Message[] = [{ id: '1', content: 'hello' }]

    const { rerender } = renderHook(
      ({ threadId }) =>
        useAgentPaneChatSavePattern({
          messages,
          activeThreadId: threadId,
          loaded: true,
          save,
        }),
      { initialProps: { threadId: 'thread-1' } },
    )

    act(() => {
      rerender({ threadId: 'thread-2' })
    })

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(messages)
  })

  it('flushes pending save on unmount', () => {
    const save = vi.fn<(messages: Message[]) => void>()
    const messages: Message[] = [{ id: '1', content: 'pending' }]

    const { unmount } = renderHook(() =>
      useAgentPaneChatSavePattern({
        messages,
        activeThreadId: 'thread-1',
        loaded: true,
        save,
      }),
    )

    act(() => {
      unmount()
    })

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(messages)
  })

  it('documents regression: flush in messages cleanup saves on every delta', () => {
    const save = vi.fn<(messages: Message[]) => void>()
    let messages: Message[] = [{ id: '1', content: 'a' }]

    const { rerender } = renderHook(
      ({ msgs }) =>
        useBrokenChatSavePattern({
          messages: msgs,
          loaded: true,
          save,
        }),
      { initialProps: { msgs: messages } },
    )

    for (let i = 2; i <= 5; i += 1) {
      messages = [{ id: String(i), content: `token-${i}` }]
      act(() => {
        rerender({ msgs: messages })
      })
    }

    expect(save).toHaveBeenCalledTimes(4)
  })
})
