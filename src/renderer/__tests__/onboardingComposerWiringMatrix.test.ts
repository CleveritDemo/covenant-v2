import { describe, expect, it } from 'vitest'
import { type OrchestratorPath } from '@shared/onboarding'
import { resolveComposerSendBlock } from '@shared/onboardingFlow'
import { composerEngineMissingForTab } from '../onboardingAppWiring'

const agentPaneId = 'pane-agent'

function resolveBlock(args: {
  incomplete: boolean
  path: OrchestratorPath | ''
  cliAllMissing: boolean
  planeOpenChatAgentId?: string | null
  paneKinds?: Record<string, unknown>
  provider?: string
}): ReturnType<typeof resolveComposerSendBlock> {
  const openPaneId = args.planeOpenChatAgentId ?? null
  const resolveProvider = (paneId: string) =>
    openPaneId && paneId === openPaneId ? args.provider : undefined

  const engineMissing = composerEngineMissingForTab(
    { planeOpenChatAgentId: args.planeOpenChatAgentId, paneKinds: args.paneKinds },
    resolveProvider,
  )

  return resolveComposerSendBlock({
    incomplete: args.incomplete,
    path: args.path,
    cliAllMissing: args.cliAllMissing,
    engineMissing,
  })
}

describe('onboarding composer wiring matrix', () => {
  it('returns none when onboarding is complete even with empty provider', () => {
    expect(
      resolveBlock({
        incomplete: false,
        path: 'engineer',
        cliAllMissing: false,
        planeOpenChatAgentId: agentPaneId,
        paneKinds: { [agentPaneId]: 'agent' },
        provider: '',
      }),
    ).toBe('none')
  })

  it('returns none for business path during incomplete onboarding', () => {
    expect(
      resolveBlock({
        incomplete: true,
        path: 'business',
        cliAllMissing: false,
        planeOpenChatAgentId: agentPaneId,
        paneKinds: { [agentPaneId]: 'agent' },
        provider: '',
      }),
    ).toBe('none')
  })

  it('returns none when orchestrator path is empty', () => {
    expect(
      resolveBlock({
        incomplete: true,
        path: '',
        cliAllMissing: false,
        planeOpenChatAgentId: agentPaneId,
        paneKinds: { [agentPaneId]: 'agent' },
        provider: '',
      }),
    ).toBe('none')
  })

  it('returns cli when engineer track and all CLIs are missing even with provider set', () => {
    expect(
      resolveBlock({
        incomplete: true,
        path: 'engineer',
        cliAllMissing: true,
        planeOpenChatAgentId: agentPaneId,
        paneKinds: { [agentPaneId]: 'agent' },
        provider: 'cursor',
      }),
    ).toBe('cli')
  })

  it('returns cli when both cli and engine are missing on engineer track', () => {
    expect(
      resolveBlock({
        incomplete: true,
        path: 'engineer',
        cliAllMissing: true,
        planeOpenChatAgentId: agentPaneId,
        paneKinds: { [agentPaneId]: 'agent' },
        provider: '',
      }),
    ).toBe('cli')
  })

  it('returns engine when engineer track has cli but agent pane has no provider', () => {
    expect(
      resolveBlock({
        incomplete: true,
        path: 'engineer',
        cliAllMissing: false,
        planeOpenChatAgentId: agentPaneId,
        paneKinds: { [agentPaneId]: 'agent' },
        provider: '',
      }),
    ).toBe('engine')
  })

  it('returns engine when provider is only whitespace', () => {
    expect(
      resolveBlock({
        incomplete: true,
        path: 'engineer',
        cliAllMissing: false,
        planeOpenChatAgentId: agentPaneId,
        paneKinds: { [agentPaneId]: 'agent' },
        provider: '   ',
      }),
    ).toBe('engine')
  })

  it('returns none when engineer track has cli and engine configured', () => {
    expect(
      resolveBlock({
        incomplete: true,
        path: 'engineer',
        cliAllMissing: false,
        planeOpenChatAgentId: agentPaneId,
        paneKinds: { [agentPaneId]: 'agent' },
        provider: 'claude',
      }),
    ).toBe('none')
  })

  it('returns none when open pane is not an agent even with empty provider', () => {
    expect(
      resolveBlock({
        incomplete: true,
        path: 'engineer',
        cliAllMissing: false,
        planeOpenChatAgentId: agentPaneId,
        paneKinds: { [agentPaneId]: 'terminal' },
        provider: '',
      }),
    ).toBe('none')
  })

  it('returns none when no agent chat pane is open', () => {
    expect(
      resolveBlock({
        incomplete: true,
        path: 'engineer',
        cliAllMissing: false,
        planeOpenChatAgentId: null,
        paneKinds: { [agentPaneId]: 'agent' },
        provider: '',
      }),
    ).toBe('none')
  })
})
