/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TabAgenticPlane, type TabAgenticPlaneProps } from '../TabAgenticPlane'
import type { WikiGraphResult } from '@shared/wikiGraph'

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

// Hijos pesados del plano (canvas, xterm, dictado): stubs — este test no los necesita.
vi.mock('../PlaneMap', () => ({
  PlaneMap: ({ wikiOverlay }: { wikiOverlay?: React.ReactNode }) => (
    <div data-testid="plane-map">{wikiOverlay}</div>
  ),
}))
vi.mock('../PlaneIdleGravity', () => ({ PlaneIdleGravity: () => null }))
vi.mock('../PlaneChatDock', () => ({ PlaneChatDock: () => null }))
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
const ensureWiki = vi.fn<(cwd: string) => Promise<{ ok: boolean }>>()

beforeEach(() => {
  getWikiGraph.mockReset()
  ensureWiki.mockReset()
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    getWikiGraph,
    ensureWiki,
    onWikiCuratorEvent: vi.fn((_cwd: string, _cb: (event: unknown) => void) => () => undefined),
    startWikiCuratorTurn: vi.fn(),
    stopWikiCuratorTurn: vi.fn(),
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
  projectFolder: '/tmp/proyecto-wiki',
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

describe('mapa de wiki con pages reales vía IPC', () => {
  it('sin pages muestra el empty state y el cierre sigue funcionando', async () => {
    getWikiGraph.mockResolvedValue({ ok: true, data: { nodes: [], edges: [] } })
    render(<TabAgenticPlane {...baseProps} />)

    fireEvent.click(wikiButton())
    expect(getWikiGraph).toHaveBeenCalledWith('/tmp/proyecto-wiki')
    expect(await screen.findByText('tabs.wikiMapEmpty')).toBeTruthy()
    expect(screen.getByText('tabs.wikiMapEmptyHint')).toBeTruthy()
    // Sin escena rota: con la wiki vacía no aparece el aviso de WebGL.
    expect(screen.queryByText('tabs.wikiMapNoWebgl')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'tabs.wikiMapClose' }))
    expect(screen.queryByRole('region', { name: 'tabs.wikiMapTitle' })).toBeNull()
    expect(screen.getByTestId('plane-map')).toBeTruthy()
  })

  it('ok:false muestra overlay de error con retry, sin empty state', async () => {
    getWikiGraph.mockResolvedValue({ ok: false, error: 'sin wiki' })
    render(<TabAgenticPlane {...baseProps} />)

    fireEvent.click(wikiButton())
    expect(await screen.findByText('sin wiki')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'tabs.wikiMapRetry' })).toBeTruthy()
    expect(screen.queryByText('tabs.wikiMapEmpty')).toBeNull()
    expect(screen.getByRole('region', { name: 'tabs.wikiMapTitle' })).toBeTruthy()
  })

  it('mientras data es null muestra overlay de carga sin empty state', async () => {
    let resolveGraph: (value: WikiGraphResult) => void = () => {}
    getWikiGraph.mockReturnValue(new Promise(resolve => { resolveGraph = resolve }))
    render(<TabAgenticPlane {...baseProps} />)

    fireEvent.click(wikiButton())
    expect(document.querySelector('.wiki-graph-view__loading')).toBeTruthy()
    expect(screen.queryByText('tabs.wikiMapEmpty')).toBeNull()

    resolveGraph({ ok: true, data: { nodes: [], edges: [] } })
    expect(await screen.findByText('tabs.wikiMapEmpty')).toBeTruthy()
  })

  it('con pages reales no hay empty state y refetchea en cada apertura', async () => {
    getWikiGraph.mockResolvedValue({
      ok: true,
      data: {
        nodes: [
          { slug: 'arquitectura', title: 'Arquitectura', type: 'concept', linkCount: 0, body: 'Cuerpo.' },
        ],
        edges: [],
      },
    })
    render(<TabAgenticPlane {...baseProps} />)

    fireEvent.click(wikiButton())
    await waitFor(() => expect(getWikiGraph).toHaveBeenCalledTimes(1))
    // Con datos, en jsdom se muestra el aviso de WebGL (no el empty state).
    expect(await screen.findByText('tabs.wikiMapNoWebgl')).toBeTruthy()
    expect(screen.queryByText('tabs.wikiMapEmpty')).toBeNull()

    fireEvent.click(wikiButton())
    fireEvent.click(wikiButton())
    await waitFor(() => expect(getWikiGraph).toHaveBeenCalledTimes(2))
  })
})

describe('CTA Crear wiki en el empty state', () => {
  const createButton = async (): Promise<HTMLElement> => {
    fireEvent.click(wikiButton())
    return await screen.findByRole('button', { name: /tabs\.wikiMapCreate/ })
  }

  it('el empty state ofrece el botón Crear wiki', async () => {
    getWikiGraph.mockResolvedValue({ ok: true, data: { nodes: [], edges: [] } })
    render(<TabAgenticPlane {...baseProps} />)

    expect(await createButton()).toBeTruthy()
    expect(ensureWiki).not.toHaveBeenCalled()
  })

  it('mientras corre queda deshabilitado con spinner y al ok refetchea sin cerrar el mapa', async () => {
    getWikiGraph.mockResolvedValueOnce({ ok: true, data: { nodes: [], edges: [] } })
    getWikiGraph.mockResolvedValueOnce({
      ok: true,
      data: {
        nodes: [{ slug: 'overview', title: 'Overview', type: 'concept', linkCount: 0, body: 'Seed.' }],
        edges: [],
      },
    })
    let resolveEnsure: (value: { ok: boolean }) => void = () => {}
    ensureWiki.mockReturnValue(new Promise(resolve => { resolveEnsure = resolve }))
    render(<TabAgenticPlane {...baseProps} />)

    const button = await createButton()
    fireEvent.click(button)
    expect(ensureWiki).toHaveBeenCalledWith('/tmp/proyecto-wiki')
    await waitFor(() => expect(document.querySelector('.wiki-graph-view__loading')).toBeTruthy())

    resolveEnsure({ ok: true })
    await waitFor(() => expect(getWikiGraph).toHaveBeenCalledTimes(2))
    // El mapa sigue abierto; con la page overview ya no hay empty state.
    expect(screen.getByRole('region', { name: 'tabs.wikiMapTitle' })).toBeTruthy()
    await waitFor(() => expect(screen.queryByText('tabs.wikiMapEmpty')).toBeNull())
  })

  it('ante ok:false muestra el error suave del empty state y no refetchea', async () => {
    getWikiGraph.mockResolvedValue({ ok: true, data: { nodes: [], edges: [] } })
    ensureWiki.mockResolvedValue({ ok: false })
    render(<TabAgenticPlane {...baseProps} />)

    fireEvent.click(await createButton())
    expect(await screen.findByText('tabs.wikiMapCreateError')).toBeTruthy()
    expect(getWikiGraph).toHaveBeenCalledTimes(1)
    // Se puede reintentar: el botón vuelve a quedar habilitado.
    const button = screen.getByRole('button', { name: /tabs\.wikiMapCreate/ })
    expect(button.hasAttribute('disabled')).toBe(false)
  })
})
