/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TabContextIconSwatch } from '../TabContextIconSwatch'

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

describe('TabContextIconSwatch', () => {
  it('muestra el tooltip del kit con el title al hacer hover', () => {
    render(
      <TabContextIconSwatch
        icon="note"
        color="#5ec8ff"
        title="note"
        selected={false}
        onSelect={() => {}}
      />,
    )

    hover(screen.getByRole('radio'), 400)
    expect(screen.getByRole('tooltip').textContent).toBe('note')
  })
})
