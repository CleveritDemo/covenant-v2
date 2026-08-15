/**
 * @vitest-environment jsdom
 *
 * Un Enter = un envío. Cubre el reporte de "aparecen copias iguales en la cola":
 * si el composer emitiera onSend más de una vez por pulsación, App encolaría
 * varias copias y el dedupe por sendId del pane no las vería (ids distintos).
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { PlaneChatComposer } from '../PlaneChatComposer'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}))

vi.mock('../../agent/composerImages', async importOriginal => {
  const actual = await importOriginal<typeof import('../../agent/composerImages')>()
  return {
    ...actual,
    imagesFromClipboard: () => [new File(['x'], 'a.png', { type: 'image/png' })],
    materializeClipboardImage: async () => ({
      id: 'img1',
      previewUrl: 'blob:img1',
      blob: new Blob(['x']),
      mimeType: 'image/png',
      name: 'a.png',
    }),
    // jsdom no encodea imágenes: el adjunto llega resuelto pero con demora,
    // igual que en la app (optimize + base64 tardan frames).
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

const pasteEvent = () => ({
  clipboardData: { items: [], files: [], types: [] },
}) as unknown as ClipboardEvent

describe('PlaneChatComposer: un Enter = un envío', () => {
  it('encola una sola vez con texto', async () => {
    const onSend = vi.fn()
    const { container } = render(view(onSend))
    const input = container.querySelector('textarea') as HTMLTextAreaElement
    await act(async () => {
      fireEvent.change(input, { target: { value: 'continua haciendo más test' } })
    })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })
    expect(onSend).toHaveBeenCalledTimes(1)
    expect(onSend.mock.calls[0]?.[1]).toBe('continua haciendo más test')
  })

  it('no duplica con Enter repetido (autorrepetición de tecla)', async () => {
    const onSend = vi.fn()
    const { container } = render(view(onSend))
    const input = container.querySelector('textarea') as HTMLTextAreaElement
    await act(async () => {
      fireEvent.change(input, { target: { value: 'mismo texto' } })
    })
    // Un act por pulsación: React vacía el estado entre teclas, como en la app.
    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter' })
      })
    }
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('con imagen adjunta envía una vez y lleva el adjunto', async () => {
    vi.stubGlobal('URL', Object.assign(URL, { revokeObjectURL: vi.fn() }))
    const onSend = vi.fn()
    const { container } = render(view(onSend))
    const input = container.querySelector('textarea') as HTMLTextAreaElement
    await act(async () => {
      fireEvent.paste(input, pasteEvent())
    })
    expect(container.querySelectorAll('.pending-thumb').length).toBe(1)
    await act(async () => {
      fireEvent.change(input, { target: { value: 'con imagen' } })
    })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
      await new Promise(resolve => setTimeout(resolve, 20))
    })
    expect(onSend).toHaveBeenCalledTimes(1)
    expect(onSend.mock.calls[0]?.[1]).toBe('con imagen')
    expect((onSend.mock.calls[0]?.[2] as unknown[])?.length).toBe(1)
  })

  it('con imagen y Enter repetido tampoco duplica', async () => {
    vi.stubGlobal('URL', Object.assign(URL, { revokeObjectURL: vi.fn() }))
    const onSend = vi.fn()
    const { container } = render(view(onSend))
    const input = container.querySelector('textarea') as HTMLTextAreaElement
    await act(async () => {
      fireEvent.paste(input, pasteEvent())
    })
    await act(async () => {
      fireEvent.change(input, { target: { value: 'con imagen' } })
    })
    for (let i = 0; i < 2; i += 1) {
      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter' })
      })
    }
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20))
    })
    expect(onSend).toHaveBeenCalledTimes(1)
  })
})
