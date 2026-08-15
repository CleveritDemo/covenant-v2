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

describe('PlanePaneWindow — dot de actividad en la card mini', () => {
  it('pinta la esquina cuando el pane trabaja sin hilos en carril', () => {
    // Delegación asignada al especialista: el chip del composer ya se enciende,
    // la card tiene que encenderse también aunque no haya thread node.
    const container = renderCard({ busy: true })
    expect(container.querySelectorAll('.plane-busy-dot--corner')).toHaveLength(1)
  })

  it('no duplica la esquina cuando el listado de hilos ya lleva su dot', () => {
    const container = renderCard({
      busy: true,
      threadNodes: [{ id: 't2', title: '', running: true, active: false }],
      onOpenThread: () => undefined,
    })
    expect(container.querySelectorAll('.plane-busy-dot--corner')).toHaveLength(0)
    expect(container.querySelectorAll('.plane-agent-thread-nodes__row')).toHaveLength(1)
  })

  it('deja la card apagada cuando el pane está en reposo', () => {
    const container = renderCard()
    expect(container.querySelectorAll('.plane-busy-dot')).toHaveLength(0)
  })
})
