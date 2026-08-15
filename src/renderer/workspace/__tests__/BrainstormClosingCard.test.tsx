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

  it('asks for name then writes one context per room and tells the caller to refresh', async () => {
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
    expect(materializeTabContext).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'tabs.brainstormSaveContextConfirm' }))

    await waitFor(() => {
      expect(materializeTabContext).toHaveBeenCalledTimes(1)
    })
    const request = materializeTabContext.mock.calls[0][0]
    expect(request.context.id).toBe('iaterminal:notes:Cargar-la-wiki')
    expect(request.context.fileName).toBe('Cargar-la-wiki.md')
    expect(request.context.name).toBe('Cargar la wiki')
    expect(request.cwd).toBe('/tmp/project')
    expect(request.content).toContain('fixture primero')
    await waitFor(() => {
      expect(onContextSaved).toHaveBeenCalledTimes(1)
    })
  })
})

describe('BrainstormClosingCard — la decisión primero', () => {
  const closing = {
    decision: 'Ship the intersection now',
    why: 'done.code holds on both forks',
    agreed: 'R is out',
    open: 'V vs U',
    next: 'Cristian writes outcome',
  }

  beforeEach(() => {
    ;(window as unknown as { api: Record<string, unknown> }).api = {
      materializeTabContext: vi.fn(),
      exportBrainstormMarkdown: vi.fn(),
    }
  })

  afterEach(cleanup)

  function mount(): void {
    render(
      <BrainstormClosingCard
        roomId="r1"
        topic="telemetría"
        cwd="/tmp/project"
        closing={closing}
        speakerLabel="Cristian"
      />,
    )
  }

  it('de entrada solo la decisión: las cinco secciones se llevaban media pantalla', () => {
    mount()
    expect(screen.getByText('Ship the intersection now')).toBeTruthy()
    expect(screen.queryByText('done.code holds on both forks')).toBeNull()
    expect(screen.queryByText('Cristian writes outcome')).toBeNull()
  })

  it('el desplegable trae el resto y vuelve a plegarlo', () => {
    mount()
    const more = screen.getByText('tabs.brainstormClosingMore')
    fireEvent.click(more)
    expect(screen.getByText('done.code holds on both forks')).toBeTruthy()
    expect(screen.getByText('Cristian writes outcome')).toBeTruthy()

    fireEvent.click(screen.getByText('tabs.brainstormClosingLess'))
    expect(screen.queryByText('done.code holds on both forks')).toBeNull()
  })

  it('renderiza backticks y negritas del cuerpo vía AiMarkdown', () => {
    render(
      <BrainstormClosingCard
        roomId="r2"
        topic="markdown"
        cwd="/tmp/project"
        closing={{ decision: 'Abrir `src/foo.ts` con **negrita**' }}
        speakerLabel="frontend"
      />,
    )

    const code = screen.getByText('src/foo.ts')
    expect(code.tagName).toBe('CODE')
    const strong = screen.getByText('negrita')
    expect(strong.tagName).toBe('STRONG')
    expect(screen.queryByText(/`src\/foo\.ts`/)).toBeNull()
    expect(screen.queryByText(/\*\*negrita\*\*/)).toBeNull()
  })
})
