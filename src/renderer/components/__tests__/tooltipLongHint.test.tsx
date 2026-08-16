/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Tooltip } from '../ui/Tooltip'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe('Tooltip long hint', () => {
  it('muestra la ruta completa del hint sin truncar', () => {
    const hint = '/Users/x/Documents/grupocredito'
    render(
      <Tooltip content="Change project folder" hint={hint}>
        <button>chip</button>
      </Tooltip>,
    )

    fireEvent.mouseEnter(screen.getByText('chip'))
    act(() => { vi.advanceTimersByTime(400) })

    const tip = screen.getByRole('tooltip')
    expect(tip.textContent).toContain(hint)
  })
})
