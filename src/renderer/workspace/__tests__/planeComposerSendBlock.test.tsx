/**
 * @vitest-environment jsdom
 *
 * Bloqueo de envío del composer por CLI faltante o motor vacío.
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PlaneChatComposer } from '../PlaneChatComposer'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}))

vi.mock('../../agent/composerImages', async importOriginal => {
  const actual = await importOriginal<typeof import('../../agent/composerImages')>()
  return {
    ...actual,
    imagesFromClipboard: () => [],
    materializeClipboardImage: async () => null,
    pendingImagesToAttachments: async () => [],
  }
})

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

function view(
  onSend: (...args: never[]) => void,
  overrides: {
    sendBlock?: 'none' | 'cli' | 'engine'
    agentCliMissing?: boolean
  } = {},
) {
  return (
    <PlaneChatComposer
      agents={agents}
      contexts={[] as never}
      selectedAgentId="a"
      placeholder="msg"
      emptyAgentsHint="empty"
      sendLabel="send"
      onSelectAgent={vi.fn()}
      onStop={vi.fn()}
      onSend={onSend as never}
      sendBlock={overrides.sendBlock}
      agentCliMissing={overrides.agentCliMissing}
    />
  )
}

async function typeAndEnter(container: HTMLElement, text: string): Promise<void> {
  const input = container.querySelector('textarea') as HTMLTextAreaElement
  await act(async () => {
    fireEvent.change(input, { target: { value: text } })
  })
  await act(async () => {
    fireEvent.keyDown(input, { key: 'Enter' })
  })
}

describe('PlaneChatComposer: sendBlock', () => {
  it('sendBlock engine muestra aviso de motor y no llama onSend', async () => {
    const onSend = vi.fn()
    const { container } = render(view(onSend, { sendBlock: 'engine' }))
    await typeAndEnter(container, 'hola')
    expect(screen.getByText('tabs.composerEngineMissing')).toBeTruthy()
    expect(onSend).not.toHaveBeenCalled()
  })

  it('sendBlock cli muestra aviso de CLI y no llama onSend', async () => {
    const onSend = vi.fn()
    const { container } = render(view(onSend, { sendBlock: 'cli' }))
    await typeAndEnter(container, 'hola')
    expect(screen.getByText('tabs.composerCliMissing')).toBeTruthy()
    expect(onSend).not.toHaveBeenCalled()
  })

  it('sendBlock none sin agentCliMissing envía el texto', async () => {
    const onSend = vi.fn()
    const { container } = render(view(onSend, { sendBlock: 'none', agentCliMissing: false }))
    await typeAndEnter(container, 'mensaje libre')
    expect(onSend).toHaveBeenCalledTimes(1)
    expect(onSend.mock.calls[0]?.[1]).toBe('mensaje libre')
  })

  it('agentCliMissing sin sendBlock bloquea con aviso de CLI', async () => {
    const onSend = vi.fn()
    const { container } = render(view(onSend, { agentCliMissing: true }))
    await typeAndEnter(container, 'hola')
    expect(screen.getByText('tabs.composerCliMissing')).toBeTruthy()
    expect(onSend).not.toHaveBeenCalled()
  })
})
