/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PreviewsView } from '../PreviewsView'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string) => key,
  }),
}))

afterEach(cleanup)

const entries = [
  { fileName: 'a.html', title: 'Detalle de agentes', subtitle: '2026-08-21 · Gigi' },
  { fileName: 'b.html', title: 'Historial de hilos', subtitle: '2026-08-21 · Gigi' },
]

describe('PreviewsView', () => {
  it('no renderiza con open=false', () => {
    const { container } = render(
      <PreviewsView
        open={false}
        entries={entries}
        selectedFileName={null}
        html={null}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('pinta un item por entry', () => {
    render(
      <PreviewsView
        open
        entries={entries}
        selectedFileName="a.html"
        html="<p>hi</p>"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByRole('option', { name: /Detalle de agentes/i })).toBeTruthy()
    expect(screen.getByRole('option', { name: /Historial de hilos/i })).toBeTruthy()
  })

  it('click en item llama onSelect con el fileName', () => {
    const onSelect = vi.fn()
    render(
      <PreviewsView
        open
        entries={entries}
        selectedFileName="a.html"
        html="<p>hi</p>"
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('option', { name: /Historial de hilos/i }))
    expect(onSelect).toHaveBeenCalledWith('b.html')
  })

  it('el iframe tiene el sandbox exacto de HtmlPreview', () => {
    render(
      <PreviewsView
        open
        entries={entries}
        selectedFileName="a.html"
        html="<!doctype html><p>preview</p>"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    const iframe = document.querySelector('iframe')
    expect(iframe).toBeTruthy()
    expect(iframe?.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin')
    expect(iframe?.getAttribute('referrerpolicy')).toBe('no-referrer')
    expect(iframe?.getAttribute('srcdoc')).toBe('<!doctype html><p>preview</p>')
  })

  it('con entries vacío pinta el estado vacío', () => {
    render(
      <PreviewsView
        open
        entries={[]}
        selectedFileName={null}
        html={null}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('previews.empty')).toBeTruthy()
    expect(screen.getByText('previews.emptyHint')).toBeTruthy()
    expect(document.querySelector('.previews-view__list')).toBeNull()
  })
})
