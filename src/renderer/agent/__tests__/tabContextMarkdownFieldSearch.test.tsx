/** @vitest-environment jsdom */
import React, { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TabContextMarkdownField } from '../TabContextMarkdownField'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (k: string) => k }),
}))

const BODY = 'alpha line\nbeta first\ngamma line\nbeta second'

function MarkdownFieldHarness(): React.ReactElement {
  const [value, setValue] = useState(BODY)
  return (
    <TabContextMarkdownField
      label="tabContexts.notes"
      value={value}
      onChange={setValue}
    />
  )
}

afterEach(cleanup)

function searchInput(): HTMLElement {
  return screen.getByLabelText('tabContexts.bodySearchAria')
}

function bodyTextarea(): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: '' }) as HTMLTextAreaElement
}

describe('TabContextMarkdownField — búsqueda en cuerpo', () => {
  it('regresión: teclear en el buscador no roba el foco ni selecciona en el textarea', () => {
    render(<MarkdownFieldHarness />)
    const search = searchInput()
    search.focus()
    fireEvent.change(search, { target: { value: 'beta' } })

    expect(document.activeElement).toBe(search)
    expect(bodyTextarea().selectionStart).toBe(0)
    expect(bodyTextarea().selectionEnd).toBe(0)
  })

  it('tras pulsar siguiente, el textarea recibe foco y selecciona la primera ocurrencia', () => {
    render(<MarkdownFieldHarness />)
    const search = searchInput()
    fireEvent.change(search, { target: { value: 'beta' } })
    fireEvent.click(screen.getByRole('button', { name: 'tabContexts.bodySearchNext' }))

    const ta = bodyTextarea()
    const firstStart = BODY.indexOf('beta')
    expect(document.activeElement).toBe(ta)
    expect(ta.selectionStart).toBe(firstStart)
    expect(ta.selectionEnd).toBe(firstStart + 4)
  })

  it('muestra el contador cuando hay coincidencias', () => {
    render(<MarkdownFieldHarness />)
    fireEvent.change(searchInput(), { target: { value: 'beta' } })
    expect(screen.getByText('tabContexts.bodySearchCount')).toBeTruthy()
  })

  it('sin coincidencias muestra el mensaje vacío y deshabilita la navegación', () => {
    render(<MarkdownFieldHarness />)
    fireEvent.change(searchInput(), { target: { value: 'omega' } })
    expect(screen.getByText('tabContexts.bodySearchNoMatches')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'tabContexts.bodySearchPrev' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'tabContexts.bodySearchNext' }).disabled).toBe(true)
  })
})
