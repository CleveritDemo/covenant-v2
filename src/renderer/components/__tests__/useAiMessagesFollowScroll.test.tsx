/**
 * @vitest-environment jsdom
 */
import React, { useRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'
import { useAiMessagesFollowScroll } from '../ai/useAiMessagesFollowScroll'

function ScrollHarness({
  initial,
  initialHeight = 1000,
}: {
  initial: Array<{ id: string; isStreaming?: boolean }>
  initialHeight?: number
}): React.ReactElement {
  const [messages, setMessages] = useState(initial)
  const [contentHeight, setContentHeight] = useState(initialHeight)
  const scrollRef = useRef<HTMLDivElement>(null)

  useAiMessagesFollowScroll(messages, true, scrollRef)

  return (
    <div>
      <div
        ref={scrollRef}
        data-testid="messages"
        style={{ height: 100, overflow: 'auto' }}
      >
        <div style={{ height: contentHeight }}>content</div>
      </div>
      <button
        type="button"
        onClick={() => {
          setContentHeight(2000)
          setMessages([{ id: '1', isStreaming: false }])
        }}
      >
        end-stream
      </button>
      <button
        type="button"
        onClick={() => {
          setContentHeight(2000)
          setMessages([{ id: '1', isStreaming: true }, { id: '2', isStreaming: true }])
        }}
      >
        grow-stream
      </button>
      <button
        type="button"
        onClick={() => {
          setContentHeight(2000)
          setMessages([{ id: '1-updated', isStreaming: false }, { id: '2', isStreaming: false }])
        }}
      >
        update-idle
      </button>
    </div>
  )
}

describe('useAiMessagesFollowScroll', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      cb(0)
      return 1
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('keeps following when user was already at the bottom and content grows', async () => {
    const { getByTestId, getByText } = render(
      <ScrollHarness initial={[{ id: '1', isStreaming: true }]} initialHeight={1000} />,
    )
    const el = getByTestId('messages') as HTMLDivElement
    Object.defineProperty(el, 'clientHeight', { value: 100, configurable: true })
    Object.defineProperty(el, 'scrollHeight', {
      get: () => 1000,
      configurable: true,
    })
    el.scrollTop = 900
    el.dispatchEvent(new Event('scroll'))

    Object.defineProperty(el, 'scrollHeight', {
      get: () => 2000,
      configurable: true,
    })

    await act(async () => {
      getByText('grow-stream').click()
    })

    expect(el.scrollTop).toBe(1900)
  })

  it('keeps following during growth even if the user never touched the scrollbar', async () => {
    const { getByTestId, getByText } = render(
      <ScrollHarness initial={[{ id: '1', isStreaming: true }]} initialHeight={200} />,
    )
    const el = getByTestId('messages') as HTMLDivElement
    Object.defineProperty(el, 'clientHeight', { value: 100, configurable: true })
    Object.defineProperty(el, 'scrollHeight', {
      get: () => 200,
      configurable: true,
    })

    Object.defineProperty(el, 'scrollHeight', {
      get: () => 2000,
      configurable: true,
    })

    await act(async () => {
      getByText('grow-stream').click()
    })

    expect(el.scrollTop).toBe(1900)
  })

  it('scrolls to bottom when streaming ends after a growing response', async () => {
    const { getByTestId, getByText } = render(
      <ScrollHarness initial={[{ id: '1', isStreaming: true }]} initialHeight={1000} />,
    )
    const el = getByTestId('messages') as HTMLDivElement
    Object.defineProperty(el, 'clientHeight', { value: 100, configurable: true })
    Object.defineProperty(el, 'scrollHeight', {
      get: () => 1000,
      configurable: true,
    })
    el.scrollTop = 900
    el.dispatchEvent(new Event('scroll'))

    Object.defineProperty(el, 'scrollHeight', {
      get: () => 2000,
      configurable: true,
    })

    await act(async () => {
      getByText('end-stream').click()
    })

    expect(el.scrollTop).toBe(1900)
  })

  it('stops following if the user scrolls up during streaming', async () => {
    const { getByTestId, getByText } = render(
      <ScrollHarness initial={[{ id: '1', isStreaming: true }]} initialHeight={1000} />,
    )
    const el = getByTestId('messages') as HTMLDivElement
    Object.defineProperty(el, 'clientHeight', { value: 100, configurable: true })
    Object.defineProperty(el, 'scrollHeight', {
      get: () => 1000,
      configurable: true,
    })
    el.scrollTop = 900
    el.dispatchEvent(new Event('scroll'))

    el.scrollTop = 200
    el.dispatchEvent(new Event('scroll'))

    Object.defineProperty(el, 'scrollHeight', {
      get: () => 2000,
      configurable: true,
    })

    await act(async () => {
      getByText('grow-stream').click()
    })

    expect(el.scrollTop).toBe(200)
  })

  it('keeps following when content grows after a poisoned scroll event', async () => {
    const { getByTestId, getByText } = render(
      <ScrollHarness initial={[{ id: '1', isStreaming: true }]} initialHeight={1000} />,
    )
    const el = getByTestId('messages') as HTMLDivElement
    Object.defineProperty(el, 'clientHeight', { value: 100, configurable: true })
    let height = 1000
    Object.defineProperty(el, 'scrollHeight', {
      get: () => height,
      configurable: true,
    })
    el.scrollTop = 900
    el.dispatchEvent(new Event('scroll'))

    // El contenido crece y un scroll espurio ve "no near bottom" antes del layout effect.
    height = 2000
    el.dispatchEvent(new Event('scroll'))

    await act(async () => {
      getByText('grow-stream').click()
    })

    expect(el.scrollTop).toBe(1900)
  })

  it('does not scroll when idle and user is reading history', async () => {
    const { getByTestId, getByText } = render(
      <ScrollHarness initial={[{ id: '1', isStreaming: false }]} initialHeight={1000} />,
    )
    const el = getByTestId('messages') as HTMLDivElement
    Object.defineProperty(el, 'clientHeight', { value: 100, configurable: true })
    Object.defineProperty(el, 'scrollHeight', {
      get: () => 1000,
      configurable: true,
    })
    el.scrollTop = 100
    el.dispatchEvent(new Event('scroll'))

    Object.defineProperty(el, 'scrollHeight', {
      get: () => 2000,
      configurable: true,
    })

    await act(async () => {
      getByText('update-idle').click()
    })

    expect(el.scrollTop).toBe(100)
  })
})
