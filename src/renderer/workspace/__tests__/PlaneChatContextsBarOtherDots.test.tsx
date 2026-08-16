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

function backgroundDotsGroup(): HTMLElement | null {
  return screen.queryByRole('group', { name: 'agentPane.threadBusyDotsAria' })
}

describe('PlaneChatContextsBar: dots de hilos en segundo plano', () => {
  it('solo el hilo activo corriendo: no hay dots extra (el chip ya lleva el suyo)', () => {
    render(
      <PlaneChatContextsBar
        threads={threads}
        activeThreadId="t-1"
        runningThreadIds={['t-1']}
        onSelectThread={() => undefined}
      />,
    )
    expect(backgroundDotsGroup()).toBeNull()
  })

  it('un hilo de fondo corriendo: un dot pegado al chip activo', () => {
    render(
      <PlaneChatContextsBar
        threads={threads}
        activeThreadId="t-1"
        runningThreadIds={['t-1', 't-2']}
        runningThreadActivities={{ 't-2': 'Revisa tests' }}
        onSelectThread={() => undefined}
      />,
    )
    const dots = backgroundDotsGroup()
    expect(dots).not.toBeNull()
    expect(dots!.querySelectorAll('.plane-busy-dot')).toHaveLength(1)
    expect(dots!.closest('.plane-chat-contexts-bar__center')).not.toBeNull()
    expect(dots!.nextElementSibling?.classList.contains('plane-chat-contexts-bar__chips')).toBe(true)
  })

  it('clic en dot de fondo cambia de conversación', () => {
    const onSelectThread = vi.fn()
    render(
      <PlaneChatContextsBar
        threads={threads}
        activeThreadId="t-1"
        runningThreadIds={['t-2']}
        onSelectThread={onSelectThread}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'agentPane.threadBackgroundDotAria' }))
    expect(onSelectThread).toHaveBeenCalledWith('t-2')
  })
})
