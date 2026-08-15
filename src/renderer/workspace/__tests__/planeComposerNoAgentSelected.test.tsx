/**
 * @vitest-environment jsdom
 *
 * CT-125: con agentes en el plano pero ninguno seleccionado, la barra de chat
 * queda deshabilitada (textarea + envío) y orienta con placeholder/tooltip.
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
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

const twoAgents = [
  { paneId: 'a', title: 'Tech Lead', busy: false },
  { paneId: 'b', title: 'Frontend', busy: false },
]

function view(overrides: {
  agents?: typeof twoAgents
  selectedAgentId?: string | null
  emptyAgentsHint?: string
} = {}) {
  return (
    <PlaneChatComposer
      agents={overrides.agents ?? twoAgents}
      contexts={[] as never}
      selectedAgentId={overrides.selectedAgentId === undefined ? null : overrides.selectedAgentId}
      placeholder="msg"
      emptyAgentsHint={overrides.emptyAgentsHint ?? 'empty'}
      sendLabel="send"
      onSelectAgent={vi.fn()}
      onStop={vi.fn()}
      onSend={vi.fn()}
    />
  )
}

describe('PlaneChatComposer: sin agente seleccionado', () => {
  it('con agentes y selectedAgentId null deshabilita el textarea y muestra el placeholder', () => {
    const { container } = render(view())
    const input = container.querySelector('textarea') as HTMLTextAreaElement
    expect(input.disabled).toBe(true)
    expect(input.placeholder).toBe('tabs.planeComposerSelectAgent')
  })

  it('en ese estado el botón de envío está disabled', () => {
    const { container } = render(view())
    const send = container.querySelector('.plane-chat-composer__send') as HTMLButtonElement
    expect(send.disabled).toBe(true)
  })

  it('al seleccionar un agente el textarea se habilita y vuelve el placeholder normal', () => {
    const { container, rerender } = render(view())
    rerender(view({ selectedAgentId: 'a' }))
    const input = container.querySelector('textarea') as HTMLTextAreaElement
    expect(input.disabled).toBe(false)
    expect(input.placeholder).toBe('msg')
  })

  it('sin agentes sigue mostrando emptyAgentsHint', () => {
    const { container } = render(view({ agents: [], emptyAgentsHint: 'Crea un agente' }))
    const input = container.querySelector('textarea') as HTMLTextAreaElement
    expect(input.disabled).toBe(true)
    expect(input.placeholder).toBe('Crea un agente')
  })
})
