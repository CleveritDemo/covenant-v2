/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { TabContext } from '@shared/tabContext'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

import { ContextPreviewBody } from '../ContextContentPreviewModal'
import { PROJECT_DIR } from '@shared/projectDir'

function context(id: string): TabContext {
  return { id, name: id, fileName: `${id}.md`, kind: 'notes' }
}

/** Promesa que resuelve cuando el test quiera: simula el IPC en vuelo. */
function deferred() {
  let resolve!: (value: { ok: true; content: string; filePath: string }) => void
  const promise = new Promise<{ ok: true; content: string; filePath: string }>(done => {
    resolve = done
  })
  return { promise, resolve }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ContextPreviewBody al cambiar de contexto', () => {
  it('mantiene el contenido anterior mientras carga el nuevo', async () => {
    const first = deferred()
    const second = deferred()
    const previewTabContext = vi.fn(({ context: target }: { context: TabContext }) =>
      (target.id === 'a' ? first.promise : second.promise))
    Object.assign(window, { api: { previewTabContext, listProjectAgents: vi.fn() } })

    const view = render(<ContextPreviewBody context={context('a')} cwd="/proyecto" />)
    first.resolve({ ok: true, content: 'contenido de A', filePath: `/proyecto/${PROJECT_DIR}/a.md` })
    await screen.findByText('contenido de A')

    view.rerender(<ContextPreviewBody context={context('b')} cwd="/proyecto" />)
    // Sin parpadeo: el panel sigue pintado hasta que llega B.
    expect(screen.getByText('contenido de A')).toBeTruthy()
    expect(screen.queryByText('tabContexts.loading')).toBeNull()

    second.resolve({ ok: true, content: 'contenido de B', filePath: `/proyecto/${PROJECT_DIR}/b.md` })
    await waitFor(() => expect(screen.getByText('contenido de B')).toBeTruthy())
  })

  it('no recarga si el catálogo se refresca con el mismo contexto', async () => {
    const first = deferred()
    const previewTabContext = vi.fn().mockReturnValue(first.promise)
    Object.assign(window, { api: { previewTabContext, listProjectAgents: vi.fn() } })

    const view = render(<ContextPreviewBody context={context('a')} cwd="/proyecto" />)
    first.resolve({ ok: true, content: 'contenido de A', filePath: `/proyecto/${PROJECT_DIR}/a.md` })
    await screen.findByText('contenido de A')

    // Objeto nuevo, misma identidad: lo que hace refreshTabContexts.
    view.rerender(<ContextPreviewBody context={context('a')} cwd="/proyecto" />)
    expect(previewTabContext).toHaveBeenCalledTimes(1)
  })
})
