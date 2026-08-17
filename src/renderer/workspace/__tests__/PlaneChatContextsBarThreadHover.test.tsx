/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PlaneChatContextsBar } from '../PlaneChatContextsBar'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

/** jsdom no implementa Popover API: polyfill mínimo + evento `toggle`. */
beforeAll(() => {
  const proto = HTMLElement.prototype as HTMLElement & {
    showPopover: () => void
    hidePopover: () => void
  }

  const dispatchToggle = (el: HTMLElement, newState: 'open' | 'closed'): void => {
    el.dispatchEvent(Object.assign(new Event('toggle'), { newState }))
  }

  proto.showPopover = function showPopover(this: HTMLElement) {
    this.classList.add('plane-chat-thread-history__panel--open')
    this.setAttribute('data-open', '')
    dispatchToggle(this, 'open')
  }
  proto.hidePopover = function hidePopover(this: HTMLElement) {
    this.classList.remove('plane-chat-thread-history__panel--open')
    this.removeAttribute('data-open')
    dispatchToggle(this, 'closed')
  }
})

afterEach(cleanup)

const threads = [
  { id: 't-1', title: 'One', updatedAt: 7, createdAt: 1 },
  { id: 't-2', title: 'Two', updatedAt: 6, createdAt: 1 },
  { id: 't-3', title: 'Three', updatedAt: 5, createdAt: 1 },
  { id: 't-4', title: 'Four', updatedAt: 4, createdAt: 1 },
  { id: 't-5', title: 'Five', updatedAt: 3, createdAt: 1 },
  { id: 't-6', title: 'Six', updatedAt: 2, createdAt: 1 },
  { id: 't-7', title: 'Seven', updatedAt: 1, createdAt: 1 },
]

describe('PlaneChatContextsBar thread history hover', () => {
  it('hover en el icono de historial abre el panel de otros hilos', () => {
    vi.useFakeTimers()
    render(
      <PlaneChatContextsBar
        threads={threads}
        activeThreadId="t-1"
        onSelectThread={() => undefined}
        onRenameThread={() => undefined}
      />,
    )

    const historyHost = document.querySelector('.plane-chat-contexts-bar__history-host')
    expect(historyHost).toBeTruthy()

    fireEvent.mouseEnter(historyHost!)
    act(() => {
      vi.advanceTimersByTime(100)
    })

    const panel = screen.getByRole('listbox', { hidden: true })
    expect(panel.classList.contains('plane-chat-thread-history__panel--open')).toBe(true)
    expect(panel.textContent).toContain('Seven')
    vi.useRealTimers()
  })
})
