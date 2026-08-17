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

describe('PlaneChatContextsBar rename', () => {
  it('permite renombrar un hilo sin título visible', () => {
    const onRenameThread = vi.fn()
    render(
      <PlaneChatContextsBar
        threads={[{ id: 't-1', title: '\u200B', updatedAt: 1, createdAt: 1 }]}
        activeThreadId="t-1"
        onSelectThread={() => undefined}
        onRenameThread={onRenameThread}
      />,
    )

    expect(screen.getByText('agentPane.threa...')).toBeTruthy()
    expect(
      document.querySelector('.plane-chat-contexts-bar__chip-label--placeholder'),
    ).not.toBeNull()

    const editBtn = screen.getByRole('button', { name: 'agentPane.threadRename' })
    fireEvent.click(editBtn)

    const input = screen.getByLabelText('agentPane.threadRename') as HTMLInputElement
    expect(input).toBeTruthy()
    fireEvent.change(input, { target: { value: 'Mi hilo' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onRenameThread).toHaveBeenCalledWith('Mi hilo')
  })

  it('deja el lápiz clicable en el chip activo sin hover', () => {
    render(
      <PlaneChatContextsBar
        threads={[{ id: 't-1', title: '', updatedAt: 1, createdAt: 1 }]}
        activeThreadId="t-1"
        onSelectThread={() => undefined}
        onRenameThread={() => undefined}
      />,
    )

    const editBtn = screen.getByRole('button', { name: 'agentPane.threadRename' })
    expect(editBtn.className).toContain('plane-chat-contexts-bar__chip-edit')
    expect(getComputedStyle(editBtn).pointerEvents).not.toBe('none')
    expect(
      editBtn.closest('.plane-chat-contexts-bar__chip-host--active'),
    ).not.toBeNull()
  })
})
