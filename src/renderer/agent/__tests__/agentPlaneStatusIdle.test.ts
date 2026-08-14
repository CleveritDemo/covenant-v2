import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentChatEntry } from '@shared/agentCliTypes'
import type { AgentPlaneStatus } from '../AgentPane'
import { resolvePlaneStatusMessages } from '../agentPlaneStatusIdle'
import { createPlaneStatusThrottler } from '../planeStatusThrottle'

const sampleMessages: AgentChatEntry[] = [
  { id: 'u1', role: 'user', content: 'hola' },
  { id: 'a1', role: 'assistant', content: 'respuesta' },
  { id: 's1', role: 'system', content: 'ignored' },
]

function minimalStatus(messages: AgentChatEntry[]): AgentPlaneStatus {
  return {
    busy: false,
    activity: '',
    lastSnippet: messages.at(-1)?.content ?? '',
    lastTurnFailed: false,
    contexts: [],
    messages,
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
    canClearConversation: messages.length > 0,
  }
}

describe('resolvePlaneStatusMessages', () => {
  it('returns empty messages when tab is inactive', () => {
    expect(resolvePlaneStatusMessages(false, sampleMessages)).toEqual([])
  })

  it('returns user and assistant messages when tab is active', () => {
    expect(resolvePlaneStatusMessages(true, sampleMessages)).toEqual([
      sampleMessages[0],
      sampleMessages[1],
    ])
  })
})

describe('agent plane status publish (inactive tab)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not include messages while tab is inactive', () => {
    const publish = vi.fn()
    const throttler = createPlaneStatusThrottler<AgentPlaneStatus>()

    throttler.schedule({
      controlKey: 'idle',
      value: minimalStatus(resolvePlaneStatusMessages(false, sampleMessages)),
      publish,
    })

    expect(publish).toHaveBeenCalledTimes(1)
    expect(publish.mock.calls[0]?.[0]?.messages).toEqual([])
  })

  it('includes messages while tab is active', () => {
    const publish = vi.fn()
    const throttler = createPlaneStatusThrottler<AgentPlaneStatus>()
    const messages = resolvePlaneStatusMessages(true, sampleMessages)

    throttler.schedule({
      controlKey: 'idle',
      value: minimalStatus(messages),
      publish,
    })

    expect(publish.mock.calls[0]?.[0]?.messages).toEqual(messages)
  })

  it('re-publishes full messages when tab becomes active', () => {
    vi.useFakeTimers()
    const publish = vi.fn()
    const throttler = createPlaneStatusThrottler<AgentPlaneStatus>()
    let tabActive = false

    const publishForTab = (becameActive: boolean): void => {
      const messages = resolvePlaneStatusMessages(tabActive, sampleMessages)
      throttler.schedule({
        controlKey: 'idle',
        value: minimalStatus(messages),
        publish,
      })
      if (becameActive) throttler.flush()
    }

    publishForTab(false)
    expect(publish.mock.calls.at(-1)?.[0]?.messages).toEqual([])

    tabActive = true
    publishForTab(true)
    expect(publish.mock.calls.at(-1)?.[0]?.messages).toEqual(
      resolvePlaneStatusMessages(true, sampleMessages),
    )
  })
})
