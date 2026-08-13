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

vi.mock('../../components/TerminalModal', () => ({
  // `size` se expone en el DOM: es lo que se verifica al desplegar los ajustes.
  TerminalModal: ({
    open,
    children,
    footer,
    size,
  }: {
    open: boolean
    children: React.ReactNode
    footer?: React.ReactNode
    size?: string
  }) => (open ? <div data-size={size}>{children}<div>{footer}</div></div> : null),
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

function open(initial: string[] = []): void {
  render(
    <BrainstormStartModal
      open
      cwd="/repo"
      agents={agents}
      initialParticipantIds={initial}
      onClose={() => {}}
      onStarted={() => {}}
    />,
  )
}

function typeGoal(text: string): void {
  fireEvent.change(screen.getByPlaceholderText('tabs.brainstormTopicPlaceholder'), {
    target: { value: text },
  })
}

/** El panel de ajustes solo se monta desplegado: el catálogo vive dentro. */
function expandSettings(): void {
  fireEvent.click(screen.getByText('tabs.brainstormAdvancedLabel'))
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
    fireEvent.click(screen.getByText('rodrigo'))
    fireEvent.click(screen.getByText('ana'))
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
    fireEvent.click(screen.getByText('rodrigo'))
    expect(screen.getByText('tabs.brainstormStartNeedTwo')).toBeTruthy()
    fireEvent.click(screen.getByText('tabs.brainstormStart'))
    expect(startBrainstorm).not.toHaveBeenCalled()
  })

  it('hereda los invitados que ya venían sentados de la mesa', () => {
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
    fireEvent.click(screen.getByText('nico'))
    fireEvent.click(screen.getByText('ana'))
    fireEvent.click(screen.getByText('rodrigo'))
    fireEvent.click(screen.getByText('tabs.brainstormStart'))
    expect(startBrainstorm.mock.calls[0][0]).toMatchObject({
      participantAgentIds: ['nico', 'ana', 'rodrigo'],
    })
  })
})

describe('BrainstormStartModal — ajustes', () => {
  it('las 11 ceremonias siguen disponibles dentro de los ajustes', () => {
    open()
    expect(screen.getByText('tabs.brainstormAdvancedLabel')).toBeTruthy()
    expandSettings()
    expect(screen.getByText('Brainstorming')).toBeTruthy()
    expect(screen.getByText('Example Mapping')).toBeTruthy()
    expect(screen.getByText('Sprint Planning')).toBeTruthy()
  })

  it('elegir formato arrastra sus rondas sugeridas', () => {
    open(['rodrigo', 'ana'])
    typeGoal('CT-119 solicitud de préstamo')
    expandSettings()
    fireEvent.click(screen.getByText('Specification Workshop'))
    fireEvent.click(screen.getByText('tabs.brainstormStart'))
    expect(startBrainstorm.mock.calls[0][0]).toMatchObject({
      ceremony: 'specificationWorkshop',
      maxRounds: 6,
    })
  })

  it('la conversación abierta mantiene el selector de salida; una ceremonia lo quita', () => {
    open()
    expandSettings()
    expect(screen.getByText('tabs.brainstormOutcomeLabel')).toBeTruthy()
    fireEvent.click(screen.getByText('Example Mapping'))
    expect(screen.queryByText('tabs.brainstormOutcomeLabel')).toBeNull()
  })

  it('avisa de los roles que la ceremonia pide y nadie cubre', () => {
    open(['rodrigo', 'ana'])
    expandSettings()
    fireEvent.click(screen.getByText('Three Amigos'))
    expect(screen.getByText('tabs.ceremonyRolesPartial')).toBeTruthy()
    fireEvent.click(screen.getByText('nico'))
    expect(screen.getByText('tabs.ceremonyRolesCovered')).toBeTruthy()
  })

  it('nombra cada rol de la ceremonia y marca el asiento vacío', () => {
    open(['rodrigo'])
    expandSettings()
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
    expect(screen.getByText('tabs.brainstormParticipantsOrderHint')).toBeTruthy()
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

describe('BrainstormStartModal — los ajustes ensanchan en vez de estirar', () => {
  function modalSize(): string | null {
    return document.querySelector('[data-size]')?.getAttribute('data-size') ?? null
  }

  const toggleAdvanced = expandSettings

  it('cerrado cabe en lg; desplegado pide xl para las dos columnas', () => {
    open()
    expect(modalSize()).toBe('lg')
    toggleAdvanced()
    expect(modalSize()).toBe('xl')
  })

  it('volver a plegarlo devuelve el modal a su ancho', () => {
    open()
    toggleAdvanced()
    toggleAdvanced()
    expect(modalSize()).toBe('lg')
  })

  it('el panel reparte el formato y el resto en dos bloques', () => {
    open()
    expandSettings()
    expect(document.querySelector('.brainstorm-start__field--format')).not.toBeNull()
    expect(document.querySelector('.brainstorm-start__more-side')).not.toBeNull()
  })
})
