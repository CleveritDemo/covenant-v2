/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { PlaneChatComposer } from '../PlaneChatComposer'
import { PLANE_CONTEXT_DRAG_MIME } from '../planeContextDrag'

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

const agents = [
  { paneId: 'a', title: 'Tech Lead', busy: false },
  { paneId: 'b', title: 'Frontend', busy: false },
]

const contexts = [
  {
    id: 'tree',
    name: 'Árbol',
    kind: 'folderTree' as const,
    kindLabel: 'tree',
    icon: 'folder',
    color: '#0f0',
  },
]

/** jsdom no trae DataTransfer; solo hace falta lo que usa el drop. */
const dragTransfer = (contextId: string) => ({
  types: [PLANE_CONTEXT_DRAG_MIME, 'text/plain'],
  getData: (type: string) => (type === PLANE_CONTEXT_DRAG_MIME ? contextId : contextId),
  dropEffect: '',
}) as unknown as DataTransfer

const view = (selectedAgentId: string) => (
  <PlaneChatComposer
    agents={agents}
    contexts={contexts as never}
    selectedAgentId={selectedAgentId}
    placeholder="msg"
    emptyAgentsHint="empty"
    sendLabel="send"
    onSelectAgent={vi.fn()}
    onStop={vi.fn()}
    onSend={vi.fn()}
  />
)

describe('PlaneChatComposer drafts por agente', () => {
  it('conserva texto, contextos e imágenes al cambiar de chip y volver', async () => {
    vi.stubGlobal('URL', Object.assign(URL, { revokeObjectURL: vi.fn() }))
    const { rerender, container } = render(view('a'))
    const input = () => container.querySelector('textarea') as HTMLTextAreaElement
    const chips = () => container.querySelectorAll('.plane-chat-composer__context')
    const thumbs = () => container.querySelectorAll('.pending-thumb')

    fireEvent.change(input(), { target: { value: 'para tech lead' } })
    fireEvent.drop(
      container.querySelector('.plane-chat-composer') as HTMLElement,
      { dataTransfer: dragTransfer('tree') },
    )
    await act(async () => {
      fireEvent.paste(input(), { clipboardData: { items: [], files: [] } })
    })
    expect(chips()).toHaveLength(1)
    expect(thumbs()).toHaveLength(1)

    rerender(view('b'))
    expect(input().value).toBe('')
    expect(chips()).toHaveLength(0)
    expect(thumbs()).toHaveLength(0)
    fireEvent.change(input(), { target: { value: 'para frontend' } })

    rerender(view('a'))
    expect(input().value).toBe('para tech lead')
    expect(chips()).toHaveLength(1)
    expect(thumbs()).toHaveLength(1)

    rerender(view('b'))
    expect(input().value).toBe('para frontend')
    expect(chips()).toHaveLength(0)
    expect(thumbs()).toHaveLength(0)
  })
})
