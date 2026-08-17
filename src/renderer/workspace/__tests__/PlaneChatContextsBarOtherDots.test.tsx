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

function chipTitles(container: HTMLElement): string[] {
  const chips = chipsRegion(container)
  return [...chips.querySelectorAll('.plane-chat-contexts-bar__chip-label')]
    .map(node => node.textContent?.trim() ?? '')
}

describe('PlaneChatContextsBar: chips de hilos recientes', () => {
  it('solo el hilo activo: no hay chips extra', () => {
    const { container } = render(
      <PlaneChatContextsBar
        threads={[{ id: 't-1', title: 'One', updatedAt: 1_700_000_000_000 }]}
        activeThreadId="t-1"
        runningThreadIds={['t-1']}
        onSelectThread={() => undefined}
      />,
    )
    const chips = chipsRegion(container)
    expect(chips.querySelectorAll('.plane-chat-contexts-bar__chip--recent')).toHaveLength(0)
    expect(chips.querySelector('.plane-chat-contexts-bar__chip--active')).not.toBeNull()
  })

  it('activo a la izquierda; recientes a su derecha por recencia', () => {
    const { container } = render(
      <PlaneChatContextsBar
        threads={threads}
        activeThreadId="t-1"
        runningThreadIds={[]}
        onSelectThread={() => undefined}
      />,
    )
    expect(chipTitles(container)).toEqual(['One', 'Two'])
    const chips = chipsRegion(container)
    expect(chips.querySelector('.plane-chat-contexts-bar__chip--active')?.textContent).toContain('One')
    expect(chips.querySelector('.plane-chat-contexts-bar__chip-host--active')).not.toBeNull()
    expect(chips.querySelectorAll('.plane-chat-contexts-bar__chip--recent')).toHaveLength(1)
  })

  it('hilo reciente sin correr: chip junto al activo', () => {
    const { container } = render(
      <PlaneChatContextsBar
        threads={threads}
        activeThreadId="t-1"
        runningThreadIds={[]}
        onSelectThread={() => undefined}
      />,
    )
    const chips = chipsRegion(container)
    expect(chips.querySelectorAll('.plane-chat-contexts-bar__chip--recent')).toHaveLength(1)
    expect(chips.querySelector('.plane-chat-contexts-bar__chip--recent')?.textContent).toContain('Two')
    expect(chips.querySelector('.plane-chat-contexts-bar__chip--running')).toBeNull()
  })

  it('un hilo de fondo corriendo: chip con título y dot junto al activo', () => {
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
    expect(chips.querySelectorAll('.plane-chat-contexts-bar__chip--recent')).toHaveLength(1)
    expect(chips.querySelector('.plane-chat-contexts-bar__chip--running')?.textContent).toContain('Two')
    expect(chips.querySelector('.plane-chat-contexts-bar__chip--active')).not.toBeNull()
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
    const runningChip = chips.querySelector('.plane-chat-contexts-bar__chip--recent') as HTMLButtonElement
    fireEvent.click(runningChip)
    expect(onSelectThread).toHaveBeenCalledWith('t-2')
  })

  it('título largo en chip se trunca a 15 caracteres con puntos suspensivos', () => {
    const longTitle = 'Conversación muy larga para el chip'
    const { container } = render(
      <PlaneChatContextsBar
        threads={[{ id: 't-1', title: longTitle, updatedAt: 1 }]}
        activeThreadId="t-1"
        onSelectThread={() => undefined}
      />,
    )
    expect(chipTitles(container)[0]).toBe('Conversación mu...')
    expect(
      container.querySelector('.plane-chat-contexts-bar__chip--active')?.getAttribute('aria-label'),
    ).toBe(longTitle)
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
    expect(chipTitles(container)[0]).toBe('One')
    expect(chipTitles(container)[1]).toBe('agentPane.threa...')
    const chip = chipsRegion(container).querySelector('.plane-chat-contexts-bar__chip--recent')
    expect(chip?.textContent).toContain('agentPane.threa...')
  })
})
