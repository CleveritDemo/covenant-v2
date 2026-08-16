/**
 * @vitest-environment jsdom
 *
 * Paste largo (≥700 chars) no entra al textarea: tarjeta PASTED + compose al enviar.
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
    // Sin imágenes: el clipboard de estos casos es solo text/plain.
    imagesFromClipboard: () => [],
    materializeClipboardImage: async () => ({
      id: 'img1',
      previewUrl: 'blob:img1',
      blob: new Blob(['x']),
      mimeType: 'image/png',
      name: 'a.png',
    }),
    pendingImagesToAttachments: async images => {
      if (images.length === 0) return []
      await new Promise(resolve => setTimeout(resolve, 5))
      return [{ name: 'a.png', mimeType: 'image/png', base64: 'eA==' }]
    },
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

const agents = [{ paneId: 'a', title: 'Tech Lead', busy: true }]

function view(onSend: (...args: never[]) => void) {
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
    />
  )
}

function textPasteEvent(text: string) {
  return {
    clipboardData: {
      getData: () => text,
      items: [],
      files: [],
    },
  } as unknown as ClipboardEvent
}

describe('PlaneChatComposer: texto pegado largo', () => {
  it('pega 900 chars como tarjeta y deja el textarea vacío', async () => {
    const pasted = 'x'.repeat(900)
    const onSend = vi.fn()
    const { container } = render(view(onSend))
    const input = container.querySelector('textarea') as HTMLTextAreaElement
    await act(async () => {
      fireEvent.paste(input, textPasteEvent(pasted))
    })
    expect(input.value).toBe('')
    expect(screen.getByLabelText('agentPane.pastedTextTitle')).toBeTruthy()
  })

  it('al enviar antepone el typed y concatena el pegado', async () => {
    const pasted = 'y'.repeat(900)
    const onSend = vi.fn()
    const { container } = render(view(onSend))
    const input = container.querySelector('textarea') as HTMLTextAreaElement
    await act(async () => {
      fireEvent.paste(input, textPasteEvent(pasted))
    })
    expect(screen.getByLabelText('agentPane.pastedTextTitle')).toBeTruthy()
    await act(async () => {
      fireEvent.change(input, { target: { value: 'hola' } })
    })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })
    expect(onSend).toHaveBeenCalledTimes(1)
    expect(onSend.mock.calls[0]?.[1]).toBe(`hola\n\n${pasted}`)
  })

  it('pega 50 chars sin crear tarjeta', async () => {
    const short = 'z'.repeat(50)
    const onSend = vi.fn()
    const { container } = render(view(onSend))
    const input = container.querySelector('textarea') as HTMLTextAreaElement
    await act(async () => {
      fireEvent.paste(input, textPasteEvent(short))
    })
    expect(screen.queryByLabelText('agentPane.pastedTextTitle')).toBeNull()
    expect(container.querySelector('.pasted-text')).toBeNull()
  })
})
