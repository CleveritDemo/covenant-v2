/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PlaneChatBackgroundThreadDots } from '../PlaneChatBackgroundThreadDots'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

afterEach(cleanup)

describe('PlaneChatBackgroundThreadDots', () => {
  it('no renderiza sin dots', () => {
    const { container } = render(
      <PlaneChatBackgroundThreadDots dots={[]} onSelectThread={() => undefined} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('respeta selectionLocked', () => {
    const onSelectThread = vi.fn()
    render(
      <PlaneChatBackgroundThreadDots
        dots={[{
          threadId: 't-2',
          variant: 'busy',
          title: 'Two',
          activity: 'Trabajando',
        }]}
        selectionLocked
        onSelectThread={onSelectThread}
      />,
    )
    const button = screen.getByRole('button', { name: 'agentPane.threadBackgroundDotAria' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
    expect(onSelectThread).not.toHaveBeenCalled()
  })
})
