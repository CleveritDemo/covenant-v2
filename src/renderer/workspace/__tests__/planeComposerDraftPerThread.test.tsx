/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { PlaneChatComposer } from '../PlaneChatComposer'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}))

vi.mock('../pushToTalkSpeech', () => ({
  usePushToTalkSpeech: () => ({
    listening: false,
    interim: '',
    level: 0,
    start: vi.fn(),
    stop: vi.fn(),
  }),
  classifyDictationError: () => 'unsupported',
}))

afterEach(cleanup)

const agents = [{ paneId: 'a', title: 'Tech Lead', busy: false }]

const view = (activeThreadId: string) => (
  <PlaneChatComposer
    agents={agents}
    selectedAgentId="a"
    activeThreadId={activeThreadId}
    placeholder="msg"
    emptyAgentsHint="empty"
    sendLabel="send"
    onSelectAgent={vi.fn()}
    onStop={vi.fn()}
    onSend={vi.fn()}
  />
)

describe('PlaneChatComposer drafts por hilo', () => {
  it('conserva texto distinto al cambiar de conversación y volver', () => {
    const { rerender, container } = render(view('thread-a'))
    const input = () => container.querySelector('textarea') as HTMLTextAreaElement

    fireEvent.change(input(), { target: { value: 'borrador hilo A' } })

    rerender(view('thread-b'))
    expect(input().value).toBe('')
    fireEvent.change(input(), { target: { value: 'borrador hilo B' } })

    rerender(view('thread-a'))
    expect(input().value).toBe('borrador hilo A')

    rerender(view('thread-b'))
    expect(input().value).toBe('borrador hilo B')
  })
})
