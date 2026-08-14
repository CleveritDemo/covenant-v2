/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PlaneChatThreadHistoryButton } from '../PlaneChatThreadHistoryButton'
import type { AgentThread } from '@shared/agentThreads'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

/** jsdom no implementa Popover API: polyfill mínimo + evento `toggle`. */
beforeAll(() => {
  const proto = HTMLElement.prototype as HTMLElement & {
    showPopover: () => void
    hidePopover: () => void
    togglePopover: () => boolean
  }

  const dispatchToggle = (el: HTMLElement, newState: 'open' | 'closed'): void => {
    el.dispatchEvent(Object.assign(new Event('toggle'), { newState }))
  }

  proto.showPopover = function showPopover(this: HTMLElement) {
    this.setAttribute('data-open', '')
    dispatchToggle(this, 'open')
  }
  proto.hidePopover = function hidePopover(this: HTMLElement) {
    this.removeAttribute('data-open')
    dispatchToggle(this, 'closed')
  }
  proto.togglePopover = function togglePopover(this: HTMLElement) {
    if (this.hasAttribute('data-open')) {
      this.hidePopover()
      return false
    }
    this.showPopover()
    return true
  }
})

afterEach(cleanup)

function makeThreads(count: number): AgentThread[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `t-${index + 1}`,
    title: `Thread ${index + 1}`,
    updatedAt: count - index,
  }))
}

function openHistoryPanel(): HTMLElement {
  const panel = screen.getByRole('listbox', { hidden: true })
  act(() => {
    panel.dispatchEvent(Object.assign(new Event('toggle'), { newState: 'open' }))
  })
  act(() => {
    panel.showPopover()
  })
  return panel
}

describe('PlaneChatThreadHistoryButton', () => {
  it('con 6 hilos lista todos ordenados por recencia (paginado)', () => {
    render(
      <PlaneChatThreadHistoryButton
        threads={makeThreads(6)}
        activeThreadId="t-1"
        runningThreadIds={['t-2']}
        onSelectThread={() => undefined}
      />,
    )
    const panel = openHistoryPanel()
    const options = panel.querySelectorAll('[role="option"]')
    expect(options).toHaveLength(5)
    expect(panel.textContent).toContain('Thread 1')
    expect(panel.textContent).toContain('Thread 2')
    expect(panel.textContent).toContain('Thread 3')
    expect(options[0]?.getAttribute('aria-selected')).toBe('true')
    expect(options[0]?.className).toContain('plane-chat-thread-history__row--active')
  })

  it('scroll al fondo carga la página 2 (+5)', () => {
    render(
      <PlaneChatThreadHistoryButton
        threads={makeThreads(12)}
        activeThreadId="t-1"
        runningThreadIds={['t-2']}
        onSelectThread={() => undefined}
      />,
    )
    const panel = openHistoryPanel()
    Object.defineProperty(panel, 'scrollTop', { value: 12, writable: true, configurable: true })
    Object.defineProperty(panel, 'clientHeight', { value: 100, writable: true, configurable: true })
    Object.defineProperty(panel, 'scrollHeight', { value: 120, writable: true, configurable: true })

    expect(panel.querySelectorAll('[role="option"]')).toHaveLength(5)

    fireEvent.scroll(panel, { target: panel })
    expect(panel.querySelectorAll('[role="option"]')).toHaveLength(10)
  })

  it('click en fila llama onSelectThread y cierra', () => {
    const onSelectThread = vi.fn()
    render(
      <PlaneChatThreadHistoryButton
        threads={makeThreads(6)}
        activeThreadId="t-1"
        runningThreadIds={['t-2']}
        onSelectThread={onSelectThread}
      />,
    )
    const panel = openHistoryPanel()
    fireEvent.pointerDown(screen.getByRole('option', { name: 'Thread 3' }))
    fireEvent.click(screen.getByRole('option', { name: 'Thread 3' }))

    expect(onSelectThread).toHaveBeenCalledWith('t-3')
    expect(panel.hasAttribute('data-open')).toBe(false)
  })

  it('sin hilos no monta el botón', () => {
    render(
      <PlaneChatThreadHistoryButton
        threads={[]}
        activeThreadId=""
        runningThreadIds={[]}
        onSelectThread={() => undefined}
      />,
    )
    expect(screen.queryByRole('button', { name: 'agentPane.threadHistoryAria' })).toBeNull()
  })

  it('con solo hilos en chips sigue mostrando el botón', () => {
    render(
      <PlaneChatThreadHistoryButton
        threads={makeThreads(2)}
        activeThreadId="t-1"
        runningThreadIds={['t-2']}
        onSelectThread={() => undefined}
      />,
    )
    expect(screen.getByRole('button', { name: 'agentPane.threadHistoryAria' })).toBeTruthy()
  })
})
