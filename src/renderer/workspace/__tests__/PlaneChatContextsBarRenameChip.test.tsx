/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
  { id: 't-1', title: 'Uno', updatedAt: 2, createdAt: 1 },
]

describe('PlaneChatContextsBar rename chip 176px', () => {
  it('click en el lápiz abre el input con el título actual', () => {
    render(
      <PlaneChatContextsBar
        threads={threads}
        activeThreadId="t-1"
        onSelectThread={vi.fn()}
        onRenameThread={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'agentPane.threadRename' }))

    const input = screen.getByRole('textbox', { name: 'agentPane.threadRename' })
    expect(input).toBeTruthy()
    expect((input as HTMLInputElement).value).toBe('Uno')
  })

  it('Escape cancela sin llamar onRenameThread y restaura el título', () => {
    const onRenameThread = vi.fn()
    render(
      <PlaneChatContextsBar
        threads={threads}
        activeThreadId="t-1"
        onSelectThread={vi.fn()}
        onRenameThread={onRenameThread}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'agentPane.threadRename' }))
    const input = screen.getByRole('textbox', { name: 'agentPane.threadRename' })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(screen.queryByRole('textbox', { name: 'agentPane.threadRename' })).toBeNull()
    expect(screen.getByText('Uno')).toBeTruthy()
    expect(onRenameThread).not.toHaveBeenCalled()
  })

  it('Enter confirma el título nuevo y cierra el input', () => {
    const onRenameThread = vi.fn()
    render(
      <PlaneChatContextsBar
        threads={threads}
        activeThreadId="t-1"
        onSelectThread={vi.fn()}
        onRenameThread={onRenameThread}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'agentPane.threadRename' }))
    const input = screen.getByRole('textbox', { name: 'agentPane.threadRename' })
    fireEvent.change(input, { target: { value: 'Dos' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onRenameThread).toHaveBeenCalledOnce()
    expect(onRenameThread).toHaveBeenCalledWith('Dos')
    expect(screen.queryByRole('textbox', { name: 'agentPane.threadRename' })).toBeNull()
  })
})
