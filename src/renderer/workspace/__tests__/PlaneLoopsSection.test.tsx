/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { PlaneLoopChain } from '@shared/planeLoopChain'
import { PlaneLoopsSection, type PlaneLoopsAgent } from '../PlaneLoopsSection'

vi.mock('@i18n/useT', () => ({ useT: () => ({ t: (key: string) => key }) }))
vi.mock('../../agent/AgentLoopIntervalModal', () => ({
  AgentLoopIntervalModal: () => null,
}))

const agents: PlaneLoopsAgent[] = [
  { agentId: 'karl', title: 'Karl', busy: false },
  { agentId: 'david', title: 'David', busy: false },
]

const setup = (chains: PlaneLoopChain[]) => {
  const onChainsChange = vi.fn()
  render(
    <PlaneLoopsSection
      open
      agents={agents}
      chains={chains}
      onClose={() => {}}
      onChainsChange={onChainsChange}
      onStartChain={() => {}}
      onStopChain={() => {}}
    />,
  )
  return onChainsChange
}

afterEach(cleanup)

describe('PlaneLoopsSection', () => {
  it('crea la cadena desde la propia pista, sin asistente', () => {
    const onChainsChange = setup([])

    fireEvent.click(screen.getByText('tabs.loopsFirstStep'))
    fireEvent.click(screen.getByText('Karl'))
    fireEvent.change(screen.getByLabelText('tabs.loopsObjective'), {
      target: { value: 'revisa el backlog' },
    })
    fireEvent.click(screen.getByText('tabs.loopsAppendStep'))

    expect(onChainsChange).toHaveBeenCalledTimes(1)
    const [created] = onChainsChange.mock.calls[0]![0] as PlaneLoopChain[]
    expect(created!.steps).toEqual([{ agentId: 'karl', objective: 'revisa el backlog' }])
    expect(created!.status).toBe('idle')
  })

  it('edita la interacción en línea al salir del campo', () => {
    const chain: PlaneLoopChain = {
      id: 'c1',
      steps: [{ agentId: 'karl', objective: 'uno' }],
      intervalMs: 60_000,
      status: 'idle',
      cursor: 0,
    }
    const onChainsChange = setup([chain])

    const input = screen.getByLabelText('tabs.loopsObjective') as HTMLInputElement
    fireEvent.change(input, { target: { value: '  dos  ' } })
    fireEvent.blur(input)

    expect(onChainsChange).toHaveBeenCalledWith([
      { ...chain, steps: [{ agentId: 'karl', objective: 'dos' }] },
    ])
  })

  it('bloquea la edición y el alta mientras la cadena corre', () => {
    const chain: PlaneLoopChain = {
      id: 'c1',
      steps: [{ agentId: 'karl', objective: 'uno' }],
      intervalMs: 60_000,
      status: 'running',
      cursor: 0,
    }
    setup([chain])

    expect(screen.getByLabelText('tabs.loopsObjective')).toHaveProperty('readOnly', true)
    expect(screen.queryByText('tabs.loopsAppendStep')).toBeNull()
    expect(screen.getByText('tabs.loopsStepWorking')).toBeTruthy()
  })
})
