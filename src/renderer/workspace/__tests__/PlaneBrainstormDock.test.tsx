/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { BrainstormLiveSummary } from '../brainstormLiveState'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (
      opts ? `${key}:${Object.values(opts).join(',')}` : key
    ),
  }),
}))

import { PlaneBrainstormDock } from '../PlaneBrainstormDock'

function summary(
  roomId: string,
  topic: string,
  status: BrainstormLiveSummary['status'],
): BrainstormLiveSummary {
  return {
    roomId,
    topic,
    status,
    round: 2,
    maxRounds: 3,
    turnsDone: 5,
    totalTurns: 9,
    speakingAgentId: status === 'running' ? 'cristian' : null,
    speakerName: status === 'running' ? 'Cristian' : '',
    participantAgentIds: ['tl', 'cristian'],
  }
}

afterEach(cleanup)

describe('PlaneBrainstormDock — las salas van en paralelo', () => {
  it('lista todas las salas, no solo una', () => {
    render(
      <PlaneBrainstormDock
        rooms={[
          summary('r1', 'Tenancy: schema o RLS', 'running'),
          summary('r2', 'Retro 0.39.70', 'paused'),
        ]}
        onOpen={vi.fn()}
        onStop={vi.fn()}
        onDiscard={vi.fn()}
      />,
    )
    expect(screen.getByText('Tenancy: schema o RLS')).toBeTruthy()
    expect(screen.getByText('Retro 0.39.70')).toBeTruthy()
    expect(document.querySelectorAll('.plane-brainstorm-dock__row').length).toBe(2)
  })

  it('abrir y detener actúan sobre la sala de esa fila', () => {
    const onOpen = vi.fn()
    const onStop = vi.fn()
    render(
      <PlaneBrainstormDock
        rooms={[
          summary('r1', 'Primera', 'running'),
          summary('r2', 'Segunda', 'running'),
        ]}
        onOpen={onOpen}
        onStop={onStop}
        onDiscard={vi.fn()}
      />,
    )
    const rows = document.querySelectorAll('.plane-brainstorm-dock__row')
    fireEvent.click(rows[1].querySelectorAll('button')[0])
    expect(onOpen).toHaveBeenCalledWith('r2')
    fireEvent.click(rows[0].querySelectorAll('button')[1])
    expect(onStop).toHaveBeenCalledWith('r1')
  })

  it('una sala terminada ofrece soltarla, no detenerla', () => {
    const onDiscard = vi.fn()
    const onStop = vi.fn()
    render(
      <PlaneBrainstormDock
        rooms={[summary('r1', 'Terminada', 'done')]}
        onOpen={vi.fn()}
        onStop={onStop}
        onDiscard={onDiscard}
      />,
    )
    fireEvent.click(screen.getByText('tabs.brainstormDockDiscard'))
    expect(onDiscard).toHaveBeenCalledWith('r1')
    expect(onStop).not.toHaveBeenCalled()
  })

  it('dice dónde queda el acta de una sala que se va de la lista', () => {
    render(
      <PlaneBrainstormDock
        rooms={[summary('r1', 'Viva', 'running')]}
        onOpen={vi.fn()}
        onStop={vi.fn()}
        onDiscard={vi.fn()}
      />,
    )
    expect(screen.getByText('tabs.brainstormDockFinishedHint')).toBeTruthy()
  })

  it('sin salas vivas dice que el botón abre una nueva', () => {
    render(
      <PlaneBrainstormDock
        rooms={[]}
        onOpen={vi.fn()}
        onStop={vi.fn()}
        onDiscard={vi.fn()}
      />,
    )
    expect(screen.getByText('tabs.brainstormRoomsRunningNone')).toBeTruthy()
  })
})
