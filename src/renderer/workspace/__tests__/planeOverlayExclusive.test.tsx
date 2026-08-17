/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { WikiGraphResult } from '@shared/wikiGraph'
import { TabAgenticPlane, type TabAgenticPlaneProps } from '../TabAgenticPlane'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}))

// La escena three no corre en jsdom: el hook guarda por WebGL y aquí se mockea.
vi.mock('../useWikiGraphScene', () => ({
  useWikiGraphScene: () => ({ webglAvailable: false }),
}))

vi.mock('../../reduceMotion', () => ({
  isReduceMotionActive: () => true,
}))

// Hijos pesados del plano (canvas, xterm, dictado): stubs — el toggle no los necesita.
vi.mock('../PlaneMap', () => ({
  PlaneMap: ({ wikiOverlay }: { wikiOverlay?: React.ReactNode }) => (
    <div data-testid="plane-map">{wikiOverlay}</div>
  ),
  planeFloorAuroraActive: (working: boolean, wikiOpen: boolean) => working && !wikiOpen,
}))
vi.mock('../PlaneIdleGravity', () => ({ PlaneIdleGravity: () => null }))
vi.mock('../PlaneChatDock', () => ({
  PlaneChatDock: () => <div className="plane-chat-dock" data-testid="plane-chat-dock" />,
}))
vi.mock('../PlaneChatComposer', () => ({ PlaneChatComposer: () => null }))
vi.mock('../PlaneChatContextsBar', () => ({ PlaneChatContextsBar: () => null }))
vi.mock('../PlaneQuickChat', () => ({ PlaneQuickChat: () => null }))
vi.mock('../PlaneContextPool', () => ({ PlaneContextPool: () => null }))
vi.mock('../PlaneFabStack', () => ({ PlaneFabStack: () => null }))
vi.mock('../PlaneLoopsSection', () => ({ PlaneLoopsSection: () => null }))
vi.mock('../PlaneBrainstormTable', () => ({ PlaneBrainstormTable: () => null }))
vi.mock('../TabFileExplorerWindow', () => ({ TabFileExplorerWindow: () => null }))
// Stub mínimo: solo el caparazón .pulse-view para comprobar exclusión mutua.
vi.mock('../PulseView', () => ({
  PulseView: ({ open }: { open?: boolean }) => (
    open ? <div className="pulse-view" /> : null
  ),
}))
vi.mock('../../components/ConfirmTerminalModal', () => ({ ConfirmTerminalModal: () => null }))

const getWikiGraph = vi.fn<(cwd: string) => Promise<WikiGraphResult>>()

beforeEach(() => {
  getWikiGraph.mockReset()
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    getWikiGraph,
    ensureWiki: vi.fn(async () => ({ ok: true })),
    onWikiCuratorEvent: vi.fn((_cwd: string, _cb: (event: unknown) => void) => () => undefined),
    startWikiCuratorTurn: vi.fn(),
    stopWikiCuratorTurn: vi.fn(),
    isWikiCuratorTurnActive: vi.fn(async () => false),
    getWikiCuratorConfig: vi.fn(async () => ({ ok: true as const, config: {} })),
    setWikiCuratorConfig: vi.fn(async () => ({ ok: true as const })),
  }
})

afterEach(cleanup)

const baseProps = {
  emptyTitle: '',
  emptyHint: '',
  agentFabTitle: '',
  terminalFabTitle: '',
  idleAgentLabel: '',
  chatPlaceholder: '',
  chatEmptyAgents: '',
  chatSendLabel: '',
  tabContexts: [],
  entities: [],
  agentStatuses: {},
  activePaneId: '',
  openChatAgentId: null,
  openChatThreads: [],
  gitRepos: [],
  loopChains: [],
  loopsOpen: false,
  loopsButtonLabel: 'loops',
  projectFolder: '',
  projectFolderSelectLabel: '',
  projectFolderChangeLabel: '',
  projectFolderEmptyHint: '',
  projectFolderRevealLabel: '',
  configLabel: '',
  deleteLabel: '',
  maximizeLabel: '',
  restoreLabel: '',
  closeWindowLabel: '',
  canAdd: false,
  renderPane: () => null,
  onOpenChatAgentChange: vi.fn(),
  onLoopsOpenChange: vi.fn(),
  onLoopChainsChange: vi.fn(),
  onStartLoopChain: vi.fn(),
  onStopLoopChain: vi.fn(),
  onSelectProjectFolder: vi.fn(),
  onMinimizeAllWindows: vi.fn(),
} as unknown as TabAgenticPlaneProps

const wikiButton = (): HTMLElement =>
  screen.getByRole('button', { name: 'tabs.wikiMapButton' })

const pulseButton = (): HTMLElement =>
  screen.getByRole('button', { name: 'pulse.button' })

const workspaceButton = (): HTMLElement =>
  screen.getByRole('button', { name: 'tabs.planeWorkspaceButton' })

describe('el plano como módulo del riel', () => {
  it('marcado mientras no hay overlay, y suelto cuando lo hay', () => {
    render(<TabAgenticPlane {...baseProps} />)
    expect(workspaceButton().getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(wikiButton())
    expect(workspaceButton().getAttribute('aria-pressed')).toBe('false')
  })

  it('vuelve al plano cerrando el overlay abierto', () => {
    const onBrainstormViewChange = vi.fn()
    render(
      <TabAgenticPlane
        {...baseProps}
        brainstormOverlayOpen
        onBrainstormViewChange={onBrainstormViewChange}
      />,
    )

    fireEvent.click(pulseButton())
    expect(document.querySelector('.pulse-view')).not.toBeNull()

    fireEvent.click(workspaceButton())
    expect(document.querySelector('.pulse-view')).toBeNull()
    expect(document.querySelector('.wiki-graph-view')).toBeNull()
    expect(onBrainstormViewChange).toHaveBeenCalledWith(null)
  })
})

describe('exclusión mutua de overlays del plano', () => {
  it('abrir el mapa de wiki y luego Pulse deja solo Pulse', () => {
    render(<TabAgenticPlane {...baseProps} />)

    fireEvent.click(wikiButton())
    expect(document.querySelector('.wiki-graph-view')).not.toBeNull()

    fireEvent.click(pulseButton())
    expect(document.querySelector('.pulse-view')).not.toBeNull()
    expect(document.querySelector('.wiki-graph-view')).toBeNull()
  })

  it('abrir Pulse y luego el mapa de wiki deja solo el mapa', () => {
    render(<TabAgenticPlane {...baseProps} />)

    fireEvent.click(pulseButton())
    expect(document.querySelector('.pulse-view')).not.toBeNull()

    fireEvent.click(wikiButton())
    expect(document.querySelector('.wiki-graph-view')).not.toBeNull()
    expect(document.querySelector('.pulse-view')).toBeNull()
  })

  it('abrir Pulse con brainstorm abierto cierra la sala vía handlers', () => {
    const onBrainstormViewChange = vi.fn()
    const onBrainstormDockOpenChange = vi.fn()
    render(
      <TabAgenticPlane
        {...baseProps}
        brainstormOverlayOpen
        onBrainstormViewChange={onBrainstormViewChange}
        onBrainstormDockOpenChange={onBrainstormDockOpenChange}
      />,
    )

    fireEvent.click(pulseButton())
    expect(onBrainstormViewChange).toHaveBeenCalledWith(null)
    expect(onBrainstormDockOpenChange).toHaveBeenCalledWith(false)
  })

  it('segundo clic en Pulse solo cierra y no toca brainstorm', () => {
    const onBrainstormViewChange = vi.fn()
    render(
      <TabAgenticPlane
        {...baseProps}
        onBrainstormViewChange={onBrainstormViewChange}
      />,
    )

    fireEvent.click(pulseButton())
    expect(document.querySelector('.pulse-view')).not.toBeNull()
    onBrainstormViewChange.mockClear()

    fireEvent.click(pulseButton())
    expect(document.querySelector('.pulse-view')).toBeNull()
    expect(onBrainstormViewChange).not.toHaveBeenCalled()
  })
})
