/**
 * @vitest-environment jsdom
 */
import React, { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
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

const agents = [{ paneId: 'a', title: 'Tech Lead', busy: true }]

describe('PlaneChatComposer — aviso de cola llena', () => {
  it('restaura el texto, muestra el aviso y lo cierra al escribir', async () => {
    const onDismiss = vi.fn()
    const initialNotice = { paneId: 'a', text: 'mensaje devuelto', at: Date.now() }

    function Harness(): React.ReactElement {
      const [notice, setNotice] = useState<typeof initialNotice | null>(initialNotice)
      return (
        <PlaneChatComposer
          agents={agents}
          contexts={[] as never}
          selectedAgentId="a"
          placeholder="msg"
          emptyAgentsHint="empty"
          sendLabel="send"
          queueFullNotice={notice}
          onQueueFullNoticeDismiss={() => {
            onDismiss()
            setNotice(null)
          }}
          onSelectAgent={vi.fn()}
          onStop={vi.fn()}
          onSend={vi.fn()}
        />
      )
    }

    const { container } = render(<Harness />)

    const input = container.querySelector('textarea') as HTMLTextAreaElement
    expect(input.value).toBe('mensaje devuelto')
    expect(screen.getByRole('status').textContent).toBe('plane.queueFullNotice')

    await act(async () => {
      fireEvent.change(input, { target: { value: 'mensaje devuelto!' } })
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('status')).toBeNull()
  })
})
