/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { PlaneFabStack } from '../PlaneFabStack'

afterEach(cleanup)

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
})
