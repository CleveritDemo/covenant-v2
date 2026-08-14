/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PlaneAgentThreadNodes } from '../PlaneAgentThreadNodes'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}))

afterEach(cleanup)

const threads = [
  { id: 't1', title: 'Primero', running: true, active: true },
  { id: 't2', title: '', running: false, active: false },
]

describe('PlaneAgentThreadNodes', () => {
  it('colapsado muestra el contador de conversaciones cuando ninguno corre', () => {
    const { container } = render(
      <PlaneAgentThreadNodes
        threads={threads}
        expanded={false}
        onToggleExpanded={vi.fn()}
        onOpenThread={vi.fn()}
      />,
    )

    expect(screen.getByText('tabs.planeAgentThreadsConversations')).toBeTruthy()
    expect(container.querySelector('[role="listitem"]')).toBeNull()
    expect(container.querySelector('.plane-agent-thread-nodes__stack')).toBeTruthy()
    expect(container.querySelector('.plane-busy-dot')).toBeNull()
  })

  it('colapsado muestra contador de trabajando y dot cuando hay hilos en curso', () => {
    const { container } = render(
      <PlaneAgentThreadNodes
        threads={[
          { id: 't1', title: 'Activo', running: false, active: true },
          { id: 't2', title: 'Fondo', running: true, active: false },
        ]}
        expanded={false}
        onToggleExpanded={vi.fn()}
        onOpenThread={vi.fn()}
      />,
    )

    expect(screen.getByText('tabs.planeAgentThreadsWorking')).toBeTruthy()
    expect(container.querySelector('.plane-busy-dot')).toBeTruthy()
  })

  it('no renderiza si solo queda el hilo activo', () => {
    const { container } = render(
      <PlaneAgentThreadNodes
        threads={[{ id: 't1', title: 'Solo', running: false, active: true }]}
        expanded={false}
        onToggleExpanded={vi.fn()}
        onOpenThread={vi.fn()}
      />,
    )

    expect(container.firstChild).toBeNull()
  })

  it('click expande', () => {
    const onToggleExpanded = vi.fn()
    const { container } = render(
      <PlaneAgentThreadNodes
        threads={threads}
        expanded={false}
        onToggleExpanded={onToggleExpanded}
        onOpenThread={vi.fn()}
      />,
    )

    const stack = container.querySelector('.plane-agent-thread-nodes__stack')
    expect(stack).toBeTruthy()
    fireEvent.click(stack!, { bubbles: true })

    expect(onToggleExpanded).toHaveBeenCalledTimes(1)
  })

  it('expandido omite el hilo activo y muestra dot en los que corren', () => {
    const { container } = render(
      <PlaneAgentThreadNodes
        threads={[
          { id: 't1', title: 'Activo', running: true, active: true },
          { id: 't2', title: 'Fondo', running: true, active: false },
          { id: 't3', title: 'Idle', running: false, active: false },
        ]}
        expanded
        onToggleExpanded={vi.fn()}
        onOpenThread={vi.fn()}
      />,
    )

    const cards = container.querySelectorAll('.plane-agent-thread-nodes__card')
    expect(cards).toHaveLength(2)
    expect(screen.queryByText('Activo')).toBeNull()
    expect(container.querySelectorAll('.plane-busy-dot')).toHaveLength(1)
  })

  it('click en una tarjeta llama onOpenThread con el id correcto y no propaga al contenedor', () => {
    const onOpenThread = vi.fn()
    const onContainerClick = vi.fn()
    const { container } = render(
      <div onClick={onContainerClick}>
        <PlaneAgentThreadNodes
          threads={threads}
          expanded
          onToggleExpanded={vi.fn()}
          onOpenThread={onOpenThread}
        />
      </div>,
    )

    const cards = container.querySelectorAll('.plane-agent-thread-nodes__card')
    expect(cards).toHaveLength(1)

    fireEvent.click(cards[0]!, { bubbles: true })

    expect(onOpenThread).toHaveBeenCalledWith('t2')
    expect(onContainerClick).not.toHaveBeenCalled()
  })
})
