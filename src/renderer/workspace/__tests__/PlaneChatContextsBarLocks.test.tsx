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
    const activeTab = screen.getByRole('tab', { name: 'One' }) as HTMLButtonElement
    const runningTab = screen.getByRole('tab', { name: 'Two' }) as HTMLButtonElement
    expect(activeTab.disabled).toBe(false)
    expect(runningTab.disabled).toBe(true)
    fireEvent.click(runningTab)
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
    expect(screen.getByRole('tab', { name: 'One' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Two' })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Two' }))
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
    const runningTab = screen.getByRole('tab', { name: 'Two' }) as HTMLButtonElement
    expect(runningTab.disabled).toBe(true)
  })
})
