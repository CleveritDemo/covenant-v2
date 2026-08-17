/**
 * @vitest-environment jsdom
 *
 * CT-129: el historial ↑ se siembra del transcript persistido, no de envíos
 * de esta sesión.
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
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

describe('PlaneChatComposer: historial sembrado del transcript', () => {
  it('↑ deja el último prompt del loader sin haber enviado nada en esta sesión', async () => {
    const seeded = Promise.resolve(['uno', 'dos'])
    const onLoadPromptHistory = vi.fn().mockReturnValue(seeded)
    const { container } = render(
      <PlaneChatComposer
        agents={agents}
        selectedAgentId="a"
        activeThreadId="thread-1"
        placeholder="msg"
        emptyAgentsHint="empty"
        sendLabel="send"
        onSelectAgent={vi.fn()}
        onStop={vi.fn()}
        onSend={vi.fn()}
        onLoadPromptHistory={onLoadPromptHistory}
      />,
    )
    await act(async () => {
      await seeded
    })
    const input = container.querySelector('textarea') as HTMLTextAreaElement
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(input.value).toBe('dos')
    expect(onLoadPromptHistory).toHaveBeenCalledWith('a', 'thread-1')
  })
})
