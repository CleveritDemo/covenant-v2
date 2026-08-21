/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { TabContext } from '@shared/tabContext'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import { resolveContextColor } from '@shared/tabContextAppearance'
import { WorkspaceOrgContextsList } from '../WorkspaceOrgContextsList'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  }),
}))

afterEach(cleanup)

const notesContext: TabContext = {
  id: 'iaterminal:notes:Front-Rules',
  name: 'Front Rules',
  fileName: 'context/Front-Rules.md',
  kind: 'notes',
  icon: 'note',
  color: '#fb7185',
}

const gitContext: TabContext = {
  id: 'iaterminal:git:status',
  name: 'Git status',
  fileName: 'context/git-status.md',
  kind: 'git',
}

const refContext: TabContext = {
  id: 'iaterminal:files:sheet',
  name: 'Sheet',
  fileName: 'context/sheet.md',
  kind: 'files',
  referenceOnly: true,
  color: '#f0c14a',
}

const baseAgent = (
  id: string,
  contextIds?: string[],
): ProjectAgentDefinition => ({
  id,
  permissionMode: 'auto',
  name: id === 'frontend' ? 'Frontend' : id,
  monogram: id === 'frontend' ? 'FE' : undefined,
  provider: 'cursor',
  ...(contextIds ? { contextIds } : {}),
})

describe('WorkspaceOrgContextsList', () => {
  it('pinta una fila por contexto con el icono del kind', () => {
    const { container } = render(
      <WorkspaceOrgContextsList
        contexts={[notesContext, gitContext]}
        agents={[]}
      />,
    )

    expect(container.querySelectorAll('.ws-org-contexts__row')).toHaveLength(2)
    expect(container.querySelectorAll('.ws-org-contexts__icon svg')).toHaveLength(2)
  })

  it('el color del icono sale de resolveContextColor', () => {
    const { container } = render(
      <WorkspaceOrgContextsList contexts={[notesContext]} agents={[]} />,
    )

    const iconWrap = container.querySelector('.ws-org-contexts__icon') as HTMLElement
    const probe = document.createElement('span')
    probe.style.color = resolveContextColor(notesContext)
    expect(iconWrap.style.color).toBe(probe.style.color)
  })

  it('el chip referenceOnly solo aparece cuando el flag está', () => {
    const { container, rerender } = render(
      <WorkspaceOrgContextsList contexts={[notesContext]} agents={[]} />,
    )
    expect(container.querySelector('.ws-org-contexts__ref')).toBeNull()

    rerender(
      <WorkspaceOrgContextsList contexts={[refContext]} agents={[]} />,
    )
    expect(container.querySelector('.ws-org-contexts__ref')).toBeTruthy()
    expect(screen.getByText('tabContexts.referenceOnly')).toBeTruthy()
  })

  it('las caras de usado por solo aparecen para agentes con ese contextId', () => {
    const { container } = render(
      <WorkspaceOrgContextsList
        contexts={[notesContext, gitContext]}
        agents={[
          baseAgent('frontend', [notesContext.id]),
          baseAgent('backend', [gitContext.id]),
          baseAgent('qa'),
        ]}
      />,
    )

    const rows = container.querySelectorAll('.ws-org-contexts__row')
    const notesRow = rows[1]
    const gitRow = rows[0]

    expect(notesRow.querySelectorAll('.agent-face')).toHaveLength(1)
    expect(gitRow.querySelectorAll('.agent-face')).toHaveLength(1)
    expect(notesRow.querySelector('.ws-org-contexts__unused')).toBeNull()
    expect(gitRow.querySelector('.ws-org-contexts__unused')).toBeNull()

    const { container: emptyUsers } = render(
      <WorkspaceOrgContextsList contexts={[notesContext]} agents={[]} />,
    )
    expect(emptyUsers.querySelector('.ws-org-contexts__unused')).toBeTruthy()
    expect(emptyUsers.querySelector('.agent-face')).toBeNull()
  })
})
