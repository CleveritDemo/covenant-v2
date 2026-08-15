/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { PlanePaneWindow, type PlanePaneWindowProps } from '../PlanePaneWindow'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}))

// La card mini solo interesa por su cara: PaneWindow aporta geometría y chrome.
vi.mock('../PaneWindow', () => ({
  PaneWindow: ({ miniFace }: { miniFace?: React.ReactNode }) => (
    <div data-testid="pane-window">{miniFace}</div>
  ),
}))
vi.mock('../../components/ConfirmTerminalModal', () => ({ ConfirmTerminalModal: () => null }))

afterEach(cleanup)

const GEOMETRY = { x: 0, y: 0, width: 240, height: 120 }

function renderCard(overrides: Partial<PlanePaneWindowProps> = {}): HTMLElement {
  const props: PlanePaneWindowProps = {
    paneId: 'pane-1',
    kind: 'agent',
    title: 'David',
    idleLabel: 'idle',
    window: { open: false, fullscreen: false, zIndex: 1 },
    openGeometry: GEOMETRY,
    miniOrigin: GEOMETRY,
    activePaneId: 'pane-1',
    configLabel: 'config',
    deleteLabel: 'delete',
    maximizeLabel: 'max',
    restoreLabel: 'restore',
    closeWindowLabel: 'close',
    children: null,
    onExpand: () => undefined,
    onClose: () => undefined,
    onFocus: () => undefined,
    onToggleFullscreen: () => undefined,
    onOpenConfig: () => undefined,
    onOpenChat: () => undefined,
    onDelete: () => undefined,
    ...overrides,
  }
  const { container } = render(<PlanePaneWindow {...props} />)
  return container
}

const corners = (container: HTMLElement): number =>
  container.querySelectorAll('.plane-busy-dot--corner').length
const rows = (container: HTMLElement): number =>
  container.querySelectorAll('.plane-agent-thread-nodes__row').length

describe('PlanePaneWindow — señales de la card mini', () => {
  it('la esquina es solo para la ola del orquestador', () => {
    const container = renderCard({ awaitingDelegations: true })
    expect(corners(container)).toBe(1)
  })

  it('un turno en curso va al listado, nunca a la esquina', () => {
    const container = renderCard({
      busy: true,
      threadNodes: [{ id: 't1', title: '', running: true, active: true }],
      onOpenThread: () => undefined,
    })
    expect(rows(container)).toBe(1)
    expect(corners(container)).toBe(0)
  })

  it('lista humano y carriles de delegación juntos', () => {
    const container = renderCard({
      busy: true,
      threadNodes: [
        { id: 't1', title: '', running: true, active: true, activity: 'humano' },
        { id: 'lane-1', title: '', running: true, active: false, activity: 'subtarea' },
        { id: 'viejo', title: '', running: false, active: false },
      ],
      onOpenThread: () => undefined,
    })
    expect(rows(container)).toBe(2)
    expect(corners(container)).toBe(0)
  })

  it('el orquestador puede esperar su ola y correr su propio turno a la vez', () => {
    const container = renderCard({
      busy: true,
      awaitingDelegations: true,
      threadNodes: [{ id: 't1', title: '', running: true, active: true }],
      onOpenThread: () => undefined,
    })
    expect(corners(container)).toBe(1)
    expect(rows(container)).toBe(1)
  })

  it('en reposo la card no pinta nada', () => {
    const container = renderCard()
    expect(container.querySelectorAll('.plane-busy-dot')).toHaveLength(0)
    expect(rows(container)).toBe(0)
  })
})
