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
  PlaneMap: ({ wikiOverlay }: { wikiOverlay?: React.ReactNode }) => (
    <div data-testid="plane-map">{wikiOverlay}</div>
  ),
}))
vi.mock('../PlaneIdleGravity', () => ({ PlaneIdleGravity: () => null }))
vi.mock('../PlaneChatDock', () => ({
  PlaneChatDock: ({ chat }: { chat?: React.ReactNode }) => (
    <div className="plane-chat-dock" data-testid="plane-chat-dock">{chat}</div>
  ),
}))
vi.mock('../PlaneChatComposer', () => ({ PlaneChatComposer: () => null }))
vi.mock('../PlaneChatContextsBar', () => ({ PlaneChatContextsBar: () => null }))
vi.mock('../PlaneQuickChat', () => ({
  PlaneQuickChat: () => <div className="plane-quick-chat" />,
}))
vi.mock('../PlaneContextPool', () => ({ PlaneContextPool: () => null }))
vi.mock('../PlaneFabStack', () => ({ PlaneFabStack: () => null }))
vi.mock('../PlaneLoopsSection', () => ({ PlaneLoopsSection: () => null }))
vi.mock('../PlaneBrainstormTable', () => ({ PlaneBrainstormTable: () => null }))
vi.mock('../TabFileExplorerWindow', () => ({ TabFileExplorerWindow: () => null }))
vi.mock('../PulseModal', () => ({ PulseModal: () => null }))
vi.mock('../../components/ConfirmTerminalModal', () => ({ ConfirmTerminalModal: () => null }))

beforeEach(() => {
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    getWikiGraph: vi.fn(),
    ensureWiki: vi.fn(async () => ({ ok: true })),
    onWikiCuratorEvent: vi.fn((_cwd: string, _cb: (event: unknown) => void) => () => undefined),
    startWikiCuratorTurn: vi.fn(),
    stopWikiCuratorTurn: vi.fn(),
    getWikiCuratorConfig: vi.fn(async () => ({ ok: true as const, config: {} })),
    setWikiCuratorConfig: vi.fn(async () => ({ ok: true as const })),
  }
})

afterEach(cleanup)

const AGENT_PANE = 'agent-1'
const TERMINAL_PANE = 'term-1'

const agentEntity = (): PlaneMapEntity => ({
  paneId: AGENT_PANE,
  kind: 'agent',
  title: 'Agent',
  busy: false,
  window: { open: false, fullscreen: false, zIndex: 1 },
})

const terminalEntity = (open: boolean): PlaneMapEntity => ({
  paneId: TERMINAL_PANE,
  kind: 'terminal',
  title: 'Terminal',
  busy: false,
  window: { open, fullscreen: false, zIndex: 2 },
})

const chatStatus = (): AgentPlaneStatus => ({
  busy: false,
  activity: '',
  lastSnippet: '',
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
  loopMode: false,
  loopActive: false,
  localLoopActive: false,
  turnCloseReason: null,
  loopEndReason: null,
  queuedTurns: [],
  canClearConversation: true,
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
  agentStatuses: { [AGENT_PANE]: chatStatus() },
} as unknown as TabAgenticPlaneProps

describe('PlaneQuickChat con terminal expandida', () => {
  it('oculta el stream cuando una terminal del plano está expandida', () => {
    render(
      <TabAgenticPlane
        {...baseProps}
        entities={[agentEntity(), terminalEntity(true)]}
      />,
    )
    expect(document.querySelector('.plane-quick-chat')).toBeNull()
  })

  it('muestra el stream cuando la terminal no está expandida', () => {
    render(
      <TabAgenticPlane
        {...baseProps}
        entities={[agentEntity(), terminalEntity(false)]}
      />,
    )
    expect(document.querySelector('.plane-quick-chat')).not.toBeNull()
  })
})
