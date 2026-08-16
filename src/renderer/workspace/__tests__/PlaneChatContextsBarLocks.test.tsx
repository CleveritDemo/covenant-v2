/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PlaneChatContextsBar } from '../PlaneChatContextsBar'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

afterEach(cleanup)

const threads = [
  { id: 't-1', title: 'One', updatedAt: 1_700_000_000_000, createdAt: 1_700_000_000_000 },
  { id: 't-2', title: 'Two', updatedAt: 1_700_000_100_000, createdAt: 1_700_000_100_000 },
]

function chipsRegion(container: HTMLElement): HTMLElement {
  const region = container.querySelector('.plane-chat-contexts-bar__chips')
  expect(region).not.toBeNull()
  return region as HTMLElement
}

function activeChipRegion(container: HTMLElement): HTMLElement {
  const region = chipsRegion(container).querySelector('.plane-chat-contexts-bar__chips-active')
  expect(region).not.toBeNull()
  return region as HTMLElement
}

describe('PlaneChatContextsBar locks', () => {
  it('newThreadLocked=true deshabilita el "+"', () => {
    const onNewThread = vi.fn()
    render(
      <PlaneChatContextsBar
        threads={threads}
        activeThreadId="t-1"
        threadSelectionLocked={false}
        newThreadLocked
        onSelectThread={() => undefined}
        onNewThread={onNewThread}
      />,
    )
    const plusBtn = screen.getByRole('button', { name: 'agentPane.threadNew' }) as HTMLButtonElement
    expect(plusBtn.disabled).toBe(true)
    fireEvent.click(plusBtn)
    expect(onNewThread).not.toHaveBeenCalled()
  })

  it('threadSelectionLocked=true bloquea otros chips pero + queda habilitado', () => {
    const onNewThread = vi.fn()
    const onSelectThread = vi.fn()
    const { container } = render(
      <PlaneChatContextsBar
        threads={threads}
        activeThreadId="t-1"
        runningThreadIds={['t-2']}
        threadSelectionLocked
        newThreadLocked={false}
        onSelectThread={onSelectThread}
        onNewThread={onNewThread}
      />,
    )
    const runningOption = chipsRegion(container).querySelector(
      '.plane-chat-contexts-bar__chip--running',
    ) as HTMLButtonElement
    expect(runningOption.disabled).toBe(true)
    fireEvent.click(runningOption)
    expect(onSelectThread).not.toHaveBeenCalled()
    const plusBtn = screen.getByRole('button', { name: 'agentPane.threadNew' }) as HTMLButtonElement
    expect(plusBtn.disabled).toBe(false)
    fireEvent.click(plusBtn)
    expect(onNewThread).toHaveBeenCalledTimes(1)
  })

  it('muestra chip activo y hilos corriendo; permite cambiar si no hay lock', () => {
    const onSelectThread = vi.fn()
    const { container } = render(
      <PlaneChatContextsBar
        threads={threads}
        activeThreadId="t-1"
        runningThreadIds={['t-2']}
        threadSelectionLocked={false}
        onSelectThread={onSelectThread}
      />,
    )
    const chips = chipsRegion(container)
    expect(chips.querySelector('.plane-chat-contexts-bar__chip-host--active')).not.toBeNull()
    fireEvent.click(chips.querySelector('.plane-chat-contexts-bar__chip--running') as HTMLButtonElement)
    expect(onSelectThread).toHaveBeenCalledWith('t-2')
  })

  it('threadSelectionLocked deshabilita chips ajenos aunque haya hilos corriendo', () => {
    const { container } = render(
      <PlaneChatContextsBar
        threads={threads}
        activeThreadId="t-1"
        runningThreadIds={['t-2']}
        threadSelectionLocked
        onSelectThread={() => undefined}
      />,
    )
    const runningOption = chipsRegion(container).querySelector(
      '.plane-chat-contexts-bar__chip--running',
    ) as HTMLButtonElement
    expect(runningOption.disabled).toBe(true)
  })

  it('shows delegating dot on the active chip while awaiting and idle', () => {
    const { container } = render(
      <PlaneChatContextsBar
        threads={threads}
        activeThreadId="t-1"
        awaitingDelegations
        paneCliBusy={false}
        onSelectThread={() => undefined}
      />,
    )
    const active = activeChipRegion(container)
    const activeHost = active.querySelector('.plane-chat-contexts-bar__chip-host--active')
    expect(activeHost?.querySelector('.plane-busy-dot--delegating')).not.toBeNull()
    expect(activeHost?.querySelectorAll('.plane-busy-dot--delegating')).toHaveLength(1)
  })

  it('hides delegating dot on the active chip while CLI is busy', () => {
    const { container } = render(
      <PlaneChatContextsBar
        threads={threads}
        activeThreadId="t-1"
        awaitingDelegations
        paneCliBusy
        onSelectThread={() => undefined}
      />,
    )
    const active = activeChipRegion(container)
    const activeHost = active.querySelector('.plane-chat-contexts-bar__chip-host--active')
    expect(activeHost?.querySelector('.plane-busy-dot')).toBeNull()
    expect(activeHost?.querySelectorAll('.plane-busy-dot--delegating')).toHaveLength(0)
  })
})
