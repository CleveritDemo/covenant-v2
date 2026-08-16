/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TabAgenticPlane, type TabAgenticPlaneProps } from '../TabAgenticPlane'
import { WikiGraphView } from '../WikiGraphView'
import { WikiCuratorComposer } from '../WikiCuratorComposer'
import type { WikiSweepEvent } from '@shared/wikiCuratorSweep'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, vars?: Record<string, unknown>) => {
      if (key === 'tabs.wikiSweepProgress' && vars) {
        return `${key}:${vars.index}/${vars.total}`
      }
      return key
    },
    i18n: { language: 'es' },
  }),
}))

vi.mock('../useWikiGraphScene', () => ({
  useWikiGraphScene: () => ({ webglAvailable: true }),
}))

vi.mock('../../reduceMotion', () => ({
  isReduceMotionActive: () => true,
}))

vi.mock('../PlaneMap', () => ({
  PlaneMap: ({ wikiOverlay }: { wikiOverlay?: React.ReactNode }) => (
    <div data-testid="plane-map">{wikiOverlay}</div>
  ),
  planeFloorAuroraActive: () => false,
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

const startWikiCuratorTurn = vi.fn()
const onWikiCuratorEvent = vi.fn((_cwd: string, _cb: (event: unknown) => void) => () => undefined)
const getWikiGraph = vi.fn()
const startWikiSweep = vi.fn()
const stopWikiSweep = vi.fn()
let wikiSweepEventHandler: ((event: WikiSweepEvent) => void) | undefined

const onWikiSweepEvent = vi.fn((_cwd: string, cb: (event: WikiSweepEvent) => void) => {
  wikiSweepEventHandler = cb
  return () => {
    wikiSweepEventHandler = undefined
  }
})

const baseGraphProps = {
  cwd: '/tmp/wiki',
  onClose: vi.fn(),
  onOpenNode: vi.fn(),
  onRefetchGraph: vi.fn(),
  active: true,
}

const baseSweep = {
  running: false,
  pass: null as const,
  index: 0,
  total: 5,
  opsApplied: 0,
  errors: [] as string[],
  snapshotPath: null as string | null,
  onStart: vi.fn(),
  onStop: vi.fn(),
  onDismissSummary: vi.fn(),
}

const planeBaseProps = {
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

beforeEach(() => {
  wikiSweepEventHandler = undefined
  getWikiGraph.mockReset()
  startWikiSweep.mockReset()
  stopWikiSweep.mockReset()
  onWikiSweepEvent.mockClear()
  onWikiSweepEvent.mockImplementation((_cwd, cb) => {
    wikiSweepEventHandler = cb
    return () => {
      wikiSweepEventHandler = undefined
    }
  })
  getWikiGraph.mockResolvedValue({
    ok: true,
    data: {
      nodes: [{
        slug: 'overview',
        title: 'Overview',
        type: 'concept',
        updatedAt: 1,
      }],
      edges: [],
    },
  })
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    getWikiGraph,
    ensureWiki: vi.fn(async () => ({ ok: true })),
    onWikiCuratorEvent,
    startWikiCuratorTurn,
    stopWikiCuratorTurn: vi.fn(),
    getWikiCuratorConfig: vi.fn(async () => ({ ok: true as const, config: {} })),
    setWikiCuratorConfig: vi.fn(async () => ({ ok: true as const })),
    listAgentCliModels: vi.fn(async () => ({ models: [], source: 'fallback' as const })),
    startWikiSweep,
    stopWikiSweep,
    onWikiSweepEvent,
  }
})

afterEach(() => {
  cleanup()
})

describe('WikiGraphView barrido de wiki', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('deshabilita Curar wiki si el grafo no está ready', () => {
    render(
      <WikiGraphView
        {...baseGraphProps}
        data={null}
        sweep={baseSweep}
      />,
    )

    act(() => {
      vi.advanceTimersByTime(2400)
    })

    expect(screen.getByRole('button', { name: 'tabs.wikiSweepStart' })).toHaveProperty('disabled', true)
  })

  it('muestra pase y progreso en el overlay al correr el barrido', () => {
    render(
      <WikiGraphView
        {...baseGraphProps}
        data={{
          nodes: [{
            slug: 'overview',
            title: 'Overview',
            type: 'concept',
            updatedAt: 1,
          }],
          edges: [],
        }}
        sweep={{
          ...baseSweep,
          running: true,
          pass: 'health',
          index: 1,
          opsApplied: 3,
        }}
      />,
    )

    act(() => {
      vi.advanceTimersByTime(2400)
    })

    expect(document.querySelector('.wiki-graph-view__loading')).toBeTruthy()
    expect(screen.getByText('tabs.wikiSweepPassHealth')).toBeTruthy()
    expect(screen.getByText('tabs.wikiSweepProgress:1/5')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'tabs.wikiSweepStop' })).toBeTruthy()
  })

  it('acumula y muestra errores parciales del barrido en el overlay', () => {
    render(
      <WikiGraphView
        {...baseGraphProps}
        data={{
          nodes: [{
            slug: 'overview',
            title: 'Overview',
            type: 'concept',
            updatedAt: 1,
          }],
          edges: [],
        }}
        sweep={{
          ...baseSweep,
          running: true,
          pass: 'truth',
          index: 2,
          errors: ['fallo ingest 1', 'fallo ingest 2'],
        }}
      />,
    )

    act(() => {
      vi.advanceTimersByTime(2400)
    })

    expect(screen.getByText('fallo ingest 1')).toBeTruthy()
    expect(screen.getByText('fallo ingest 2')).toBeTruthy()
    expect(screen.getByText('tabs.wikiSweepErrorsTitle')).toBeTruthy()
  })

  it('muestra resumen con snapshot y no desaparece solo', () => {
    render(
      <WikiGraphView
        {...baseGraphProps}
        data={{
          nodes: [{
            slug: 'overview',
            title: 'Overview',
            type: 'concept',
            updatedAt: 1,
          }],
          edges: [],
        }}
        sweep={{
          ...baseSweep,
          snapshotPath: '/tmp/wiki-snapshot',
        }}
      />,
    )

    act(() => {
      vi.advanceTimersByTime(2400)
    })

    expect(screen.getByText('tabs.wikiSweepSnapshotTitle')).toBeTruthy()
    expect(screen.getByText('/tmp/wiki-snapshot')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(screen.getByText('/tmp/wiki-snapshot')).toBeTruthy()
  })

  it('el botón cerrar oculta el resumen del snapshot', () => {
    const onDismissSummary = vi.fn()
    render(
      <WikiGraphView
        {...baseGraphProps}
        data={{
          nodes: [{
            slug: 'overview',
            title: 'Overview',
            type: 'concept',
            updatedAt: 1,
          }],
          edges: [],
        }}
        sweep={{
          ...baseSweep,
          snapshotPath: '/tmp/wiki-snapshot',
          onDismissSummary,
        }}
      />,
    )

    act(() => {
      vi.advanceTimersByTime(2400)
    })

    fireEvent.click(screen.getByRole('button', { name: 'tabs.wikiSweepSummaryClose' }))
    expect(onDismissSummary).toHaveBeenCalledOnce()
  })

  it('muestra panel post-barrido solo con errores, sin ruta ni copiar', () => {
    render(
      <WikiGraphView
        {...baseGraphProps}
        data={{
          nodes: [{
            slug: 'overview',
            title: 'Overview',
            type: 'concept',
            updatedAt: 1,
          }],
          edges: [],
        }}
        sweep={{
          ...baseSweep,
          errors: ['fallo snapshot'],
        }}
      />,
    )

    act(() => {
      vi.advanceTimersByTime(2400)
    })

    expect(screen.getByRole('heading', { level: 3, name: 'tabs.wikiSweepErrorsTitle' })).toBeTruthy()
    expect(screen.getByText('fallo snapshot')).toBeTruthy()
    expect(screen.queryByText('tabs.wikiSweepSnapshotHint')).toBeNull()
    expect(screen.queryByRole('button', { name: 'tabs.wikiSweepSnapshotCopy' })).toBeNull()
  })

  it('onDismissSummary oculta el panel de errores sin snapshot', () => {
    const onDismissSummary = vi.fn()
    render(
      <WikiGraphView
        {...baseGraphProps}
        data={{
          nodes: [{
            slug: 'overview',
            title: 'Overview',
            type: 'concept',
            updatedAt: 1,
          }],
          edges: [],
        }}
        sweep={{
          ...baseSweep,
          errors: ['fallo snapshot'],
          onDismissSummary,
        }}
      />,
    )

    act(() => {
      vi.advanceTimersByTime(2400)
    })

    fireEvent.click(screen.getByRole('button', { name: 'tabs.wikiSweepSummaryClose' }))
    expect(onDismissSummary).toHaveBeenCalledOnce()
  })

  it('no muestra resumen si no hay snapshotPath', () => {
    render(
      <WikiGraphView
        {...baseGraphProps}
        data={{
          nodes: [{
            slug: 'overview',
            title: 'Overview',
            type: 'concept',
            updatedAt: 1,
          }],
          edges: [],
        }}
        sweep={baseSweep}
      />,
    )

    act(() => {
      vi.advanceTimersByTime(2400)
    })

    expect(screen.queryByText('tabs.wikiSweepSnapshotTitle')).toBeNull()
  })
})

describe('WikiCuratorComposer durante barrido', () => {
  it('bloquea el composer mientras disabled y se rehabilita al terminar', () => {
    const { rerender } = render(
      <WikiCuratorComposer
        cwd="/tmp/wiki"
        disabled
        onViewSlugs={vi.fn()}
        onWikiChanged={vi.fn()}
      />,
    )

    expect(screen.getByText('tabs.wikiSweepBlocked')).toBeTruthy()
    expect(screen.getByLabelText('tabs.wikiCuratorInputLabel')).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'tabs.wikiCuratorSend' })).toHaveProperty('disabled', true)

    rerender(
      <WikiCuratorComposer
        cwd="/tmp/wiki"
        disabled={false}
        onViewSlugs={vi.fn()}
        onWikiChanged={vi.fn()}
      />,
    )

    expect(screen.queryByText('tabs.wikiSweepBlocked')).toBeNull()
    expect(screen.getByLabelText('tabs.wikiCuratorInputLabel')).toHaveProperty('disabled', false)
  })
})

describe('TabAgenticPlane barrido (eventos IPC)', () => {
  it('pass_start muestra overlay; done rehabilita botón y composer', async () => {
    render(<TabAgenticPlane {...planeBaseProps} tabActive />)

    fireEvent.click(screen.getByRole('button', { name: 'tabs.wikiMapButton' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'tabs.wikiSweepStart' })).toBeTruthy()
    })

    expect(wikiSweepEventHandler).toBeDefined()
    act(() => {
      wikiSweepEventHandler?.({
        type: 'pass_start',
        pass: 'health',
        index: 1,
        total: 5,
      })
    })

    expect(screen.getByText('tabs.wikiSweepPassHealth')).toBeTruthy()
    expect(screen.getByText('tabs.wikiSweepBlocked')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'tabs.wikiSweepStop' })).toBeTruthy()

    act(() => {
      wikiSweepEventHandler?.({
        type: 'done',
        totalOps: 4,
        snapshotPath: '/tmp/snap',
        stopped: false,
      })
    })

    expect(screen.queryByText('tabs.wikiSweepBlocked')).toBeNull()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'tabs.wikiSweepStart' })).toHaveProperty('disabled', false)
    })
    expect(screen.getByLabelText('tabs.wikiCuratorInputLabel')).toHaveProperty('disabled', false)
    expect(screen.getByText('tabs.wikiSweepSnapshotTitle')).toBeTruthy()
    expect(screen.getByText('/tmp/snap')).toBeTruthy()
  })

  it('acumula errores de varios pass_done y los muestra en overlay', async () => {
    render(<TabAgenticPlane {...planeBaseProps} tabActive />)

    fireEvent.click(screen.getByRole('button', { name: 'tabs.wikiMapButton' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'tabs.wikiSweepStart' })).toBeTruthy()
    })

    act(() => {
      wikiSweepEventHandler?.({
        type: 'pass_start',
        pass: 'health',
        index: 1,
        total: 5,
      })
    })

    act(() => {
      wikiSweepEventHandler?.({
        type: 'pass_done',
        pass: 'health',
        opsApplied: 1,
        errors: ['error pase 1'],
      })
      wikiSweepEventHandler?.({
        type: 'pass_start',
        pass: 'truth',
        index: 2,
        total: 5,
      })
      wikiSweepEventHandler?.({
        type: 'pass_done',
        pass: 'truth',
        opsApplied: 2,
        errors: ['error pase 2'],
      })
    })

    expect(screen.getByText('error pase 1')).toBeTruthy()
    expect(screen.getByText('error pase 2')).toBeTruthy()
  })

  it('error durante el barrido aparece en el overlay de progreso', async () => {
    render(<TabAgenticPlane {...planeBaseProps} tabActive />)

    fireEvent.click(screen.getByRole('button', { name: 'tabs.wikiMapButton' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'tabs.wikiSweepStart' })).toBeTruthy()
    })

    act(() => {
      wikiSweepEventHandler?.({
        type: 'pass_start',
        pass: 'health',
        index: 1,
        total: 5,
      })
    })

    act(() => {
      wikiSweepEventHandler?.({
        type: 'error',
        message: 'boom',
      })
    })

    expect(screen.getByText('boom')).toBeTruthy()
    expect(screen.getByText('tabs.wikiSweepErrorsTitle')).toBeTruthy()
  })

  it('error seguido de done muestra panel post-barrido sin ruta ni copiar', async () => {
    render(<TabAgenticPlane {...planeBaseProps} tabActive />)

    fireEvent.click(screen.getByRole('button', { name: 'tabs.wikiMapButton' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'tabs.wikiSweepStart' })).toBeTruthy()
    })

    act(() => {
      wikiSweepEventHandler?.({
        type: 'pass_start',
        pass: 'health',
        index: 1,
        total: 5,
      })
      wikiSweepEventHandler?.({
        type: 'error',
        message: 'boom',
      })
      wikiSweepEventHandler?.({
        type: 'done',
        totalOps: 0,
        snapshotPath: null,
        stopped: false,
      })
    })

    expect(screen.getByText('boom')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 3, name: 'tabs.wikiSweepErrorsTitle' })).toBeTruthy()
    expect(screen.queryByText('tabs.wikiSweepSnapshotHint')).toBeNull()
    expect(screen.queryByRole('button', { name: 'tabs.wikiSweepSnapshotCopy' })).toBeNull()
  })

  it('onDismissSummary limpia el panel post-barrido con errores', async () => {
    render(<TabAgenticPlane {...planeBaseProps} tabActive />)

    fireEvent.click(screen.getByRole('button', { name: 'tabs.wikiMapButton' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'tabs.wikiSweepStart' })).toBeTruthy()
    })

    act(() => {
      wikiSweepEventHandler?.({
        type: 'error',
        message: 'boom',
      })
      wikiSweepEventHandler?.({
        type: 'done',
        totalOps: 0,
        snapshotPath: null,
        stopped: false,
      })
    })

    expect(screen.getByText('boom')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'tabs.wikiSweepSummaryClose' }))

    expect(screen.queryByText('boom')).toBeNull()
    expect(screen.queryByRole('heading', { level: 3, name: 'tabs.wikiSweepErrorsTitle' })).toBeNull()
  })

  it('done sin snapshotPath no muestra resumen', async () => {
    render(<TabAgenticPlane {...planeBaseProps} tabActive />)

    fireEvent.click(screen.getByRole('button', { name: 'tabs.wikiMapButton' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'tabs.wikiSweepStart' })).toBeTruthy()
    })

    act(() => {
      wikiSweepEventHandler?.({
        type: 'done',
        totalOps: 0,
        snapshotPath: null,
        stopped: false,
      })
    })

    expect(screen.queryByText('tabs.wikiSweepSnapshotTitle')).toBeNull()
  })
})
