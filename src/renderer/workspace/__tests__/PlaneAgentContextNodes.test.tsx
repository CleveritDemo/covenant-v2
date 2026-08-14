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
  it('ordena normales antes que resultados sin separador extra', () => {
    const { container } = render(
      <PlaneAgentContextNodes
        contexts={[
          chip({ id: 'result-a', name: 'Result A', kind: 'agentResult' }),
          chip({ id: 'notes', name: 'Notes', kind: 'notes' }),
          chip({ id: 'result-b', name: 'Result B', kind: 'agentResult' }),
          chip({ id: 'tree', name: 'Tree', kind: 'folderTree' }),
        ]}
        onOpenAgent={vi.fn()}
      />,
    )

    const items = [...container.querySelectorAll('.plane-agent-context-nodes__item')]
    expect(items.map(el => el.querySelector('button')?.getAttribute('aria-label'))).toEqual([
      'Notes',
      'Tree',
      'Result A',
      'Result B',
    ])

    const sep = container.querySelector('.plane-agent-context-nodes__sep')
    expect(sep).toBeNull()
    expect(container.querySelectorAll('[role="listitem"]')).toHaveLength(4)
  })

  it('rellena filas según el ancho disponible de la grilla', () => {
    const { container } = render(
      <PlaneAgentContextNodes
        contexts={Array.from({ length: 7 }, (_, index) => (
          chip({ id: `c${index}`, name: `Ctx ${index}`, kind: 'notes' })
        ))}
        onOpenAgent={vi.fn()}
      />,
    )

    const grid = container.querySelector('.plane-agent-context-nodes')
    expect(grid).toBeTruthy()
    expect(container.querySelectorAll('.plane-agent-context-nodes__item')).toHaveLength(7)
    expect(container.querySelectorAll('.plane-agent-context-nodes__item > .ui-tooltip')).toHaveLength(7)
  })

  it('marca entradas con contenedor y results solo con monograma', () => {
    const { container } = render(
      <PlaneAgentContextNodes
        contexts={[
          chip({ id: 'notes', name: 'Notes', kind: 'notes' }),
          chip({ id: 'result', name: 'David', kind: 'agentResult', monogram: 'DV' }),
        ]}
        onOpenAgent={vi.fn()}
      />,
    )
    expect(container.querySelector('.plane-agent-context-nodes__item--input')).toBeTruthy()
    expect(container.querySelector('.plane-context-card--input')).toBeTruthy()
    expect(container.querySelector('.plane-context-card--result')).toBeNull()
    expect(container.querySelector('.plane-context-card__monogram')?.textContent).toBe('DV')
  })
})
