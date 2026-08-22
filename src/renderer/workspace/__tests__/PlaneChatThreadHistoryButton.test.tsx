/**
 * @vitest-environment jsdom
 */
import React, { useId, useRef } from 'react'
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
    this.classList.add('plane-chat-thread-history__panel--open')
    this.setAttribute('data-open', '')
    dispatchToggle(this, 'open')
  }
  proto.hidePopover = function hidePopover(this: HTMLElement) {
    this.classList.remove('plane-chat-thread-history__panel--open')
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

function HistoryHarness({
  threads,
  activeThreadId,
  runningThreadIds,
  onSelectThread,
}: {
  threads: AgentThread[]
  activeThreadId: string
  runningThreadIds: readonly string[]
  onSelectThread: (threadId: string) => void
}): React.ReactElement {
  const panelId = useId().replace(/:/g, '')
  const triggerRef = useRef<HTMLButtonElement>(null)
  return (
    <PlaneChatThreadHistoryButton
      panelId={panelId}
      triggerRef={triggerRef}
      threads={threads}
      activeThreadId={activeThreadId}
      runningThreadIds={runningThreadIds}
      onSelectThread={onSelectThread}
      anchor={hoverProps => (
        <button
          ref={triggerRef}
          type="button"
          onMouseEnter={hoverProps.onMouseEnter}
          onMouseLeave={hoverProps.onMouseLeave}
          onFocusCapture={hoverProps.onFocusCapture}
          onBlurCapture={hoverProps.onBlurCapture}
          onClick={hoverProps.onClick}
          aria-expanded={hoverProps.panelOpen}
        >
          Open
        </button>
      )}
    />
  )
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
  it('con 7+ hilos lista solo los que no están en chips recientes (paginado)', () => {
    render(
      <HistoryHarness
        threads={makeThreads(7)}
        activeThreadId="t-1"
        runningThreadIds={['t-2']}
        onSelectThread={() => undefined}
      />,
    )
    const panel = openHistoryPanel()
    const options = panel.querySelectorAll('[role="option"]')
    expect(options).toHaveLength(1)
    expect(panel.textContent).not.toContain('Thread 1')
    expect(panel.textContent).not.toContain('Thread 2')
    expect(panel.textContent).toContain('Thread 7')
    expect(options[0]?.getAttribute('aria-selected')).toBe('false')
    expect(panel.textContent).not.toContain('agentPane.threadHistory')
  })

  it('scroll al fondo carga la página 2 (+5)', () => {
    render(
      <HistoryHarness
        threads={makeThreads(18)}
        activeThreadId="t-1"
        runningThreadIds={['t-2']}
        onSelectThread={() => undefined}
      />,
    )
    const panel = openHistoryPanel()
    const list = panel.querySelector('.plane-chat-thread-history__list') as HTMLElement
    Object.defineProperty(list, 'scrollTop', { value: 12, writable: true, configurable: true })
    Object.defineProperty(list, 'clientHeight', { value: 100, writable: true, configurable: true })
    Object.defineProperty(list, 'scrollHeight', { value: 120, writable: true, configurable: true })

    expect(panel.querySelectorAll('[role="option"]')).toHaveLength(5)

    fireEvent.scroll(list, { target: list })
    expect(panel.querySelectorAll('[role="option"]')).toHaveLength(10)
  })

  it('click en fila llama onSelectThread y cierra', () => {
    const onSelectThread = vi.fn()
    render(
      <HistoryHarness
        threads={makeThreads(7)}
        activeThreadId="t-1"
        runningThreadIds={['t-2']}
        onSelectThread={onSelectThread}
      />,
    )
    const panel = openHistoryPanel()
    fireEvent.pointerDown(screen.getByRole('option', { name: 'Thread 7' }))
    fireEvent.click(screen.getByRole('option', { name: 'Thread 7' }))

    expect(onSelectThread).toHaveBeenCalledWith('t-7')
    expect(panel.classList.contains('plane-chat-thread-history__panel--open')).toBe(false)
  })

  it('delegaciones en historial van antes que conversaciones humanas', () => {
    const threads: AgentThread[] = [
      { id: 't-1', title: 'Human active', updatedAt: 10 },
      { id: 't-2', title: 'Human two', updatedAt: 8 },
      { id: 't-3', title: 'Human three', updatedAt: 7 },
      { id: 't-4', title: 'Human four', updatedAt: 6 },
      { id: 't-5', title: 'Human five', updatedAt: 5 },
      { id: 't-6', title: 'Human six', updatedAt: 4 },
      { id: 't-7', title: 'Human seven', updatedAt: 3 },
      { id: 'd-1', title: '', updatedAt: 2, origin: 'delegation' },
      { id: 'd-2', title: '', updatedAt: 1, origin: 'delegation' },
    ]
    render(
      <HistoryHarness
        threads={threads}
        activeThreadId="t-1"
        runningThreadIds={['d-1', 'd-2']}
        onSelectThread={() => undefined}
      />,
    )
    const panel = openHistoryPanel()
    const options = panel.querySelectorAll('[role="option"]')
    expect(options).toHaveLength(3)
    expect(options[0]?.textContent).toContain('agentPane.awaitingStatusRunning')
    expect(options[0]?.querySelector('.plane-busy-dot--delegating')).not.toBeNull()
    expect(options[2]?.textContent).toContain('Human seven')
  })

  it('sin contenido de historial no monta el panel', () => {
    render(
      <HistoryHarness
        threads={makeThreads(4)}
        activeThreadId="t-1"
        runningThreadIds={['t-2']}
        onSelectThread={() => undefined}
      />,
    )
    expect(screen.queryByRole('listbox', { hidden: true })).toBeNull()
  })

  it('click en el ancla abre y cierra el panel', () => {
    render(
      <HistoryHarness
        threads={makeThreads(7)}
        activeThreadId="t-1"
        runningThreadIds={['t-2']}
        onSelectThread={() => undefined}
      />,
    )
    const trigger = screen.getByRole('button', { name: 'Open' })
    fireEvent.click(trigger)
    const panel = screen.getByRole('listbox', { hidden: true })
    expect(panel.classList.contains('plane-chat-thread-history__panel--open')).toBe(true)

    fireEvent.click(trigger)
    expect(panel.classList.contains('plane-chat-thread-history__panel--open')).toBe(false)
  })

  it('sin hilos no monta el panel', () => {
    render(
      <HistoryHarness
        threads={[]}
        activeThreadId=""
        runningThreadIds={[]}
        onSelectThread={() => undefined}
      />,
    )
    expect(screen.queryByRole('listbox', { hidden: true })).toBeNull()
  })

  it('Escape cierra el panel abierto', () => {
    render(
      <HistoryHarness
        threads={makeThreads(7)}
        activeThreadId="t-1"
        runningThreadIds={['t-2']}
        onSelectThread={() => undefined}
      />,
    )
    const panel = openHistoryPanel()
    expect(panel.classList.contains('plane-chat-thread-history__panel--open')).toBe(true)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(panel.classList.contains('plane-chat-thread-history__panel--open')).toBe(false)
  })
})
