/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
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

  it('con catálogo vacío muestra el hint y ninguna fila', () => {
    render(
      <BrainstormRosterColumn agents={[]} contexts={[]} cwd="/tmp" />,
    )
    expect(screen.getByText('tabs.brainstormEmptyCatalog')).toBeTruthy()
    expect(document.querySelectorAll('.brainstorm-roster__item')).toHaveLength(0)
  })
})
