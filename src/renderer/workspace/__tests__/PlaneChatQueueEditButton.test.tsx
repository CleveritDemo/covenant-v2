/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PlaneChatQueueEditButton } from '../PlaneChatQueueEditButton'

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

describe('PlaneChatQueueEditButton', () => {
  it('muestra el tooltip del kit con el title al hacer hover', () => {
    render(
      <PlaneChatQueueEditButton
        position={1}
        text="seguir con el fix"
        emptyText="(vacío)"
        images={[]}
        title="Editar mensaje en cola"
        onClick={() => {}}
      />,
    )

    hover(screen.getByRole('button'), 400)
    expect(screen.getByRole('tooltip').textContent).toBe('Editar mensaje en cola')
  })
})
