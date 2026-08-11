/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

import { BrainstormClosingCard } from '../BrainstormClosingCard'

describe('BrainstormClosingCard save as context', () => {
  const materializeTabContext = vi.fn()

  beforeEach(() => {
    materializeTabContext.mockReset()
    materializeTabContext.mockResolvedValue({ ok: true })
    ;(window as unknown as { api: Record<string, unknown> }).api = {
      materializeTabContext,
      exportBrainstormMarkdown: vi.fn(),
    }
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('writes one context per room and tells the caller to refresh', async () => {
    const onContextSaved = vi.fn()
    render(
      <BrainstormClosingCard
        roomId="Sala Karpathy"
        topic="Cargar la wiki"
        cwd="/tmp/project"
        closing={{ decision: 'fixture primero' }}
        speakerLabel="frontend"
        onContextSaved={onContextSaved}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'tabs.brainstormClosingSaveContext' }))

    await waitFor(() => {
      expect(materializeTabContext).toHaveBeenCalledTimes(1)
    })
    const request = materializeTabContext.mock.calls[0][0]
    expect(request.context.id).toBe('iaterminal:notes:brainstorm-sala-karpathy')
    expect(request.context.fileName).toBe('brainstorm-sala-karpathy.md')
    expect(request.cwd).toBe('/tmp/project')
    expect(request.content).toContain('fixture primero')
    await waitFor(() => {
      expect(onContextSaved).toHaveBeenCalledTimes(1)
    })
  })
})
