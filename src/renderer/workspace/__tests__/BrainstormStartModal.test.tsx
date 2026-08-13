/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

import { BrainstormStartModal } from '../BrainstormStartModal'

function agent(id: string, role: string): ProjectAgentDefinition {
  return { id, name: id, role, provider: 'claude', permissionMode: 'plan' }
}

const agents = [
  agent('rodrigo', 'Product Owner'),
  agent('ana', 'QA'),
  agent('nico', 'Dev'),
]

const startBrainstorm = vi.fn()

/** Sienta pulsando su tarjeta en la columna de invitados. */
function seat(name: string): void {
  const right = document.querySelector('.brainstorm-overlay__col--right') as HTMLElement
  const card = [...right.querySelectorAll('.brainstorm-seat--invite')]
    .find(node => node.textContent?.includes(name))
  fireEvent.click(card as HTMLElement)
}

function open(initial: string[] = []): void {
  render(
    <BrainstormStartModal
      open
      cwd="/repo"
      agents={agents}
      onClose={() => {}}
      onStarted={() => {}}
    />,
  )
  // El orden en que se sientan es el orden en que hablan.
  initial.forEach(seat)
}

function typeGoal(text: string): void {
  fireEvent.change(screen.getByPlaceholderText('tabs.brainstormTopicPlaceholder'), {
    target: { value: text },
  })
}

beforeEach(() => {
  cleanup()
  startBrainstorm.mockReset()
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    startBrainstorm,
    // El campo de material descubre contextos al montar.
    discoverTabContexts: () => Promise.resolve({ ok: true, contexts: [] }),
  }
})

describe('BrainstormStartModal — todo el arranque en una pantalla', () => {
  it('con el objetivo y dos invitados ya se puede empezar, sin tocar ajustes', () => {
    open()
    typeGoal('¿Schema o row-level security?')
    seat('rodrigo')
    seat('ana')
    fireEvent.click(screen.getByText('tabs.brainstormStart'))

    expect(startBrainstorm).toHaveBeenCalledTimes(1)
    expect(startBrainstorm.mock.calls[0][0]).toMatchObject({
      topic: '¿Schema o row-level security?',
      participantAgentIds: ['rodrigo', 'ana'],
      // El formato por defecto es la conversación abierta de siempre.
      ceremony: 'free',
      maxRounds: 3,
    })
  })

  it('sin objetivo no arranca aunque haya invitados', () => {
    open(['rodrigo', 'ana'])
    fireEvent.click(screen.getByText('tabs.brainstormStart'))
    expect(startBrainstorm).not.toHaveBeenCalled()
  })

  it('con un solo invitado no arranca y lo dice', () => {
    open()
    typeGoal('tema')
    seat('rodrigo')
    expect(screen.getByText('tabs.brainstormStartNeedTwo')).toBeTruthy()
    fireEvent.click(screen.getByText('tabs.brainstormStart'))
    expect(startBrainstorm).not.toHaveBeenCalled()
  })

  it('el orden en que se sientan es el que se manda a arrancar', () => {
    open(['rodrigo', 'nico'])
    typeGoal('tema')
    fireEvent.click(screen.getByText('tabs.brainstormStart'))
    expect(startBrainstorm.mock.calls[0][0]).toMatchObject({
      participantAgentIds: ['rodrigo', 'nico'],
    })
  })

  it('el orden de selección es el orden de habla', () => {
    open()
    typeGoal('tema')
    seat('nico')
    seat('ana')
    seat('rodrigo')
    fireEvent.click(screen.getByText('tabs.brainstormStart'))
    expect(startBrainstorm.mock.calls[0][0]).toMatchObject({
      participantAgentIds: ['nico', 'ana', 'rodrigo'],
    })
  })
})

describe('BrainstormStartModal — ajustes', () => {
  it('las 11 ceremonias están a la vista, sin desplegar nada', () => {
    open()
    expect(screen.getByText('Brainstorming')).toBeTruthy()
    expect(screen.getByText('Example Mapping')).toBeTruthy()
    expect(screen.getByText('Sprint Planning')).toBeTruthy()
  })

  it('elegir formato arrastra sus rondas sugeridas', () => {
    open(['rodrigo', 'ana'])
    typeGoal('CT-119 solicitud de préstamo')
    fireEvent.click(screen.getByText('Specification Workshop'))
    fireEvent.click(screen.getByText('tabs.brainstormStart'))
    expect(startBrainstorm.mock.calls[0][0]).toMatchObject({
      ceremony: 'specificationWorkshop',
      maxRounds: 6,
    })
  })

  it('la conversación abierta mantiene el selector de salida; una ceremonia lo quita', () => {
    open()
    expect(screen.getByText('tabs.brainstormOutcomeLabel')).toBeTruthy()
    fireEvent.click(screen.getByText('Example Mapping'))
    expect(screen.queryByText('tabs.brainstormOutcomeLabel')).toBeNull()
  })

  it('avisa de los roles que la ceremonia pide y nadie cubre', () => {
    open(['rodrigo', 'ana'])
    fireEvent.click(screen.getByText('Three Amigos'))
    expect(screen.getByText('tabs.ceremonyRolesPartial')).toBeTruthy()
    seat('nico')
    expect(screen.getByText('tabs.ceremonyRolesCovered')).toBeTruthy()
  })

  it('nombra cada rol de la ceremonia y marca el asiento vacío', () => {
    open(['rodrigo'])
    fireEvent.click(screen.getByText('Three Amigos'))
    // Los tres roles que pide Three Amigos, con nombre propio.
    expect(screen.getByText('agentPane.ceremonyRoleProductOwner')).toBeTruthy()
    expect(screen.getByText('agentPane.ceremonyRoleDev')).toBeTruthy()
    expect(screen.getByText('agentPane.ceremonyRoleQa')).toBeTruthy()
    // Con un solo invitado quedan huecos declarados, no solo un conteo.
    expect(screen.getAllByText('tabs.ceremonyRoleMissing').length).toBeGreaterThan(0)
  })

  it('la conversación abierta no pide roles: solo el orden de habla', () => {
    open(['rodrigo', 'ana'])
    expect(screen.queryByText('tabs.ceremonyRoleMissing')).toBeNull()
    expect(screen.getByText('tabs.brainstormOrderDragHint')).toBeTruthy()
  })
})

describe('BrainstormInviteGrid — identidad del agente', () => {
  it('sin monograma en la ficha se deriva del nombre', () => {
    open()
    // agentMonogram('rodrigo') → RO, un solo término.
    expect(screen.getByText('RO')).toBeTruthy()
    expect(screen.getByText('AN')).toBeTruthy()
    expect(screen.getByText('NI')).toBeTruthy()
  })

  it('el monograma de la ficha manda sobre el derivado del nombre', () => {
    render(
      <BrainstormStartModal
        open
        cwd="/repo"
        agents={[
          { ...agent('vanesa', 'qa expert'), name: 'Vanesa', monogram: 'QA' },
          agent('ana', 'tester'),
        ]}
        onClose={() => {}}
        onStarted={() => {}}
      />,
    )
    expect(screen.getByText('QA')).toBeTruthy()
    // 'Vanesa' derivaría 'VA': el campo de la ficha lo reemplaza.
    expect(screen.queryByText('VA')).toBeNull()
  })

  it('el rol de ceremonia desplaza al texto libre en la tarjeta', () => {
    render(
      <BrainstormStartModal
        open
        cwd="/repo"
        agents={[
          { ...agent('vanesa', 'qa expert'), name: 'Vanesa', ceremonyRole: 'qa' },
          agent('ana', 'tester'),
        ]}
        onClose={() => {}}
        onStarted={() => {}}
      />,
    )
    expect(screen.getByText('agentPane.ceremonyRoleQa')).toBeTruthy()
    expect(screen.queryByText('qa expert')).toBeNull()
  })
})

describe('BrainstormStartModal — el plano entero, sin modal', () => {
  it('se monta como overlay del plano, no como modal', () => {
    open()
    expect(document.querySelector('.brainstorm-overlay')).not.toBeNull()
    expect(document.querySelector('.terminal-modal-root')).toBeNull()
  })

  it('formato, material y estimación viven abiertos en la columna, sin desplegable', () => {
    open()
    expect(document.querySelector('.brainstorm-overlay__col--left')).not.toBeNull()
    expect(document.querySelector('.brainstorm-format-list')).not.toBeNull()
    expect(document.querySelector('.brainstorm-estimate')).not.toBeNull()
    expect(screen.queryByText('tabs.brainstormAdvancedLabel')).toBeNull()
  })

  it('los invitados van en la columna de la derecha, donde el plano pone agentes', () => {
    open(['rodrigo'])
    const right = document.querySelector('.brainstorm-overlay__col--right')
    expect(right).not.toBeNull()
    expect(right?.querySelectorAll('.brainstorm-seat--invite').length).toBe(agents.length)
    expect(right?.querySelectorAll('.brainstorm-seat--seated').length).toBe(1)
  })

  it('la sala reserva la franja de la barra de navegación', () => {
    open()
    const overlay = document.querySelector('.brainstorm-overlay')
    expect(overlay?.className).toContain('brainstorm-overlay--setup')
  })
})
