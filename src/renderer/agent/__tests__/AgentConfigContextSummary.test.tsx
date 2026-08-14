/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { TabContext, TabContextKind } from '@shared/tabContext'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, vars?: Record<string, unknown>) => (
      vars ? `${key}:${Object.values(vars).join(',')}` : key
    ),
  }),
}))

import { AgentConfigContextSummary } from '../AgentConfigContextSummary'

const ctx = (id: string, kind: TabContextKind, name: string): TabContext => ({
  id, name, fileName: `${id}.md`, kind,
})

const CONTEXTS = [
  ctx('about', 'notes', 'About'),
  ctx('back-cm', 'symbols', 'Back CM'),
  ctx('back-folders', 'folderTree', 'Back Folders'),
]

const PROJECT_AGENTS = [
  { id: 'maria', name: 'Maria', contextIds: ['about'] },
  { id: 'cristian', name: 'Cristian', contextIds: ['back-cm'] },
]

const renderPicker = (onToggle = vi.fn()) => {
  render(
    <AgentConfigContextSummary
      diskContexts={CONTEXTS}
      selectedContextIds={['about']}
      locked={false}
      agentId="maria"
      projectAgents={PROJECT_AGENTS}
      onToggleContext={onToggle}
      onOpenContextsModal={vi.fn()}
    />,
  )
  return onToggle
}

afterEach(cleanup)

describe('AgentConfigContextSummary', () => {
  it('la bandeja lista lo seleccionado y su botón lo quita', () => {
    const onToggle = renderPicker()
    const remove = screen.getByLabelText('tabContexts.trayRemove:About')
    fireEvent.click(remove)
    expect(onToggle).toHaveBeenCalledWith('about')
  })

  it('marca «sin usar» solo lo que nadie consume', () => {
    renderPicker()
    // back-cm lo usa Cristian; about lo tiene el propio agente.
    expect(screen.getAllByText('tabContexts.usedByNone')).toHaveLength(1)
    expect(screen.getByLabelText('tabContexts.usedByAria:Cristian')).toBeTruthy()
  })

  it('la búsqueda filtra la lista', () => {
    renderPicker()
    fireEvent.change(screen.getByLabelText('tabContexts.filterSearchAria'), {
      target: { value: 'folders' },
    })
    expect(screen.queryByText('Back CM')).toBeNull()
    expect(screen.getByText('Back Folders')).toBeTruthy()
  })

  it('el filtro «sin usar» deja fuera lo seleccionado y lo ya usado', () => {
    renderPicker()
    fireEvent.click(screen.getByText('tabContexts.filterUnused'))
    expect(screen.queryByText('Back CM')).toBeNull()
    expect(screen.getByText('Back Folders')).toBeTruthy()
  })
})
