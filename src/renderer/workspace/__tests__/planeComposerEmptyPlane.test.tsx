/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { TabAgenticPlane, type TabAgenticPlaneProps } from '../TabAgenticPlane'
import type { PlaneMapEntity } from '../PlaneMap'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}))

vi.mock('../useWikiGraphScene', () => ({
  useWikiGraphScene: () => ({ webglAvailable: false }),
}))

vi.mock('../../reduceMotion', () => ({
  isReduceMotionActive: () => true,
}))

vi.mock('../PlaneMap', () => ({
  PlaneMap: () => <div data-testid="plane-map" />,
  planeFloorAuroraActive: () => false,
}))
vi.mock('../PlaneIdleGravity', () => ({ PlaneIdleGravity: () => null }))
vi.mock('../OnboardingCoachMark', () => ({ OnboardingCoachMark: () => null }))
vi.mock('../PlaneChatDock', () => ({
  PlaneChatDock: ({ composer }: { composer?: React.ReactNode }) => (
    <div data-testid="plane-chat-dock">{composer}</div>
  ),
}))
vi.mock('../PlaneChatComposer', () => ({
  PlaneChatComposer: () => <div data-testid="plane-chat-composer" />,
}))
vi.mock('../PlaneChatContextsBar', () => ({ PlaneChatContextsBar: () => null }))
vi.mock('../PlaneQuickChat', () => ({ PlaneQuickChat: () => null }))
vi.mock('../PlaneContextPool', () => ({ PlaneContextPool: () => null }))
vi.mock('../PlaneContextAssignmentLinks', () => ({ PlaneContextAssignmentLinks: () => null }))
vi.mock('../PlaneFabStack', () => ({ PlaneFabStack: () => null }))
vi.mock('../PlaneLoopsSection', () => ({ PlaneLoopsSection: () => null }))
vi.mock('../PlaneBrainstormTable', () => ({ PlaneBrainstormTable: () => null }))
vi.mock('../TabFileExplorerWindow', () => ({ TabFileExplorerWindow: () => null }))
vi.mock('../PulseView', () => ({ PulseView: () => null }))
vi.mock('../../components/ConfirmTerminalModal', () => ({ ConfirmTerminalModal: () => null }))

beforeEach(() => {
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    getWikiGraph: vi.fn(async () => ({ ok: true, data: { nodes: [], edges: [] } })),
    ensureWiki: vi.fn(async () => ({ ok: true })),
    onWikiCuratorEvent: vi.fn((_cwd: string, _cb: (event: unknown) => void) => () => undefined),
    startWikiCuratorTurn: vi.fn(),
    stopWikiCuratorTurn: vi.fn(),
    isWikiCuratorTurnActive: vi.fn(async () => false),
    getWikiCuratorConfig: vi.fn(async () => ({ ok: true as const, config: {} })),
    setWikiCuratorConfig: vi.fn(async () => ({ ok: true as const })),
    listAgentCliModels: vi.fn(async () => ({ models: [], source: 'fallback' as const })),
    resolveAgentCli: vi.fn(async (provider: string) => ({
      provider,
      command: provider,
      path: `/usr/local/bin/${provider}`,
      version: null,
    })),
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
  agentStatuses: {},
  activePaneId: '',
  openChatAgentId: null,
  openChatThreads: [],
  gitRepos: [],
  loopChains: [],
  loopsOpen: false,
  loopsButtonLabel: 'loops',
  projectFolder: '/tmp/project',
  projectFolderSelectLabel: '',
  projectFolderChangeLabel: '',
  projectFolderEmptyHint: '',
  projectFolderRevealLabel: '',
  configLabel: '',
  deleteLabel: '',
  maximizeLabel: '',
  restoreLabel: '',
  closeWindowLabel: '',
  canAdd: true,
  renderPane: () => null,
  onOpenChatAgentChange: vi.fn(),
  onLoopsOpenChange: vi.fn(),
  onLoopChainsChange: vi.fn(),
  onStartLoopChain: vi.fn(),
  onStopLoopChain: vi.fn(),
  onSelectProjectFolder: vi.fn(),
  onMinimizeAllWindows: vi.fn(),
} as unknown as TabAgenticPlaneProps

const agentEntity = {
  paneId: 'agent-1',
  kind: 'agent',
  title: 'David',
  monogram: 'D',
  busy: false,
  window: { open: false, fullscreen: false },
} as unknown as PlaneMapEntity

describe('composer en plano vacío', () => {
  it('no monta el composer sin agentes ni terminales', () => {
    render(<TabAgenticPlane {...baseProps} entities={[]} />)
    expect(screen.queryByTestId('plane-chat-composer')).toBeNull()
  })

  it('monta el composer cuando hay al menos un agente', () => {
    render(<TabAgenticPlane {...baseProps} entities={[agentEntity]} />)
    expect(screen.getByTestId('plane-chat-composer')).toBeTruthy()
  })

  it('no monta el composer con hideComposer aunque haya agentes', () => {
    render(<TabAgenticPlane {...baseProps} entities={[agentEntity]} hideComposer />)
    expect(screen.queryByTestId('plane-chat-composer')).toBeNull()
  })
})
