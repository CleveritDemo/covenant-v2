/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PaneToolbarButton } from '../PaneToolbar'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

/** Los timers son falsos: hover + avanzar el reloj dentro de act(). */
function hover(el: HTMLElement, ms: number): void {
  fireEvent.mouseEnter(el)
  act(() => { vi.advanceTimersByTime(ms) })
}

describe('PaneToolbarButton', () => {
  it('muestra el tooltip del kit con el title al hacer hover', () => {
    render(
      <PaneToolbarButton
        icon="git-branch"
        title="Git"
        variant="git"
        onClick={() => {}}
      />,
    )

    hover(screen.getByRole('button'), 400)
    expect(screen.getByRole('tooltip').textContent).toBe('Git')
  })
})
