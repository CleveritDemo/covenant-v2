/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { PlaneChatThreadBusyDots } from '../PlaneChatThreadBusyDots'

afterEach(cleanup)

describe('PlaneChatThreadBusyDots', () => {
  it('no renderiza nada sin hilos corriendo', () => {
    const { container } = render(
      <PlaneChatThreadBusyDots
        runningThreadIds={[]}
        activeThreadId="t-1"
        ariaLabel="0 conversaciones en ejecución"
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('muestra un dot por hilo busy alineado', () => {
    render(
      <PlaneChatThreadBusyDots
        runningThreadIds={['t-1', 't-2']}
        activeThreadId="t-1"
        ariaLabel="2 conversaciones en ejecución"
      />,
    )
    const status = screen.getByRole('status', { name: '2 conversaciones en ejecución' })
    expect(status.querySelectorAll('.plane-busy-dot')).toHaveLength(2)
  })

  it('marca delegating en hilos con ola abierta tras idle', () => {
    render(
      <PlaneChatThreadBusyDots
        runningThreadIds={['t-1']}
        activeThreadId="t-1"
        awaitingDelegations
        paneCliBusy={false}
        ariaLabel="1 conversación en ejecución"
      />,
    )
    expect(document.querySelector('.plane-busy-dot--delegating')).toBeTruthy()
  })
})
