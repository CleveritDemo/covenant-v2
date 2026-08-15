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

describe('PlaneAgentThreadNodes', () => {
  it('no renderiza si ningún hilo está activo', () => {
    const { container } = render(
      <PlaneAgentThreadNodes
        threads={[
          { id: 't1', title: 'Uno', running: false, active: true },
          { id: 't2', title: 'Dos', running: false, active: false },
        ]}
        onOpenThread={vi.fn()}
      />,
    )

    expect(container.firstChild).toBeNull()
  })

  it('lista hilos activos con dot y petición del usuario', () => {
    const { container } = render(
      <PlaneAgentThreadNodes
        threads={[
          { id: 't1', title: 'Activo', running: true, active: true, activity: 'Arregla el login' },
          { id: 't2', title: 'Fondo', running: true, active: false, activity: 'Revisa los tests' },
          { id: 't3', title: 'Idle', running: false, active: false },
        ]}
        onOpenThread={vi.fn()}
      />,
    )

    const rows = container.querySelectorAll('.plane-agent-thread-nodes__row')
    expect(rows).toHaveLength(2)
    expect(screen.getByText('Arregla el login')).toBeTruthy()
    expect(screen.getByText('Revisa los tests')).toBeTruthy()
    expect(container.querySelectorAll('.plane-busy-dot')).toHaveLength(2)
  })

  it('usa fallback i18n cuando no hay petición', () => {
    render(
      <PlaneAgentThreadNodes
        threads={[
          { id: 't1', title: 'Sin actividad', running: true, active: false },
        ]}
        onOpenThread={vi.fn()}
      />,
    )

    expect(screen.getByText('agentPane.awaitingStatusRunning')).toBeTruthy()
  })

  it('envuelve hilos activos en contenedor de altura animada', () => {
    const { container } = render(
      <PlaneAgentThreadNodes
        threads={[
          { id: 't1', title: 'Uno', running: true, active: true, activity: 'A' },
        ]}
        onOpenThread={vi.fn()}
      />,
    )

    expect(container.querySelector('.plane-agent-thread-nodes-wrap')).toBeTruthy()
  })

  it('pointerdown en fila abre el hilo sin esperar al click', () => {
    const onOpenThread = vi.fn()
    const { container } = render(
      <PlaneAgentThreadNodes
        threads={[
          { id: 't2', title: 'Fondo', running: true, active: false, activity: 'Trabajando' },
        ]}
        onOpenThread={onOpenThread}
      />,
    )

    const row = container.querySelector('.plane-agent-thread-nodes__row')
    fireEvent.pointerDown(row!, { button: 0, bubbles: true })
    fireEvent.click(row!, { bubbles: true })

    expect(onOpenThread).toHaveBeenCalledTimes(1)
    expect(onOpenThread).toHaveBeenCalledWith('t2')
  })

  it('click en fila llama onOpenThread sin propagar', () => {
    const onOpenThread = vi.fn()
    const onContainerClick = vi.fn()
    const { container } = render(
      <div onClick={onContainerClick}>
        <PlaneAgentThreadNodes
          threads={[
            { id: 't2', title: 'Fondo', running: true, active: false, activity: 'Trabajando' },
          ]}
          onOpenThread={onOpenThread}
        />
      </div>,
    )

    const row = container.querySelector('.plane-agent-thread-nodes__row')
    expect(row).toBeTruthy()
    fireEvent.click(row!, { bubbles: true })

    expect(onOpenThread).toHaveBeenCalledWith('t2')
    expect(onContainerClick).not.toHaveBeenCalled()
  })
})
