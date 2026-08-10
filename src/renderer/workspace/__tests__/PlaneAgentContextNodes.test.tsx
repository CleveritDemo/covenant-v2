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
  it('separa normales y resultados con un separador sutil', () => {
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
    expect(sep).toBeTruthy()
    expect(sep?.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelectorAll('[role="listitem"]')).toHaveLength(4)
  })

  it('no muestra separador si solo hay normales o solo resultados', () => {
    const { container: onlyNormal } = render(
      <PlaneAgentContextNodes
        contexts={[chip({ id: 'notes', name: 'Notes', kind: 'notes' })]}
        onOpenAgent={vi.fn()}
      />,
    )
    expect(onlyNormal.querySelector('.plane-agent-context-nodes__sep')).toBeNull()
    cleanup()

    const { container: onlyResults } = render(
      <PlaneAgentContextNodes
        contexts={[chip({ id: 'result', name: 'Result', kind: 'agentResult' })]}
        onOpenAgent={vi.fn()}
      />,
    )
    expect(onlyResults.querySelector('.plane-agent-context-nodes__sep')).toBeNull()
  })
})
