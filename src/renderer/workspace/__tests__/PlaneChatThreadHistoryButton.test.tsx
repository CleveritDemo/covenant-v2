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
    <>
      <button ref={triggerRef} type="button" popovertarget={panelId}>
        Open
      </button>
      <PlaneChatThreadHistoryButton
        panelId={panelId}
        triggerRef={triggerRef}
        threads={threads}
        activeThreadId={activeThreadId}
        runningThreadIds={runningThreadIds}
        onSelectThread={onSelectThread}
      />
    </>
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
  it('con 6 hilos lista el resto por recencia sin el activo (paginado)', () => {
    render(
      <HistoryHarness
        threads={makeThreads(6)}
        activeThreadId="t-1"
        runningThreadIds={['t-2']}
        onSelectThread={() => undefined}
      />,
    )
    const panel = openHistoryPanel()
    const options = panel.querySelectorAll('[role="option"]')
    expect(options).toHaveLength(5)
    expect(panel.textContent).not.toContain('Thread 1')
    expect(panel.textContent).toContain('Thread 2')
    expect(panel.textContent).toContain('Thread 3')
    expect(options[0]?.getAttribute('aria-selected')).toBe('false')
    expect(panel.textContent).not.toContain('agentPane.threadHistory')
  })

  it('scroll al fondo carga la página 2 (+5)', () => {
    render(
      <HistoryHarness
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
      <HistoryHarness
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
})
