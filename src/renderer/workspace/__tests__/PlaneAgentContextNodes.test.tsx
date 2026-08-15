/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { PlaneAgentContextChip } from '../PlaneAgentContextNodes'
import { PlaneAgentContextNodes } from '../PlaneAgentContextNodes'

afterEach(cleanup)

const chip = (
  overrides: Partial<PlaneAgentContextChip> & Pick<PlaneAgentContextChip, 'id' | 'name' | 'kind'>,
): PlaneAgentContextChip => ({
  kindLabel: overrides.kind,
  icon: 'file',
  color: '#888',
  shared: false,
  ...overrides,
})

describe('PlaneAgentContextNodes', () => {
  it('ordena normales antes que resultados en dos secciones sin labels', () => {
    const { container } = render(
      <PlaneAgentContextNodes
        contexts={[
          chip({ id: 'result-a', name: 'Result A', kind: 'agentResult' }),
          chip({ id: 'notes', name: 'Notes', kind: 'notes' }),
          chip({ id: 'result-b', name: 'Result B', kind: 'agentResult' }),
          chip({ id: 'tree', name: 'Tree', kind: 'folderTree' }),
        ]}
      />,
    )

    const inputs = container.querySelector('.plane-agent-context-nodes--inputs')
    const results = container.querySelector('.plane-agent-context-nodes--results')
    expect(inputs).toBeTruthy()
    expect(results).toBeTruthy()

    expect(container.querySelectorAll('button')).toHaveLength(0)
    expect(container.querySelector('.plane-agent-context-nodes-stack[aria-hidden="true"]')).toBeTruthy()

    expect([...inputs!.querySelectorAll('.plane-agent-context-nodes__item')].map(
      el => el.getAttribute('data-agent-context-chip'),
    )).toEqual(['notes', 'tree'])

    expect([...results!.querySelectorAll('.plane-agent-context-nodes__item')].map(
      el => el.getAttribute('data-agent-context-chip'),
    )).toEqual(['result-a', 'result-b'])

    expect(container.querySelector('.plane-agent-context-nodes__sep')).toBeNull()
    expect(container.querySelectorAll('[role="listitem"]')).toHaveLength(4)
  })

  it('rellena filas según el ancho disponible de la grilla', () => {
    const { container } = render(
      <PlaneAgentContextNodes
        contexts={Array.from({ length: 7 }, (_, index) => (
          chip({ id: `c${index}`, name: `Ctx ${index}`, kind: 'notes' })
        ))}
      />,
    )

    const grid = container.querySelector('.plane-agent-context-nodes--inputs')
    expect(grid).toBeTruthy()
    expect(container.querySelectorAll('.plane-agent-context-nodes__item')).toHaveLength(7)
    expect(container.querySelectorAll('.ui-tooltip')).toHaveLength(0)
    expect(container.querySelectorAll('button')).toHaveLength(0)
  })

  it('con onOpenAgent los chips son botones interactivos', () => {
    const onOpenAgent = vi.fn()
    const { container } = render(
      <PlaneAgentContextNodes
        contexts={[chip({ id: 'notes', name: 'Notes', kind: 'notes' })]}
        onOpenAgent={onOpenAgent}
      />,
    )
    const button = container.querySelector('button.plane-context-card')
    expect(button).toBeTruthy()
    button!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onOpenAgent).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.plane-agent-context-nodes-stack[aria-hidden="true"]')).toBeNull()
  })

  it('marca entradas con contenedor y results solo con monograma', () => {
    const { container } = render(
      <PlaneAgentContextNodes
        contexts={[
          chip({ id: 'notes', name: 'Notes', kind: 'notes' }),
          chip({ id: 'result', name: 'David', kind: 'agentResult', monogram: 'DV' }),
        ]}
      />,
    )
    expect(container.querySelector('.plane-agent-context-nodes__item--input')).toBeTruthy()
    expect(container.querySelector('.plane-context-card--input')).toBeTruthy()
    expect(container.querySelector('.plane-context-card--result-plain')).toBeTruthy()
    expect(container.querySelector('.plane-context-card--compact')).toBeTruthy()
    expect(container.querySelector('.plane-agent-context-nodes--results .plane-context-card--compact')).toBeNull()
    expect(container.querySelector('.plane-context-card--decorative')).toBeTruthy()
    expect(container.querySelector('.plane-context-card__monogram')?.textContent).toBe('DV')
  })
})
