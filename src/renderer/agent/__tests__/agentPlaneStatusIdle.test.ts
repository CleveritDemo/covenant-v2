import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentChatEntry } from '@shared/agentCliTypes'
import type { AgentPlaneStatus } from '../AgentPane'
import {
  planeStatusUserSnippet,
  resolvePlaneStatusMessages,
  runningThreadActivitiesEqual,
} from '../agentPlaneStatusIdle'
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
    activityKey: '',
    activityStartedAtMs: 0,
    lastSnippet: messages.at(-1)?.content ?? '',
    lastUserSnippet: '',
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
    turnCloseReason: null,
    queuedTurns: [],
    canClearConversation: messages.length > 0,
    runningThreadIds: [],
    runningThreadActivities: {},
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

describe('planeStatusUserSnippet', () => {
  it('takes the last user message, ignoring assistant turns', () => {
    expect(planeStatusUserSnippet([
      { id: 'u1', role: 'user', content: 'primera' },
      { id: 'u2', role: 'user', content: 'segunda' },
      { id: 'a1', role: 'assistant', content: 'respuesta' },
    ])).toBe('segunda')
  })

  it('de un encargo delegado muestra el objetivo, no la cabecera', () => {
    expect(planeStatusUserSnippet([
      {
        id: 'u1',
        role: 'user',
        content: [
          '## Delegation brief',
          'from: tl',
          'round: 1/3',
          '',
          'Revisa el login.',
          '',
          'Preferred context ids: Front-Rules',
        ].join('\n'),
      },
    ])).toBe('Revisa el login.')
  })

  it('skips blank user messages', () => {
    expect(planeStatusUserSnippet([
      { id: 'u1', role: 'user', content: 'real' },
      { id: 'u2', role: 'user', content: '   ' },
    ])).toBe('real')
  })

  it('truncates at 120 chars with an ellipsis', () => {
    const snippet = planeStatusUserSnippet([
      { id: 'u1', role: 'user', content: 'x'.repeat(200) },
    ])
    expect(snippet).toHaveLength(118)
    expect(snippet.endsWith('…')).toBe(true)
  })

  it('leaves a 120-char message untouched', () => {
    const exact = 'y'.repeat(120)
    expect(planeStatusUserSnippet([{ id: 'u1', role: 'user', content: exact }])).toBe(exact)
  })

  it('returns empty when there is no user message', () => {
    expect(planeStatusUserSnippet([
      { id: 'a1', role: 'assistant', content: 'solo asistente' },
    ])).toBe('')
    expect(planeStatusUserSnippet([])).toBe('')
  })

  it('ignora follow-ups de delegación del host', () => {
    expect(planeStatusUserSnippet([
      { id: 'u1', role: 'user', content: '## Delegation result id: d1\nok' },
      { id: 'u0', role: 'user', content: 'petición real' },
    ])).toBe('petición real')
  })
})

describe('runningThreadActivitiesEqual', () => {
  it('treats undefined and empty as equal', () => {
    expect(runningThreadActivitiesEqual(undefined, {})).toBe(true)
    expect(runningThreadActivitiesEqual({}, undefined)).toBe(true)
  })

  it('compares values per thread', () => {
    expect(runningThreadActivitiesEqual({ t1: 'Read' }, { t1: 'Read' })).toBe(true)
    expect(runningThreadActivitiesEqual({ t1: 'Read' }, { t1: 'Edit' })).toBe(false)
  })

  it('detects added and removed threads', () => {
    expect(runningThreadActivitiesEqual({ t1: 'Read' }, { t1: 'Read', t2: 'Edit' })).toBe(false)
    expect(runningThreadActivitiesEqual({ t1: 'Read', t2: 'Edit' }, { t1: 'Read' })).toBe(false)
  })

  it('ignores key order, a donde el JSON.stringify anterior sí era sensible', () => {
    expect(runningThreadActivitiesEqual({ a: '1', b: '2' }, { b: '2', a: '1' })).toBe(true)
  })

  it('no confunde claves distintas con el mismo número de entradas', () => {
    expect(runningThreadActivitiesEqual({ t1: 'Read' }, { t2: 'Read' })).toBe(false)
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
