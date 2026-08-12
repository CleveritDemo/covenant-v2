/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { CeremonyId } from '@shared/agileCeremonies'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

vi.mock('../../components/TerminalModal', () => ({
  TerminalModal: ({
    open,
    children,
    footer,
  }: {
    open: boolean
    children: React.ReactNode
    footer?: React.ReactNode
  }) => (open ? <div>{children}<div>{footer}</div></div> : null),
}))

import { BrainstormCeremonyModal } from '../BrainstormCeremonyModal'
import { BrainstormRoomModal } from '../BrainstormRoomModal'

function agent(id: string, role: string): ProjectAgentDefinition {
  return { id, name: id, role, provider: 'claude', permissionMode: 'plan' }
}

const agents = [
  agent('rodrigo', 'Product Owner'),
  agent('ana', 'QA'),
  agent('nico', 'Dev'),
]

function openBrief(ceremony: CeremonyId, seated = agents): void {
  render(
    <BrainstormRoomModal
      open
      cwd="/repo"
      ceremony={ceremony}
      agents={seated}
      participantAgentIds={seated.map(item => item.id)}
      onClose={() => {}}
      onStarted={() => {}}
    />,
  )
}

describe('BrainstormCeremonyModal — paso 1, antes de los invitados', () => {
  beforeEach(cleanup)

  it('lista las 11 ceremonias y devuelve la elegida al continuar', () => {
    const onContinue = vi.fn()
    render(
      <BrainstormCeremonyModal open onClose={() => {}} onContinue={onContinue} />,
    )
    expect(screen.getByText('Brainstorming')).toBeTruthy()
    expect(screen.getByText('Example Mapping')).toBeTruthy()
    expect(screen.getByText('Sprint Planning')).toBeTruthy()

    fireEvent.click(screen.getByText('Example Mapping'))
    fireEvent.click(screen.getByText('tabs.ceremonyContinue'))
    expect(onContinue).toHaveBeenCalledWith('exampleMapping')
  })

  it('sin tocar nada continúa con el brainstorming libre', () => {
    const onContinue = vi.fn()
    render(
      <BrainstormCeremonyModal open onClose={() => {}} onContinue={onContinue} />,
    )
    fireEvent.click(screen.getByText('tabs.ceremonyContinue'))
    expect(onContinue).toHaveBeenCalledWith('free')
  })

  it('el buscador filtra por nombre', () => {
    render(
      <BrainstormCeremonyModal open onClose={() => {}} onContinue={() => {}} />,
    )
    fireEvent.change(screen.getByPlaceholderText('tabs.ceremonySearchPlaceholder'), {
      target: { value: 'gherkin' },
    })
    expect(screen.queryByText('Event Storming')).toBeNull()
    // Gherkin es un entregable del Specification Workshop.
    expect(screen.getByText('Specification Workshop')).toBeTruthy()
  })
})

describe('BrainstormRoomModal — el brief ya llega con la ceremonia hecha', () => {
  const startBrainstorm = vi.fn()

  beforeEach(() => {
    cleanup()
    startBrainstorm.mockReset()
    ;(window as unknown as { api: Record<string, unknown> }).api = {
      startBrainstorm,
      // El campo de working set descubre contextos al montar.
      discoverTabContexts: () => Promise.resolve({ ok: true, contexts: [] }),
    }
  })

  it('muestra objetivo, entregables y gate, y no vuelve a preguntar la ceremonia', () => {
    openBrief('exampleMapping')
    expect(screen.getByText('tabs.ceremonyGoalExampleMapping')).toBeTruthy()
    expect(screen.getByText('Rules')).toBeTruthy()
    expect(screen.getByText(/tabs\.ceremonyGateExampleMapping/)).toBeTruthy()
    expect(screen.queryByText('tabs.ceremonyPickHint')).toBeNull()
    // Con ceremonia el entregable ya está fijado: no se elige «salida» a mano.
    expect(screen.queryByText('tabs.brainstormOutcomeLabel')).toBeNull()
  })

  it('sienta a PO, QA y Dev de la mesa en los roles de Three Amigos', () => {
    openBrief('threeAmigos')
    expect(screen.getByText('rodrigo')).toBeTruthy()
    expect(screen.getByText('ana')).toBeTruthy()
    expect(screen.getByText('nico')).toBeTruthy()
    expect(screen.queryByText('tabs.ceremonyRoleMissing')).toBeNull()
  })

  it('marca el rol que la mesa no cubre y deja seguir', () => {
    openBrief('threeAmigos', [agents[0], agents[1]])
    expect(screen.getByText('tabs.ceremonyRoleMissing')).toBeTruthy()
    expect(screen.getByText('tabs.ceremonyRolesPartial')).toBeTruthy()
  })

  it('arranca la sala con la ceremonia y sus rondas sugeridas', () => {
    openBrief('specificationWorkshop')
    fireEvent.change(screen.getByPlaceholderText('tabs.brainstormTopicPlaceholder'), {
      target: { value: 'CT-119 solicitud de préstamo' },
    })
    fireEvent.click(screen.getByText('tabs.brainstormStart'))
    expect(startBrainstorm).toHaveBeenCalledTimes(1)
    expect(startBrainstorm.mock.calls[0][0]).toMatchObject({
      ceremony: 'specificationWorkshop',
      maxRounds: 6,
      topic: 'CT-119 solicitud de préstamo',
    })
  })

  it('Brainstorming libre mantiene el selector de salida de siempre', () => {
    openBrief('free')
    expect(screen.getByText('tabs.brainstormOutcomeLabel')).toBeTruthy()
    expect(screen.queryByText('tabs.ceremonyOutputLabel')).toBeNull()
  })
})
