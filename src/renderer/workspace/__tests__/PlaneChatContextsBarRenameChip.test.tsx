/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { truncateThreadChipLabel } from '@shared/agentThreads'
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

const cssPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../PlaneChatContextsBar.css',
)

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

describe('PlaneChatContextsBar active chip host no-shrink', () => {
  it('chip-host declara flex 0 0 auto y tope 176px', () => {
    const css = readFileSync(cssPath, 'utf8')
    const hostBlock = css.match(/\.plane-chat-contexts-bar__chip-host\s*\{[^}]+\}/)?.[0] ?? ''

    expect(hostBlock).toMatch(/flex:\s*0\s+0\s+auto/)
    expect(hostBlock).toMatch(/max-width:\s*176px/)
  })

  it('con la fila llena el chip activo conserva el label recortado, el título accesible y el lápiz', () => {
    const longTitle = 'Un titulo bastante largo para el chip activo'
    const crowdedThreads = [
      {
        id: 't-active',
        title: longTitle,
        updatedAt: 4,
        createdAt: 1,
      },
      { id: 't-2', title: 'Dos', updatedAt: 3, createdAt: 1 },
      { id: 't-3', title: 'Tres', updatedAt: 2, createdAt: 1 },
      { id: 't-4', title: 'Cuatro', updatedAt: 1, createdAt: 1 },
    ]

    render(
      <PlaneChatContextsBar
        threads={crowdedThreads}
        activeThreadId="t-active"
        onSelectThread={vi.fn()}
        onRenameThread={vi.fn()}
      />,
    )

    expect(screen.getByText(truncateThreadChipLabel(longTitle))).toBeTruthy()
    expect(screen.getByRole('option', { name: longTitle })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'agentPane.threadRename' })).toBeTruthy()
  })

  it('el chip activo con título largo queda dentro de Tooltip dentro del host activo', () => {
    const longTitle = 'creo que aca no hay nada que hacer'

    const { container } = render(
      <PlaneChatContextsBar
        threads={[{ id: 't-long', title: longTitle, updatedAt: 2, createdAt: 1 }]}
        activeThreadId="t-long"
        onSelectThread={vi.fn()}
        onRenameThread={vi.fn()}
      />,
    )

    const host = container.querySelector('.plane-chat-contexts-bar__chip-host--active')
    const activeChip = container.querySelector('.plane-chat-contexts-bar__chip--active')
    const tooltip = activeChip?.closest('.ui-tooltip')

    expect(host).toBeTruthy()
    expect(activeChip).toBeTruthy()
    expect(tooltip).toBeTruthy()
    expect(host?.contains(tooltip)).toBe(true)
  })
})
