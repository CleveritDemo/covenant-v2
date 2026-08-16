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
        sweep={{
          running: false,
          pass: null,
          index: 0,
          total: 5,
          opsApplied: 0,
          onStart: vi.fn(),
          onStop: vi.fn(),
        }}
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
          running: true,
          pass: 'health',
          index: 1,
          total: 5,
          opsApplied: 3,
          onStart: vi.fn(),
          onStop: vi.fn(),
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
  })
})
