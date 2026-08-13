/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { TabContext } from '@shared/tabContext'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

import { TabContextsList } from '../TabContextsList'

const resultContext: TabContext = {
  id: 'iaterminal:result:tl',
  name: 'Tech Lead',
  fileName: 'results/tl.md',
  kind: 'agentResult',
}

const notesContext: TabContext = {
  id: 'iaterminal:notes:about',
  name: 'About',
  fileName: 'About.md',
  kind: 'notes',
}

const techLead: ProjectAgentDefinition = {
  id: 'tl',
  provider: 'cursor',
  permissionMode: 'auto',
  coordination: 'orchestrator',
}

const renderList = (contexts: TabContext[], agents: ProjectAgentDefinition[]) => render(
  <TabContextsList
    contexts={contexts}
    agents={agents}
    selectedId={null}
    onNew={() => {}}
    onSelect={() => {}}
    onEdit={() => {}}
    onDelete={() => {}}
  />,
)

afterEach(cleanup)

describe('TabContextsList', () => {
  it('pone monograma, marca del CLI y rol en la fila de results', () => {
    const { container } = renderList([resultContext], [techLead])
    const monogram = container.querySelector('.tab-contexts__monogram')
    expect(monogram?.textContent).toContain('TL')
    expect(monogram?.querySelector('.tab-contexts__monogram-brand svg')).toBeTruthy()
    expect(screen.getByLabelText('agentPane.orchestratorBadge')).toBeTruthy()
  })

  it('el monograma del JSON gana al derivado del nombre', () => {
    const { container } = renderList(
      [{ ...resultContext, name: 'Backend' }],
      [{ ...techLead, id: 'tl', monogram: 'BE' }],
    )
    expect(container.querySelector('.tab-contexts__monogram')?.textContent).toContain('BE')
  })

  it('sin agente en el catálogo mantiene el monograma y omite marca y rol', () => {
    const { container } = renderList([resultContext], [])
    expect(container.querySelector('.tab-contexts__monogram')?.textContent).toBe('TL')
    expect(container.querySelector('.tab-contexts__monogram-brand')).toBeNull()
    expect(container.querySelector('.tab-contexts__role')).toBeNull()
  })

  it('deja el glifo por kind en los contextos de proyecto', () => {
    const { container } = renderList([notesContext], [techLead])
    expect(container.querySelector('.tab-contexts__item-icon')).toBeTruthy()
    // La cara solo va en results; los chips del filtro sí traen monograma.
    expect(container.querySelector('.tab-contexts__item .tab-contexts__monogram')).toBeNull()
  })

  it('marca sin usar y filtra por el agente del chip', () => {
    const mine = { ...notesContext, id: 'iaterminal:notes:mine', name: 'Mine' }
    const { container } = renderList(
      [notesContext, mine],
      [{ ...techLead, name: 'Tech Lead', contextIds: [mine.id] }],
    )
    expect(container.querySelectorAll('.tab-contexts__unused')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: /Tech Lead/ }))
    const names = [...container.querySelectorAll('.tab-contexts__item strong')]
      .map(node => node.textContent)
    expect(names).toEqual(['Mine'])
  })
})
