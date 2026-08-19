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

function chipLabels(container: HTMLElement): string[] {
  const region = container.querySelector('.plane-chat-contexts-bar__chips')
  expect(region).not.toBeNull()
  return [...region!.querySelectorAll('.plane-chat-contexts-bar__chip-label')]
    .map(node => node.textContent?.trim() ?? '')
}

describe('PlaneChatContextsBar: chip de delegación sin título', () => {
  const humanThread = {
    id: 't-human',
    title: 'Objetivo humano',
    updatedAt: 1,
    createdAt: 1,
  }
  const delegationThread = {
    id: 't-delegation',
    title: '',
    updatedAt: 2,
    createdAt: 2,
    origin: 'delegation' as const,
    delegationId: 'del-1',
  }

  it('muestra delegatingTitle, dispara onSelectThread y conserva el chip humano', () => {
    const onSelectThread = vi.fn()
    const { container } = render(
      <PlaneChatContextsBar
        threads={[humanThread, delegationThread]}
        activeThreadId="t-human"
        runningThreadIds={['t-delegation']}
        onSelectThread={onSelectThread}
      />,
    )

    expect(chipLabels(container)).toEqual([
      'Objetivo humano',
      'agentPane.deleg...',
    ])
    expect(
      container.querySelector('[data-thread-chip-id="t-delegation"] button')
        ?.getAttribute('aria-label'),
    ).toBe('agentPane.delegatingTitle')

    const delegationChip = container.querySelector(
      '[data-thread-chip-id="t-delegation"] button',
    ) as HTMLButtonElement
    expect(delegationChip).not.toBeNull()
    expect(
      delegationChip.querySelector('.plane-busy-dot'),
    ).not.toBeNull()

    fireEvent.click(delegationChip)
    expect(onSelectThread).toHaveBeenCalledWith('t-delegation')
  })
})
