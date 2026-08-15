/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { PlaneChatContextsBar } from '../PlaneChatContextsBar'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

afterEach(cleanup)

const threads = [
  { id: 't-1', title: 'One', updatedAt: 1_700_000_000_000, createdAt: 1_700_000_000_000 },
  { id: 't-2', title: 'Two', updatedAt: 1_700_000_100_000, createdAt: 1_700_000_100_000 },
]

function otherDots(): HTMLElement | null {
  return screen.queryByRole('status', { name: 'agentPane.threadBusyDotsAria' })
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
    expect(otherDots()).toBeNull()
  })

  it('un hilo de fondo corriendo: un dot junto al chip', () => {
    render(
      <PlaneChatContextsBar
        threads={threads}
        activeThreadId="t-1"
        runningThreadIds={['t-1', 't-2']}
        onSelectThread={() => undefined}
      />,
    )
    const dots = otherDots()
    expect(dots).not.toBeNull()
    expect(dots!.childElementCount).toBe(1)
  })
})
