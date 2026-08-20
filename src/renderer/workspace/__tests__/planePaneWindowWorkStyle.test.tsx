/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { PlanePaneWindow, type PlanePaneWindowProps } from '../PlanePaneWindow'

afterEach(cleanup)

const GEOMETRY = { x: 0, y: 0, width: 240, height: 120 }

function renderCard(overrides: Partial<PlanePaneWindowProps> = {}): void {
  const props: PlanePaneWindowProps = {
    paneId: 'pane-1',
    kind: 'agent',
    title: 'Orquestador',
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
  render(<PlanePaneWindow {...props} />)
}

describe('PlanePaneWindow — modo de orquestación', () => {
  it('muestra chip turbo solo en orquestadores', () => {
    renderCard({
      coordination: 'orchestrator',
      orchestrationWorkStyle: 'turbo',
    })
    expect(screen.getByLabelText('agentPane.orchestrationWorkStyleTurbo')).toBeTruthy()
  })

  it('muestra chip lineal en orquestadores sin turbo', () => {
    renderCard({
      coordination: 'orchestrator',
      orchestrationWorkStyle: 'linear',
    })
    expect(screen.getByLabelText('agentPane.orchestrationWorkStyleLinear')).toBeTruthy()
  })

  it('no muestra chip en especialistas', () => {
    renderCard({
      coordination: 'none',
      orchestrationWorkStyle: 'turbo',
    })
    expect(screen.queryByLabelText('agentPane.orchestrationWorkStyleTurbo')).toBeNull()
    expect(screen.queryByLabelText('agentPane.orchestrationWorkStyleLinear')).toBeNull()
  })

  it('pone el CLI al final con chip del modelo', () => {
    renderCard({
      provider: 'cursor',
      model: 'composer-2.5',
      coordination: 'orchestrator',
      orchestrationWorkStyle: 'linear',
    })
    const engine = document.querySelector('.plane-mini-face__engine')
    expect(engine).toBeTruthy()
    expect(engine?.textContent).toContain('C25')
    expect(engine?.getAttribute('aria-label')).toContain('Composer 2.5')
    expect(engine?.querySelector('.plane-mini-face__provider')).toBeTruthy()
    const badges = document.querySelector('.plane-mini-face__meta-badges')
    expect(badges?.lastElementChild).toBe(engine)
  })
})
