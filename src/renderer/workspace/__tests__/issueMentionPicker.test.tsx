/** @vitest-environment jsdom */
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { jiraRowFromIssue } from '@shared/issueMention'
import type { JiraIssueRef } from '@shared/jiraIssue'
import { IssueMentionPicker } from '../IssueMentionPicker'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

const refs: JiraIssueRef[] = [
  { key: 'GRAV-412', summary: 'Loop chain colgada', status: 'In Progress', issueType: 'Bug', assignee: 'Rodrigo', updated: '2026-08-12T09:40:00.000Z' },
  { key: 'GRAV-407', summary: 'Timeout de PTY', status: 'In Review', issueType: 'Bug', assignee: null, updated: '2026-08-10T09:40:00.000Z' },
]
const rows = refs.map(jiraRowFromIssue)

afterEach(cleanup)

function renderPicker(
  overrides: Partial<ComponentProps<typeof IssueMentionPicker>> = {},
) {
  return render(
    <IssueMentionPicker
      rows={rows}
      searching={false}
      error=""
      query="GRAV-4"
      onPick={vi.fn()}
      onDismiss={vi.fn()}
      focusElement={null}
      {...overrides}
    />,
  )
}

describe('IssueMentionPicker', () => {
  it('lista las filas que recibe', () => {
    renderPicker()
    expect(screen.getByText('Loop chain colgada')).toBeTruthy()
    const keys = screen.getAllByRole('option').map(row => row.textContent ?? '')
    expect(keys.some(text => text.includes('GRAV-407'))).toBe(true)
  })

  it('resalta el trozo que coincide con lo tecleado', () => {
    renderPicker()
    const marks = document.querySelectorAll('.issue-mention__match')
    expect(marks.length).toBeGreaterThan(0)
    expect([...marks].every(mark => mark.textContent === 'GRAV-4')).toBe(true)
  })

  it('cada fila dice de dónde sale, qué es y cuándo se tocó', () => {
    renderPicker()
    const row = screen.getAllByRole('option')
      .find(item => (item.textContent ?? '').includes('GRAV-412'))!
    expect(row.querySelector('.issue-source-badge--jira')).toBeTruthy()
    expect(row.textContent).toContain('Jira')
    expect(row.textContent).toContain('Bug')
    expect(row.textContent).toContain('In Progress')
    expect(row.textContent).not.toContain('2026-08-12T09:40')
  })

  it('Enter elige la fila activa', () => {
    const onPick = vi.fn()
    renderPicker({ onPick })
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onPick).toHaveBeenCalledWith(rows[1])
  })

  it('Escape cierra sin elegir', () => {
    const onDismiss = vi.fn()
    renderPicker({ onDismiss })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onDismiss).toHaveBeenCalled()
  })

  it('sin resultados no pinta una lista vacía flotando', () => {
    const { container } = renderPicker({ rows: [] })
    expect(container.querySelector('.issue-mention__list')).toBeNull()
  })

  it('sin resultados, Enter/Escape/flechas no se tragan (nada que cerrar)', () => {
    renderPicker({ rows: [] })
    expect(fireEvent.keyDown(window, { key: 'Enter', cancelable: true })).toBe(true)
    expect(fireEvent.keyDown(window, { key: 'Escape', cancelable: true })).toBe(true)
    expect(fireEvent.keyDown(window, { key: 'ArrowDown', cancelable: true })).toBe(true)
  })

  it('con resultados, Enter sí se cancela (el picker lo maneja)', () => {
    renderPicker()
    expect(fireEvent.keyDown(window, { key: 'Enter', cancelable: true })).toBe(false)
  })

  it('ignora el teclado si el foco real no está en el elemento del composer', () => {
    const onPick = vi.fn()
    const detachedTextarea = document.createElement('textarea')
    renderPicker({ onPick, focusElement: detachedTextarea })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onPick).not.toHaveBeenCalled()
  })

  it('al desmontar limpia los TRES atributos aria del textarea', () => {
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    const { unmount } = renderPicker({ focusElement: textarea })
    expect(textarea.getAttribute('aria-controls')).toBeTruthy()
    unmount()
    expect(textarea.getAttribute('aria-controls')).toBeNull()
    expect(textarea.getAttribute('aria-expanded')).toBeNull()
    expect(textarea.getAttribute('aria-activedescendant')).toBeNull()
    textarea.remove()
  })

  it('cuando la búsqueda deja de tener resultados, también se limpia aria-controls', () => {
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    const { rerender } = renderPicker({ focusElement: textarea })
    expect(textarea.getAttribute('aria-controls')).toBeTruthy()
    rerender(
      <IssueMentionPicker
        rows={[]}
        searching={false}
        error=""
        query="GRAV-99"
        onPick={vi.fn()}
        onDismiss={vi.fn()}
        focusElement={textarea}
      />,
    )
    expect(textarea.getAttribute('aria-controls')).toBeNull()
    expect(textarea.getAttribute('aria-expanded')).toBeNull()
    textarea.remove()
  })
})

describe('IssueMentionPicker — estado vacío', () => {
  it('sin showEmptyState no pinta nada: en el composer un panel vacío tapa lo que escribes', () => {
    const { container } = renderPicker({ rows: [], searching: false })
    expect(container.textContent).toBe('')
  })

  it('con showEmptyState dice que no hay coincidencias en vez de callarse', () => {
    renderPicker({ rows: [], showEmptyState: true })
    expect(screen.getByText('issueMention.noMatches')).toBeTruthy()
  })

  it('un error del canal se muestra: era indistinguible de «sin resultados»', () => {
    renderPicker({
      rows: [],
      showEmptyState: true,
      error: 'Jira 400. Revisa las claves de proyecto en Ajustes: CDLC-TRANSFORMATION no tiene forma de clave de Jira.',
    })
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('CDLC-TRANSFORMATION')
    expect(screen.queryByText('issueMention.noMatches')).toBeNull()
  })
})
