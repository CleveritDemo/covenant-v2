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
  { id: 't-1', title: 'One', updatedAt: 2, createdAt: 1 },
  { id: 't-2', title: 'Two', updatedAt: 1, createdAt: 1 },
]

describe('PlaneChatContextsBar thread history hover', () => {
  it('hover en el chip abre el panel de otros hilos', () => {
    vi.useFakeTimers()
    render(
      <PlaneChatContextsBar
        threads={threads}
        activeThreadId="t-1"
        onSelectThread={() => undefined}
        onRenameThread={() => undefined}
      />,
    )

    const chipHost = screen.getByLabelText('One').closest('.plane-chat-contexts-bar__chip-host')
    expect(chipHost).toBeTruthy()

    fireEvent.mouseEnter(chipHost!)
    act(() => {
      vi.advanceTimersByTime(100)
    })

    const panel = screen.getByRole('listbox', { hidden: true })
    expect(panel.classList.contains('plane-chat-thread-history__panel--open')).toBe(true)
    expect(panel.textContent).toContain('Two')
    vi.useRealTimers()
  })
})
