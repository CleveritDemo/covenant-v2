/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

describe('PlaneChatComposer — aviso de CLI ausente', () => {
  it('con agentCliMissing no llama onSend y muestra el aviso', async () => {
    const onSend = vi.fn()
    const { container } = render(
      <PlaneChatComposer
        agents={agents}
        contexts={[] as never}
        selectedAgentId="a"
        placeholder="msg"
        emptyAgentsHint="empty"
        sendLabel="send"
        agentCliMissing
        onSelectAgent={vi.fn()}
        onStop={vi.fn()}
        onSend={onSend}
      />,
    )

    const input = container.querySelector('textarea') as HTMLTextAreaElement
    await act(async () => {
      fireEvent.change(input, { target: { value: 'hola' } })
    })
    fireEvent.click(screen.getByRole('button', { name: 'send' }))

    expect(screen.getByRole('status').textContent).toBe('tabs.composerCliMissing')
    await act(async () => {
      await Promise.resolve()
    })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('sin agentCliMissing llama onSend', async () => {
    const onSend = vi.fn()
    const { container } = render(
      <PlaneChatComposer
        agents={agents}
        contexts={[] as never}
        selectedAgentId="a"
        placeholder="msg"
        emptyAgentsHint="empty"
        sendLabel="send"
        onSelectAgent={vi.fn()}
        onStop={vi.fn()}
        onSend={onSend}
      />,
    )

    const input = container.querySelector('textarea') as HTMLTextAreaElement
    await act(async () => {
      fireEvent.change(input, { target: { value: 'hola' } })
    })
    fireEvent.click(screen.getByRole('button', { name: 'send' }))

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledTimes(1)
    })
    expect(screen.queryByText('tabs.composerCliMissing')).toBeNull()
  })
})
