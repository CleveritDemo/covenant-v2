/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PLANE_CONTEXT_DRAG_MIME } from '../planeContextDrag'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

vi.mock('../PlaneMiniFace', () => ({
  PlaneMiniFace: ({
    name,
    children,
  }: {
    name: string
    children?: React.ReactNode
  }) => (
    <div className="plane-mini-face">
      <span>{name}</span>
      {children}
    </div>
  ),
}))

vi.mock('../PlaneAgentContextNodes', () => ({
  PlaneAgentContextNodes: () => null,
}))

import { BrainstormRosterColumn } from '../BrainstormRosterColumn'

function agent(id: string, name: string): ProjectAgentDefinition {
  return { id, name, provider: 'claude', permissionMode: 'plan' }
}

beforeEach(() => {
  cleanup()
})

describe('BrainstormRosterColumn', () => {
  it('muestra los nombres de los agentes invitables', () => {
    render(
      <BrainstormRosterColumn
        agents={[agent('ana', 'Ana'), agent('rodrigo', 'Rodrigo')]}
        contexts={[]}
        cwd="/tmp"
      />,
    )
    expect(screen.getByText('Ana')).toBeTruthy()
    expect(screen.getByText('Rodrigo')).toBeTruthy()
  })

  it('soltar un contexto del riel sobre la ficha lo asigna', () => {
    const onAssignContext = vi.fn()

    render(
      <BrainstormRosterColumn
        agents={[agent('ana', 'Ana')]}
        contexts={[]}
        cwd="/repo"
        onAssignContext={onAssignContext}
      />,
    )

    const item = document.querySelector('.brainstorm-roster__item') as HTMLElement
    const dataTransfer = {
      types: [PLANE_CONTEXT_DRAG_MIME],
      getData: (type: string) => (type === PLANE_CONTEXT_DRAG_MIME ? 'ctx-1' : ''),
      dropEffect: 'none',
    }
    fireEvent.dragOver(item, { dataTransfer })
    expect(item.className).toContain('brainstorm-roster__item--drop')

    fireEvent.drop(item, { dataTransfer })
    expect(onAssignContext).toHaveBeenCalledWith('ana', 'ctx-1')
    expect(item.className).not.toContain('brainstorm-roster__item--drop')
  })

  it('sin quien asigne, la ficha no acepta el drop', () => {
    render(<BrainstormRosterColumn agents={[agent('ana', 'Ana')]} contexts={[]} cwd="/repo" />)
    const item = document.querySelector('.brainstorm-roster__item') as HTMLElement
    fireEvent.dragOver(item, {
      dataTransfer: { types: [PLANE_CONTEXT_DRAG_MIME], getData: () => 'ctx-1' },
    })
    expect(item.className).not.toContain('brainstorm-roster__item--drop')
  })

  /** El haz del plano busca la ficha por este atributo, no por la clase del pane. */
  it('la ficha se marca como destino del haz de contextos', () => {
    render(<BrainstormRosterColumn agents={[agent('ana', 'Ana')]} contexts={[]} cwd="/repo" />)
    expect(
      document.querySelector('[data-context-link-card="ana"]'),
    ).toBeTruthy()
  })

  it('con catálogo vacío muestra el hint y ninguna fila', () => {
    render(
      <BrainstormRosterColumn agents={[]} contexts={[]} cwd="/tmp" />,
    )
    expect(screen.getByText('tabs.brainstormEmptyCatalog')).toBeTruthy()
    expect(document.querySelectorAll('.brainstorm-roster__item')).toHaveLength(0)
  })
})
