/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import type { TabContext } from '@shared/tabContext'
import { resolveModelShort } from '@shared/agentCliModels'
import { WorkspaceOrgAgentsGrid } from '../WorkspaceOrgAgentsGrid'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}))

afterEach(cleanup)

const contexts: TabContext[] = [
  {
    id: 'iaterminal:notes:assigned',
    name: 'Assigned notes',
    fileName: 'assigned.md',
    kind: 'notes',
  },
  {
    id: 'iaterminal:notes:other',
    name: 'Other notes',
    fileName: 'other.md',
    kind: 'notes',
  },
]

const agents: ProjectAgentDefinition[] = [
  {
    id: 'alpha',
    name: 'Alpha Agent',
    provider: 'claude',
    model: 'claude-sonnet-4.6',
    permissionMode: 'default',
    contextIds: ['iaterminal:notes:assigned'],
  },
  {
    id: 'beta',
    name: 'Beta Agent',
    provider: 'cursor',
    permissionMode: 'default',
    contextIds: ['iaterminal:notes:other'],
  },
]

describe('WorkspaceOrgAgentsGrid', () => {
  it('renderiza una tarjeta por agente con modelo, marca y chips asignados', () => {
    render(<WorkspaceOrgAgentsGrid agents={agents} contexts={contexts} />)

    const cells = document.querySelectorAll('.ws-org-agents__cell')
    expect(cells).toHaveLength(2)

    expect(screen.getByText('Alpha Agent')).toBeTruthy()
    expect(screen.getByText('Beta Agent')).toBeTruthy()

    const alphaFace = cells[0]!.querySelector('.plane-mini-face')!
    expect(alphaFace.classList.contains('plane-mini-face--claude')).toBe(true)
    expect(
      within(alphaFace as HTMLElement).getByText(
        resolveModelShort('claude', 'claude-sonnet-4.6'),
      ),
    ).toBeTruthy()

    const betaFace = cells[1]!.querySelector('.plane-mini-face')!
    expect(betaFace.classList.contains('plane-mini-face--cursor')).toBe(true)

    expect(document.querySelector('[data-agent-context-chip="iaterminal:notes:assigned"]')).toBeTruthy()
    expect(document.querySelector('[data-agent-context-chip="iaterminal:notes:other"]')).toBeTruthy()
    expect(
      cells[0]!.querySelector('[data-agent-context-chip="iaterminal:notes:other"]'),
    ).toBeNull()
    expect(
      cells[1]!.querySelector('[data-agent-context-chip="iaterminal:notes:assigned"]'),
    ).toBeNull()
  })

  it('no renderiza controles de configurar ni eliminar', () => {
    render(<WorkspaceOrgAgentsGrid agents={agents} contexts={contexts} />)

    expect(screen.queryByRole('button', { name: /settings/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /trash/i })).toBeNull()
    expect(document.querySelector('.plane-mini-face__controls-rail')).toBeNull()
  })
})
