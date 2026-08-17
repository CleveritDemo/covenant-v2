/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PlaneFabStack } from '../PlaneFabStack'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

/** Hover con timers falsos: mouseEnter + avance del reloj dentro de act(). */
function hover(el: HTMLElement, ms: number): void {
  fireEvent.mouseEnter(el)
  act(() => { vi.advanceTimersByTime(ms) })
}

const baseProps = {
  canAdd: true,
  agentTitle: 'Agregar agente',
  terminalTitle: 'Agregar terminal',
  onAddAgent: vi.fn(),
  onAddTerminal: vi.fn(),
}

describe('PlaneFabStack', () => {
  it('con showTerminal=false no monta el stack izquierdo y sí el derecho', () => {
    const { container } = render(<PlaneFabStack {...baseProps} showTerminal={false} />)
    expect(container.querySelector('.plane-fab-stack--left')).toBeNull()
    expect(container.querySelector('.plane-fab-stack--right')).not.toBeNull()
  })

  it('con elevated ambos stacks llevan plane-fab-stack--elevated', () => {
    const { container } = render(<PlaneFabStack {...baseProps} elevated />)
    const stacks = container.querySelectorAll('.plane-fab-stack')
    expect(stacks.length).toBe(2)
    for (const stack of stacks) {
      expect(stack.classList.contains('plane-fab-stack--elevated')).toBe(true)
    }
  })

  it('el click con puntero en el FAB de terminal suelta el foco', () => {
    const onAddTerminal = vi.fn()
    const { container } = render(
      <PlaneFabStack {...baseProps} onAddTerminal={onAddTerminal} />,
    )
    const btn = container.querySelector('.plane-fab--terminal') as HTMLButtonElement
    btn.focus()
    fireEvent.click(btn, { detail: 1 })
    expect(onAddTerminal).toHaveBeenCalledTimes(1)
    expect(document.activeElement).not.toBe(btn)
  })

  it('el disparo por teclado conserva el foco en el FAB', () => {
    const onAddTerminal = vi.fn()
    const { container } = render(
      <PlaneFabStack {...baseProps} onAddTerminal={onAddTerminal} />,
    )
    const btn = container.querySelector('.plane-fab--terminal') as HTMLButtonElement
    btn.focus()
    fireEvent.click(btn, { detail: 0 })
    expect(onAddTerminal).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(btn)
  })

  it('el FAB de agente usa bot-plus a 22px (aspa en lugar del pie derecho)', () => {
    const { container } = render(<PlaneFabStack {...baseProps} />)
    const svg = container.querySelector('.plane-fab--agent svg')!
    expect(svg.getAttribute('width')).toBe('22')
    expect(svg.getAttribute('height')).toBe('22')
    const paths = Array.from(svg.querySelectorAll('path')).map(p => p.getAttribute('d'))
    expect(paths).toContain('M19 19v4')
    expect(paths).toContain('M17 21h4')
    expect(paths).not.toContain('M15 18v2')
  })

  it('muestra el hint del atajo en el Tooltip al hover del FAB de terminal', () => {
    const { container } = render(
      <PlaneFabStack {...baseProps} terminalHint="⌘Y · Terminal con explorador" />,
    )
    const anchor = container.querySelector('.plane-fab--terminal')!.closest('.ui-tooltip') as HTMLElement
    hover(anchor, 400)
    const tip = screen.getByRole('tooltip')
    expect(tip.textContent).toContain('Agregar terminal')
    expect(tip.textContent).toContain('⌘Y · Terminal con explorador')
  })
})
