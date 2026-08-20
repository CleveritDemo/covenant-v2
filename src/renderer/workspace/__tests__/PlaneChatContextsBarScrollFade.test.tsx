/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { PlaneChatContextsBar } from '../PlaneChatContextsBar'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

afterEach(cleanup)

function makeThreads(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `t-${index}`,
    title: `Thread ${index}`,
    updatedAt: index,
    createdAt: index,
  }))
}

function mockScrollMetrics(
  el: HTMLElement,
  scrollWidth: number,
  clientWidth: number,
  scrollLeft: number,
): void {
  Object.defineProperty(el, 'scrollWidth', {
    configurable: true,
    value: scrollWidth,
  })
  Object.defineProperty(el, 'clientWidth', {
    configurable: true,
    value: clientWidth,
  })
  Object.defineProperty(el, 'scrollLeft', {
    configurable: true,
    writable: true,
    value: scrollLeft,
  })
}

describe('PlaneChatContextsBar: fade de scroll horizontal', () => {
  it('expone data-scroll-start/end según desborde y posición', () => {
    const { container } = render(
      <PlaneChatContextsBar
        threads={makeThreads(5)}
        activeThreadId="t-0"
        onSelectThread={vi.fn()}
      />,
    )

    const scrollEl = container.querySelector(
      '.plane-chat-contexts-bar__chips-scroll',
    ) as HTMLDivElement
    expect(scrollEl).not.toBeNull()

    mockScrollMetrics(scrollEl, 100, 100, 0)
    fireEvent.scroll(scrollEl)
    expect(scrollEl.getAttribute('data-scroll-start')).toBe('off')
    expect(scrollEl.getAttribute('data-scroll-end')).toBe('off')

    mockScrollMetrics(scrollEl, 500, 200, 0)
    fireEvent.scroll(scrollEl)
    expect(scrollEl.getAttribute('data-scroll-start')).toBe('off')
    expect(scrollEl.getAttribute('data-scroll-end')).toBe('on')

    scrollEl.scrollLeft = 100
    fireEvent.scroll(scrollEl)
    expect(scrollEl.getAttribute('data-scroll-start')).toBe('on')
    expect(scrollEl.getAttribute('data-scroll-end')).toBe('on')
  })
})
