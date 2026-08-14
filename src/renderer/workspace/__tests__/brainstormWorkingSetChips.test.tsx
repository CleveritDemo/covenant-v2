/** @vitest-environment jsdom */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { BrainstormWorkingSetField } from '../BrainstormWorkingSetField'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

const discoverTabContexts = vi.fn()

const jiraContext = {
  id: 'iaterminal:jira:ct-128',
  name: 'CT-128',
  fileName: 'jira-ct-128.md',
  kind: 'jira',
  issueKey: 'CT-128',
}

beforeEach(() => {
  discoverTabContexts.mockReset()
  ;(window as unknown as { api: Record<string, unknown> }).api = { discoverTabContexts }
})

afterEach(cleanup)

describe('chips del working set', () => {
  // Mencionar una issue en el tema la materializa DESPUÉS del descubrir inicial,
  // así que el catálogo no la tenía y el chip mostraba `iaterminal:jira:ct-128`.
  it('redescubre el catálogo cuando llega un id que no conoce', async () => {
    discoverTabContexts
      .mockResolvedValueOnce({ ok: true, contexts: [] })
      .mockResolvedValue({ ok: true, contexts: [jiraContext] })

    const { rerender } = render(
      <BrainstormWorkingSetField cwd="/repo" contextIds={[]} filePaths={[]} onChange={vi.fn()} />,
    )
    await waitFor(() => expect(discoverTabContexts).toHaveBeenCalledTimes(1))

    // La mención materializa la issue y la mete en el working set.
    rerender(
      <BrainstormWorkingSetField
        cwd="/repo"
        contextIds={[jiraContext.id]}
        filePaths={[]}
        onChange={vi.fn()}
      />,
    )

    expect(await screen.findByText('CT-128')).toBeTruthy()
    expect(screen.queryByText(jiraContext.id)).toBeNull()
  })

  it('no entra en bucle si el contexto no existe en disco', async () => {
    discoverTabContexts.mockResolvedValue({ ok: true, contexts: [] })

    render(
      <BrainstormWorkingSetField
        cwd="/repo"
        contextIds={['iaterminal:jira:ct-404']}
        filePaths={[]}
        onChange={vi.fn()}
      />,
    )

    // Un solo reintento: el descubrir inicial y el que dispara el id desconocido.
    await waitFor(() => expect(discoverTabContexts).toHaveBeenCalled())
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(discoverTabContexts.mock.calls.length).toBeLessThanOrEqual(2)
    expect(screen.getByText('ct-404')).toBeTruthy()
  })
})
