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
    render(
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
    const activeChip = screen.getByRole('combobox', { name: 'One' }) as HTMLButtonElement
    const runningOption = screen.getByRole('option', { name: 'Two' }) as HTMLButtonElement
    expect(activeChip.disabled).toBe(false)
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
    render(
      <PlaneChatContextsBar
        threads={threads}
        activeThreadId="t-1"
        runningThreadIds={['t-2']}
        threadSelectionLocked={false}
        onSelectThread={onSelectThread}
      />,
    )
    expect(screen.getByRole('combobox', { name: 'One' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Two' })).toBeTruthy()
    fireEvent.click(screen.getByRole('option', { name: 'Two' }))
    expect(onSelectThread).toHaveBeenCalledWith('t-2')
  })

  it('threadSelectionLocked deshabilita chips ajenos aunque haya hilos corriendo', () => {
    render(
      <PlaneChatContextsBar
        threads={threads}
        activeThreadId="t-1"
        runningThreadIds={['t-2']}
        threadSelectionLocked
        onSelectThread={() => undefined}
      />,
    )
    const runningOption = screen.getByRole('option', { name: 'Two' }) as HTMLButtonElement
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
    const chip = screen.getByRole('combobox', { name: 'One' })
    expect(chip.querySelector('.plane-busy-dot--delegating')).not.toBeNull()
    expect(container.querySelectorAll('.plane-busy-dot--delegating')).toHaveLength(1)
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
    expect(screen.getByRole('combobox', { name: 'One' }).querySelector('.plane-busy-dot')).toBeNull()
    expect(container.querySelectorAll('.plane-busy-dot--delegating')).toHaveLength(0)
  })
})
