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
        loopMode={false}
        loopActive={false}
        threads={threads}
        activeThreadId="t-1"
        threadSelectionLocked={false}
        newThreadLocked
        onToggleLoop={() => undefined}
        onSelectThread={() => undefined}
        onNewThread={onNewThread}
      />,
    )
    const plusBtn = screen.getByRole('button', { name: 'agentPane.threadNew' }) as HTMLButtonElement
    expect(plusBtn.disabled).toBe(true)
    fireEvent.click(plusBtn)
    expect(onNewThread).not.toHaveBeenCalled()
  })

  it('threadSelectionLocked=true bloquea el Select pero + queda habilitado', () => {
    const onNewThread = vi.fn()
    render(
      <PlaneChatContextsBar
        loopMode={false}
        loopActive={false}
        threads={threads}
        activeThreadId="t-1"
        threadSelectionLocked
        newThreadLocked={false}
        onToggleLoop={() => undefined}
        onSelectThread={() => undefined}
        onNewThread={onNewThread}
      />,
    )
    const select = screen.getByRole('button', { name: 'agentPane.threadsLabel' }) as HTMLButtonElement
    expect(select.disabled).toBe(true)
    const plusBtn = screen.getByRole('button', { name: 'agentPane.threadNew' }) as HTMLButtonElement
    expect(plusBtn.disabled).toBe(false)
    fireEvent.click(plusBtn)
    expect(onNewThread).toHaveBeenCalledTimes(1)
  })

  it('con hilos corriendo el Select queda habilitado si no hay loop activo', () => {
    render(
      <PlaneChatContextsBar
        loopMode={false}
        loopActive={false}
        threads={threads}
        activeThreadId="t-1"
        runningThreadIds={['t-2']}
        threadSelectionLocked={false}
        onToggleLoop={() => undefined}
        onSelectThread={() => undefined}
      />,
    )
    const select = screen.getByRole('button', { name: 'agentPane.threadsLabel' }) as HTMLButtonElement
    expect(select.disabled).toBe(false)
  })

  it('loop activo deshabilita el Select aunque haya hilos corriendo', () => {
    render(
      <PlaneChatContextsBar
        loopMode
        loopActive
        threads={threads}
        activeThreadId="t-1"
        runningThreadIds={['t-2']}
        threadSelectionLocked
        onToggleLoop={() => undefined}
        onSelectThread={() => undefined}
      />,
    )
    const select = screen.getByRole('button', { name: 'agentPane.threadsLabel' }) as HTMLButtonElement
    expect(select.disabled).toBe(true)
  })
})
