/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  // El plano lo llama en render: sin el export el mock revienta al montar.
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
vi.mock('../PulseView', () => ({ PulseView: () => null }))
vi.mock('../../components/ConfirmTerminalModal', () => ({ ConfirmTerminalModal: () => null }))

const getWikiGraph = vi.fn<(cwd: string) => Promise<WikiGraphResult>>()

beforeEach(() => {
  getWikiGraph.mockReset()
  getWikiGraph.mockResolvedValue({ ok: true, data: { nodes: [], edges: [] } })
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    getWikiGraph,
    ensureWiki: vi.fn(async () => ({ ok: true })),
    onWikiCuratorEvent: vi.fn((_cwd: string, _cb: (event: unknown) => void) => () => undefined),
    startWikiCuratorTurn: vi.fn(),
    stopWikiCuratorTurn: vi.fn(),
    isWikiCuratorTurnActive: vi.fn(async () => false),
    getWikiCuratorConfig: vi.fn(async () => ({ ok: true as const, config: {} })),
    setWikiCuratorConfig: vi.fn(async () => ({ ok: true as const })),
    listAgentCliModels: vi.fn(async () => ({ models: [], source: 'fallback' as const })),
    startWikiSweep: vi.fn(),
    stopWikiSweep: vi.fn(),
    onWikiSweepEvent: vi.fn((_cwd: string, _cb: (event: unknown) => void) => () => undefined),
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
  projectFolder: '/tmp/wiki-toggle',
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

const wikiView = (): HTMLElement | null =>
  screen.queryByRole('region', { name: 'tabs.wikiMapTitle' })

describe('toggle del mapa de wiki en TabAgenticPlane', () => {
  it('el botón abre la vista sobre el plano y vuelve a cerrarla', async () => {
    render(<TabAgenticPlane {...baseProps} />)
    const hiddenRoot = document.querySelector('.wiki-graph-view')
    expect(hiddenRoot).not.toBeNull()
    expect(hiddenRoot!.classList.contains('wiki-graph-view--hidden')).toBe(true)
    expect(document.querySelector('.wiki-curator-composer')).toBeTruthy()
    expect(wikiButton().getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(wikiButton())
    const view = document.querySelector('.wiki-graph-view') as HTMLElement | null
    expect(view).not.toBeNull()
    expect(view!.classList.contains('wiki-graph-view--hidden')).toBe(false)
    expect(wikiButton().getAttribute('aria-pressed')).toBe('true')
    // Dentro del plano del workspace (no body): montado en PlaneMap sobre el backdrop.
    expect(view!.closest('.tab-agentic-plane')).toBeTruthy()
    expect(view!.closest('[data-testid="plane-map"]')).toBeTruthy()
    expect(view!.parentElement).not.toBe(document.body)
    // Sin pages el grafo resuelve vacío: empty state, no spinner ni WebGL.
    expect(await screen.findByText('tabs.wikiMapEmpty')).toBeTruthy()
    expect(screen.queryByText('tabs.wikiMapNoWebgl')).toBeNull()
    expect(document.querySelector('.wiki-graph-view__loading')).toBeNull()
    // Con el mapa wiki abierto el chat se desmonta (v0.51): no compite con el grafo.
    expect(screen.queryByTestId('plane-chat-dock')).toBeNull()

    fireEvent.click(wikiButton())
    // Al cerrar, el overlay sigue montado (hidden) y el curador no se desmonta.
    const closed = document.querySelector('.wiki-graph-view')
    expect(closed).not.toBeNull()
    expect(closed!.classList.contains('wiki-graph-view--hidden')).toBe(true)
    expect(document.querySelector('.wiki-curator-composer')).toBeTruthy()
    // El plano sigue montado debajo en todo momento.
    expect(screen.getByTestId('plane-map')).toBeTruthy()
  })

  it('con tab inactiva no monta el overlay (otros workspaces quedan libres)', () => {
    const { rerender } = render(<TabAgenticPlane {...baseProps} tabActive />)
    fireEvent.click(wikiButton())
    expect(wikiView()).not.toBeNull()

    rerender(<TabAgenticPlane {...baseProps} tabActive={false} />)
    // El botón sigue pressed (estado del padre), pero el mapa no sale del workspace.
    expect(wikiButton().getAttribute('aria-pressed')).toBe('true')
    expect(wikiView()).toBeNull()

    rerender(<TabAgenticPlane {...baseProps} tabActive />)
    expect(wikiView()).not.toBeNull()
  })

  it('Escape y el botón de cierre de la vista restauran el plano', () => {
    render(<TabAgenticPlane {...baseProps} />)

    fireEvent.click(wikiButton())
    expect(document.querySelector('.wiki-graph-view--hidden')).toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(document.querySelector('.wiki-graph-view--hidden')).toBeTruthy()
    expect(document.querySelector('.wiki-curator-composer')).toBeTruthy()

    fireEvent.click(wikiButton())
    fireEvent.click(screen.getByRole('button', { name: 'tabs.wikiMapClose' }))
    expect(document.querySelector('.wiki-graph-view--hidden')).toBeTruthy()
    expect(screen.getByTestId('plane-map')).toBeTruthy()
    expect(wikiButton().getAttribute('aria-pressed')).toBe('false')
  })

  it('deja la barra superior izquierda por encima del overlay y separa el chrome de wiki a la derecha', () => {
    render(<TabAgenticPlane {...baseProps} />)
    const topLeftChrome = document.querySelector('.plane-top-left-chrome') as HTMLElement | null
    expect(topLeftChrome).not.toBeNull()
    expect(topLeftChrome!.classList.contains('plane-top-left-chrome--over-wiki')).toBe(false)

    fireEvent.click(wikiButton())
    const view = wikiView()
    expect(view).not.toBeNull()
    const chromeAfterOpen = document.querySelector('.plane-top-left-chrome') as HTMLElement | null
    expect(chromeAfterOpen).not.toBeNull()
    // Con el mapa abierto el chrome sube a --over-wiki (675) por encima del overlay.
    expect(chromeAfterOpen!.classList.contains('plane-top-left-chrome--over-wiki')).toBe(true)
    const barAfterOpen = chromeAfterOpen!.querySelector('.plane-top-left-bar') as HTMLElement | null
    expect(barAfterOpen).not.toBeNull()
    // El chrome propio de wiki queda agrupado en un solo header y no ocupa
    // la esquina superior izquierda; título + leyenda + cerrar viven juntos.
    const wikiBar = view!.querySelector('.wiki-graph-view__bar') as HTMLElement | null
    expect(wikiBar).not.toBeNull()
    expect(wikiBar!.querySelector('.wiki-graph-view__title')).toBeTruthy()
    expect(wikiBar!.querySelector('.wiki-graph-view__legend')).toBeTruthy()
    expect(wikiBar!.querySelector('.wiki-graph-view__close')).toBeTruthy()
    // La barra izquierda queda fuera del overlay wiki (hermanos en tab-agentic-plane).
    expect(view!.contains(chromeAfterOpen)).toBe(false)

    fireEvent.click(wikiButton())
    const chromeAfterClose = document.querySelector('.plane-top-left-chrome') as HTMLElement | null
    expect(chromeAfterClose!.classList.contains('plane-top-left-chrome--over-wiki')).toBe(false)
  })
})
