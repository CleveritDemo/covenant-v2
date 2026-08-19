import { describe, expect, it, vi } from 'vitest'
import { composerEngineMissingForTab } from '../onboardingAppWiring'

describe('composerEngineMissingForTab', () => {
  it('returns false when planeOpenChatAgentId is null or undefined', () => {
    const resolveProvider = () => ''
    expect(
      composerEngineMissingForTab({ planeOpenChatAgentId: null }, resolveProvider),
    ).toBe(false)
    expect(
      composerEngineMissingForTab({ planeOpenChatAgentId: undefined }, resolveProvider),
    ).toBe(false)
    expect(composerEngineMissingForTab({}, resolveProvider)).toBe(false)
  })

  it('returns false when the open pane is not an agent', () => {
    const paneId = 'pane-terminal'
    expect(
      composerEngineMissingForTab(
        {
          planeOpenChatAgentId: paneId,
          paneKinds: { [paneId]: 'terminal' },
        },
        () => undefined,
      ),
    ).toBe(false)
  })

  it('returns true when agent pane has no provider', () => {
    const paneId = 'pane-agent'
    expect(
      composerEngineMissingForTab(
        {
          planeOpenChatAgentId: paneId,
          paneKinds: { [paneId]: 'agent' },
        },
        () => undefined,
      ),
    ).toBe(true)
  })

  it('returns true when provider is an empty string', () => {
    const paneId = 'pane-agent'
    expect(
      composerEngineMissingForTab(
        {
          planeOpenChatAgentId: paneId,
          paneKinds: { [paneId]: 'agent' },
        },
        () => '',
      ),
    ).toBe(true)
  })

  it('returns true when provider is only whitespace', () => {
    const paneId = 'pane-agent'
    expect(
      composerEngineMissingForTab(
        {
          planeOpenChatAgentId: paneId,
          paneKinds: { [paneId]: 'agent' },
        },
        () => '   ',
      ),
    ).toBe(true)
  })

  it('returns false when provider is set', () => {
    const paneId = 'pane-agent'
    expect(
      composerEngineMissingForTab(
        {
          planeOpenChatAgentId: paneId,
          paneKinds: { [paneId]: 'agent' },
        },
        () => 'cursor',
      ),
    ).toBe(false)
  })

  it('calls resolveProvider with planeOpenChatAgentId, not another pane', () => {
    const openPaneId = 'pane-open'
    const otherPaneId = 'pane-other'
    const resolveProvider = vi.fn((paneId: string) =>
      paneId === openPaneId ? 'cursor' : undefined,
    )

    composerEngineMissingForTab(
      {
        planeOpenChatAgentId: openPaneId,
        paneKinds: { [openPaneId]: 'agent', [otherPaneId]: 'agent' },
      },
      resolveProvider,
    )

    expect(resolveProvider).toHaveBeenCalledTimes(1)
    expect(resolveProvider).toHaveBeenCalledWith(openPaneId)
    expect(resolveProvider).not.toHaveBeenCalledWith(otherPaneId)
  })
})
