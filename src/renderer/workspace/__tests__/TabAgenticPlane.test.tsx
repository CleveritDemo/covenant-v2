/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { AgentPlaneStatus } from '../../agent/AgentPane'
import type { PlaneMapEntity } from '../PlaneMap'
import { TabAgenticPlane, type TabAgenticPlaneProps } from '../TabAgenticPlane'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}))

vi.mock('../useWikiGraphScene', () => ({
  useWikiGraphScene: () => ({ webglAvailable: false }),
}))

vi.mock('../PlaneMap', () => ({
  PlaneMap: () => <div data-testid="plane-map" />,
  planeFloorAuroraActive: () => false,
}))
vi.mock('../PlaneIdleGravity', () => ({ PlaneIdleGravity: () => null }))
vi.mock('../PlaneChatDock', () => ({
  PlaneChatDock: ({ toolbar }: { toolbar?: React.ReactNode }) => (
    <div data-testid="plane-chat-dock">{toolbar}</div>
  ),
}))
vi.mock('../PlaneChatComposer', () => ({ PlaneChatComposer: () => null }))

let lastContextsBarRunningThreadIds: readonly string[] = []

vi.mock('../PlaneChatContextsBar', () => ({
  PlaneChatContextsBar: ({ runningThreadIds }: { runningThreadIds?: readonly string[] }) => {
    lastContextsBarRunningThreadIds = runningThreadIds ?? []
    return <div data-testid="plane-chat-contexts-bar" />
  },
}))
vi.mock('../PlaneQuickChat', () => ({ PlaneQuickChat: () => null }))
vi.mock('../PlaneContextPool', () => ({ PlaneContextPool: () => null }))
vi.mock('../PlaneFabStack', () => ({ PlaneFabStack: () => null }))
vi.mock('../PlaneLoopsSection', () => ({ PlaneLoopsSection: () => null }))
vi.mock('../PlaneBrainstormTable', () => ({ PlaneBrainstormTable: () => null }))
vi.mock('../TabFileExplorerWindow', () => ({ TabFileExplorerWindow: () => null }))
vi.mock('../PulseView', () => ({ PulseView: () => null }))
vi.mock('../../components/ConfirmTerminalModal', () => ({ ConfirmTerminalModal: () => null }))

beforeEach(() => {
  lastContextsBarRunningThreadIds = []
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    getWikiGraph: vi.fn(async () => ({ ok: true, data: { nodes: [], edges: [] } })),
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

const AGENT_PANE = 'agent-1'

const chatStatus = (runningThreadIds: string[] = []): AgentPlaneStatus => ({
  busy: false,
  activity: '',
  activityKey: '',
  activityStartedAtMs: 0,
  lastEventAtMs: 0,
  activityCanGoStale: false,
  lastSnippet: '',
  lastUserSnippet: '',
  lastTurnFailed: false,
  contexts: [],
  messages: [{ id: 'm1', role: 'user', content: 'hi' }],
  activeAssistantId: null,
  enteringIds: [],
  materializingIds: [],
  settlingId: null,
  awaitingDelegations: false,
  orchestrationAwaiting: null,
  delegationWorkActive: false,
  orchestratorBusy: false,
  turnCloseReason: null,
  queuedTurns: [],
  canClearConversation: true,
  runningThreadIds,
  runningThreadActivities: {},
})

const agentEntity = (threads?: PlaneMapEntity['threads']): PlaneMapEntity => ({
  paneId: AGENT_PANE,
  kind: 'agent',
  title: 'Agent',
  busy: false,
  window: { open: false, fullscreen: false, zIndex: 1 },
  threads,
})

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
  activePaneId: AGENT_PANE,
  openChatAgentId: AGENT_PANE,
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

describe('TabAgenticPlane openChatRunningThreadIdsMerged', () => {
  it('une status y prop sin duplicar el id compartido', () => {
    render(
      <TabAgenticPlane
        {...baseProps}
        entities={[agentEntity()]}
        agentStatuses={{ [AGENT_PANE]: chatStatus(['t-shared']) }}
        openChatRunningThreadIds={['t-shared', 't-2', 't-3']}
      />,
    )
    expect(lastContextsBarRunningThreadIds).toEqual(['t-shared', 't-2', 't-3'])
  })

  it('usa los ids de la prop cuando el status viene vacío', () => {
    render(
      <TabAgenticPlane
        {...baseProps}
        entities={[agentEntity()]}
        agentStatuses={{ [AGENT_PANE]: chatStatus([]) }}
        openChatRunningThreadIds={['t-1', 't-2']}
      />,
    )
    expect(lastContextsBarRunningThreadIds).toEqual(['t-1', 't-2'])
  })

  it('cae al fallback de entities cuando status y prop están vacíos', () => {
    render(
      <TabAgenticPlane
        {...baseProps}
        entities={[agentEntity([
          { id: 't-run-a', title: 'A', running: true },
          { id: 't-idle', title: 'B', running: false },
          { id: 't-run-b', title: 'C', running: true },
        ])]}
        agentStatuses={{ [AGENT_PANE]: chatStatus([]) }}
        openChatRunningThreadIds={[]}
      />,
    )
    expect(lastContextsBarRunningThreadIds).toEqual(['t-run-a', 't-run-b'])
  })
})
