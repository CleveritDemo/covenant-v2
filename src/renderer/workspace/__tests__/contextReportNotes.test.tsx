/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { TabContext } from '@shared/tabContext'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

import { ContextReport } from '../ContextReport'

const notesContext: TabContext = {
  id: 'iaterminal:notes:brief',
  name: 'Brief',
  fileName: 'Brief.md',
  kind: 'notes',
}

function notesDoc(notes: string, auto = '(manual notes context)'): string {
  return [
    '# Brief',
    '<!-- iaterminal:auto -->',
    auto,
    '<!-- /iaterminal:auto -->',
    '<!-- iaterminal:notes -->',
    notes,
    '<!-- /iaterminal:notes -->',
  ].join('\n')
}

afterEach(cleanup)

describe('ContextReport kind notes', () => {
  it('muestra el Markdown humano de notes, no el stub auto', () => {
    render(
      <ContextReport
        context={notesContext}
        content={notesDoc('## Objetivo\n\nEntregar el preview correcto.')}
      />,
    )

    expect(screen.getByText('Objetivo')).toBeTruthy()
    expect(screen.getByText('Entregar el preview correcto.')).toBeTruthy()
    expect(screen.queryByText('(manual notes context)')).toBeNull()
  })

  it('no duplica el texto de notes en el bloque secundario Notas', () => {
    const { container } = render(
      <ContextReport
        context={notesContext}
        content={notesDoc('Solo cuerpo principal.')}
      />,
    )

    expect(screen.getByText('Solo cuerpo principal.')).toBeTruthy()
    expect(container.querySelector('.context-report__notes')).toBeNull()
  })

  it('sigue mostrando anotaciones sin repetir notes en el bloque secundario', () => {
    const content = notesDoc([
      'Cuerpo humano.',
      '',
      '- `clave` — anotación útil',
    ].join('\n'))
    const { container } = render(
      <ContextReport context={notesContext} content={content} />,
    )

    expect(screen.getByText('Cuerpo humano.')).toBeTruthy()
    expect(container.querySelector('.context-report__notes')).toBeTruthy()
    expect(screen.getByText('clave')).toBeTruthy()
    expect(screen.getByText('anotación útil')).toBeTruthy()
    expect(container.querySelectorAll('.context-report__notes-text').length).toBe(0)
  })

  it('vacío (solo stub auto) usa el placeholder, sin mostrar el stub', () => {
    render(
      <ContextReport
        context={notesContext}
        content={notesDoc('(no annotations yet)')}
      />,
    )

    expect(screen.getByText('tabContexts.reportEmpty')).toBeTruthy()
    expect(screen.queryByText('(manual notes context)')).toBeNull()
  })
})
