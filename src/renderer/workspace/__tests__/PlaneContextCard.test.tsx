/** @vitest-environment jsdom */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

import { PlaneContextCard } from '../PlaneContextCard'

/** Promesa que resuelve cuando el test quiera: simula el IPC en vuelo. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => {
    resolve = done
  })
  return { promise, resolve }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('PlaneContextCard — kinds normales', () => {
  it('renderiza el ícono/nombre de siempre y no llama a la API', () => {
    const previewTabContext = vi.fn()
    Object.assign(window, { api: { previewTabContext } })
    render(
      <PlaneContextCard name="Folders" icon="folder" color="#888" kind="folderTree" onOpen={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: 'Folders' })).toBeTruthy()
    expect(previewTabContext).not.toHaveBeenCalled()
  })
})

describe('PlaneContextCard — kind jira', () => {
  it('pide el preview una sola vez al montar y muestra resumen/estado reales', async () => {
    const previewTabContext = vi.fn().mockResolvedValue({
      ok: true,
      content: [
        '<!-- iaterminal:auto -->',
        '## Resumen',
        'GRAV-412 · Loop chain colgada',
        'Estado: In Progress · Tipo: Bug',
        '<!-- /iaterminal:auto -->',
      ].join('\n'),
    })
    Object.assign(window, { api: { previewTabContext } })

    render(
      <PlaneContextCard
        name="GRAV-412"
        icon="jira"
        color="#888"
        kind="jira"
        issueKey="GRAV-412"
        cwd="/proyecto"
        onOpen={vi.fn()}
      />,
    )

    await waitFor(() => expect(screen.getByText('In Progress')).toBeTruthy())
    expect(screen.getByText('GRAV-412')).toBeTruthy()
    expect(previewTabContext).toHaveBeenCalledTimes(1)
    const call = previewTabContext.mock.calls[0][0]
    expect(call.cwd).toBe('/proyecto')
    expect(call.context.kind).toBe('jira')
    expect(call.context.issueKey).toBe('GRAV-412')
  })

  it('el clic hace lo mismo que hace un click en la tarjeta hoy (forward de onOpen)', async () => {
    const previewTabContext = vi.fn().mockResolvedValue({ ok: true, content: '' })
    Object.assign(window, { api: { previewTabContext } })
    const onOpen = vi.fn()
    render(
      <PlaneContextCard
        name="GRAV-412"
        icon="jira"
        color="#888"
        kind="jira"
        issueKey="GRAV-412"
        cwd="/proyecto"
        onOpen={onOpen}
      />,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalled()
  })

  it('un preview vencido (auto vacío) se marca como tal', async () => {
    const previewTabContext = vi.fn().mockResolvedValue({
      ok: true,
      content: '<!-- iaterminal:auto -->\n\n<!-- /iaterminal:auto -->',
    })
    Object.assign(window, { api: { previewTabContext } })
    const { container } = render(
      <PlaneContextCard
        name="GRAV-412"
        icon="jira"
        color="#888"
        kind="jira"
        issueKey="GRAV-412"
        cwd="/proyecto"
        onOpen={vi.fn()}
      />,
    )
    await waitFor(() => expect(container.querySelector('.jira-chip--stale')).toBeTruthy())
  })

  it('un preview fallido no rompe el render: el chip sigue mostrando la clave', async () => {
    const previewTabContext = vi.fn().mockRejectedValue(new Error('offline'))
    Object.assign(window, { api: { previewTabContext } })
    render(
      <PlaneContextCard
        name="GRAV-412"
        icon="jira"
        color="#888"
        kind="jira"
        issueKey="GRAV-412"
        cwd="/proyecto"
        onOpen={vi.fn()}
      />,
    )
    await waitFor(() => expect(previewTabContext).toHaveBeenCalledTimes(1))
    expect(screen.getByText('GRAV-412')).toBeTruthy()
  })

  it('sin cwd, no pide preview (no hay `.md` que resolver)', () => {
    const previewTabContext = vi.fn()
    Object.assign(window, { api: { previewTabContext } })
    render(
      <PlaneContextCard
        name="GRAV-412"
        icon="jira"
        color="#888"
        kind="jira"
        issueKey="GRAV-412"
        onOpen={vi.fn()}
      />,
    )
    expect(previewTabContext).not.toHaveBeenCalled()
  })

  it('desmontar antes de que resuelva la promesa no lanza ni actualiza estado', async () => {
    const pending = deferred<{ ok: true; content: string }>()
    const previewTabContext = vi.fn().mockReturnValue(pending.promise)
    Object.assign(window, { api: { previewTabContext } })
    const { unmount } = render(
      <PlaneContextCard
        name="GRAV-412"
        icon="jira"
        color="#888"
        kind="jira"
        issueKey="GRAV-412"
        cwd="/proyecto"
        onOpen={vi.fn()}
      />,
    )
    unmount()
    pending.resolve({ ok: true, content: '## Resumen\nGRAV-412 · x\nEstado: Done · Tipo: Bug' })
    await Promise.resolve()
    await Promise.resolve()
  })
})
