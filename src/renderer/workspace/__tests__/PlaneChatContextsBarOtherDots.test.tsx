/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
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

describe('PlaneChatContextsBar: chips de hilos busy en segundo plano', () => {
  it('solo el hilo activo corriendo: no hay chips extra (el activo ya lleva el suyo)', () => {
    const { container } = render(
      <PlaneChatContextsBar
        threads={threads}
        activeThreadId="t-1"
        runningThreadIds={['t-1']}
        onSelectThread={() => undefined}
      />,
    )
    const chips = chipsRegion(container)
    expect(chips.querySelectorAll('.plane-chat-contexts-bar__chip--running')).toHaveLength(0)
    expect(chips.querySelector('.plane-chat-contexts-bar__chips-active')).not.toBeNull()
  })

  it('un hilo de fondo corriendo: chip con título junto al activo', () => {
    const { container } = render(
      <PlaneChatContextsBar
        threads={threads}
        activeThreadId="t-1"
        runningThreadIds={['t-1', 't-2']}
        runningThreadActivities={{ 't-2': 'Revisa tests' }}
        onSelectThread={() => undefined}
      />,
    )
    const chips = chipsRegion(container)
    expect(chips.querySelectorAll('.plane-chat-contexts-bar__chip--running')).toHaveLength(1)
    expect(chips.querySelector('.plane-chat-contexts-bar__chip--running')?.textContent).toContain('Two')
    expect(chips.querySelector('.plane-chat-contexts-bar__chips-active')).not.toBeNull()
  })

  it('clic en chip de fondo cambia de conversación', () => {
    const onSelectThread = vi.fn()
    const { container } = render(
      <PlaneChatContextsBar
        threads={threads}
        activeThreadId="t-1"
        runningThreadIds={['t-2']}
        onSelectThread={onSelectThread}
      />,
    )
    const chips = chipsRegion(container)
    const runningChip = chips.querySelector('.plane-chat-contexts-bar__chip--running') as HTMLButtonElement
    fireEvent.click(runningChip)
    expect(onSelectThread).toHaveBeenCalledWith('t-2')
  })

  it('hilo delegación sin título: chip muestra threadDelegationTitle', () => {
    const delegationThreads = [
      { id: 't-1', title: 'One', updatedAt: 1, createdAt: 1 },
      {
        id: 'd-1',
        title: '',
        updatedAt: 2,
        createdAt: 2,
        origin: 'delegation' as const,
        delegationId: 'del-1',
      },
    ]
    const { container } = render(
      <PlaneChatContextsBar
        threads={delegationThreads}
        activeThreadId="t-1"
        runningThreadIds={['d-1']}
        runningThreadActivities={{ 'd-1': 'Revisa el parser' }}
        onSelectThread={() => undefined}
      />,
    )
    const chip = chipsRegion(container).querySelector('.plane-chat-contexts-bar__chip--running')
    expect(chip?.textContent).toContain('agentPane.threadDelegationTitle')
  })
})
