/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { JiraMentionPicker } from '../JiraMentionPicker'
import type { JiraIssueRef } from '@shared/jiraIssue'

const jiraSearch = vi.fn()

const refs = [
  { key: 'GRAV-412', summary: 'Loop chain colgada', status: 'In Progress', issueType: 'Bug', assignee: 'Rodrigo', updated: '2026-08-12T09:40:00.000Z' },
  { key: 'GRAV-407', summary: 'Timeout de PTY', status: 'In Review', issueType: 'Bug', assignee: null, updated: '2026-08-10T09:40:00.000Z' },
]

beforeEach(() => {
  jiraSearch.mockReset().mockResolvedValue({ issues: refs })
  ;(window as unknown as { api: unknown }).api = { jiraSearch }
})

// Sin esto, el `<ul>` y el listener global de teclado del test anterior
// siguen vivos: `findByText` resuelve contra ESE DOM y las flechas/Enter
// llegan antes de que el fetch propio del test termine su debounce.
afterEach(cleanup)

describe('JiraMentionPicker', () => {
  it('busca y lista las coincidencias', async () => {
    render(
      <JiraMentionPicker cwd="/repo" query="GRAV-4" onPick={vi.fn()} onDismiss={vi.fn()} focusElement={null} />,
    )
    await waitFor(() => expect(jiraSearch).toHaveBeenCalledWith('/repo', 'GRAV-4'))
    await screen.findByText('Loop chain colgada')
    // La clave va troceada por el resaltado de la coincidencia, así que se
    // consulta por el nombre accesible de la fila, no por un nodo de texto.
    const keys = screen.getAllByRole('option').map(row => row.textContent ?? '')
    expect(keys.some(text => text.includes('GRAV-407'))).toBe(true)
  })

  it('resalta el trozo que coincide con lo tecleado', async () => {
    render(
      <JiraMentionPicker cwd="/repo" query="GRAV-4" onPick={vi.fn()} onDismiss={vi.fn()} focusElement={null} />,
    )
    await screen.findByText('Loop chain colgada')
    const marks = document.querySelectorAll('.jira-mention__match')
    expect(marks.length).toBeGreaterThan(0)
    expect([...marks].every(mark => mark.textContent === 'GRAV-4')).toBe(true)
  })

  it('cada fila dice de dónde sale, qué es y cuándo se tocó', async () => {
    render(
      <JiraMentionPicker cwd="/repo" query="GRAV-4" onPick={vi.fn()} onDismiss={vi.fn()} focusElement={null} />,
    )
    await screen.findByText('Loop chain colgada')
    const row = screen.getAllByRole('option')
      .find(item => (item.textContent ?? '').includes('GRAV-412'))!
    // `Jira · Bug · GRAV · In Progress`: el origen, el tipo, el proyecto y el estado.
    expect(row.textContent).toContain('Jira')
    expect(row.textContent).toContain('Bug')
    expect(row.textContent).toContain('In Progress')
    // Y la actividad, en relativo — la fecha ISO cruda no le dice nada a nadie.
    expect(row.textContent).not.toContain('2026-08-12T09:40')
  })

  it('Enter elige la fila activa', async () => {
    const onPick = vi.fn()
    render(
      <JiraMentionPicker cwd="/repo" query="GRAV-4" onPick={onPick} onDismiss={vi.fn()} focusElement={null} />,
    )
    await screen.findByText('Loop chain colgada')
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onPick).toHaveBeenCalledWith(refs[1])
  })

  it('Escape cierra sin elegir', async () => {
    const onDismiss = vi.fn()
    render(
      <JiraMentionPicker cwd="/repo" query="GRAV-4" onPick={vi.fn()} onDismiss={onDismiss} focusElement={null} />,
    )
    await screen.findByText('Loop chain colgada')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onDismiss).toHaveBeenCalled()
  })

  it('sin resultados no pinta una lista vacía flotando', async () => {
    jiraSearch.mockResolvedValue({ issues: [] })
    const { container } = render(
      <JiraMentionPicker cwd="/repo" query="ZZZ" onPick={vi.fn()} onDismiss={vi.fn()} focusElement={null} />,
    )
    await waitFor(() => expect(jiraSearch).toHaveBeenCalled())
    await waitFor(() => expect(container.querySelector('.jira-mention__list')).toBeNull())
  })

  it('sin resultados, Enter/Escape/flechas no se tragan (nada que cerrar)', async () => {
    jiraSearch.mockResolvedValue({ issues: [] })
    render(
      <JiraMentionPicker cwd="/repo" query="ZZZ" onPick={vi.fn()} onDismiss={vi.fn()} focusElement={null} />,
    )
    await waitFor(() => expect(jiraSearch).toHaveBeenCalled())
    // dispatchEvent devuelve `true` cuando NADIE llamó preventDefault: la
    // tecla sigue su curso normal (Enter puede enviar el mensaje, etc.).
    expect(fireEvent.keyDown(window, { key: 'Enter', cancelable: true })).toBe(true)
    expect(fireEvent.keyDown(window, { key: 'Escape', cancelable: true })).toBe(true)
    expect(fireEvent.keyDown(window, { key: 'ArrowDown', cancelable: true })).toBe(true)
  })

  it('con resultados, Enter sí se cancela (el picker lo maneja)', async () => {
    render(
      <JiraMentionPicker cwd="/repo" query="GRAV-4" onPick={vi.fn()} onDismiss={vi.fn()} focusElement={null} />,
    )
    await screen.findByText('Loop chain colgada')
    expect(fireEvent.keyDown(window, { key: 'Enter', cancelable: true })).toBe(false)
  })

  it('ignora el teclado si el foco real no está en el elemento del composer', async () => {
    const onPick = vi.fn()
    const detachedTextarea = document.createElement('textarea')
    render(
      <JiraMentionPicker
        cwd="/repo"
        query="GRAV-4"
        onPick={onPick}
        onDismiss={vi.fn()}
        focusElement={detachedTextarea}
      />,
    )
    await screen.findByText('Loop chain colgada')
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onPick).not.toHaveBeenCalled()
  })

  it('al desmontar limpia los TRES atributos aria del textarea', async () => {
    // `aria-controls` se ponía y no se quitaba: quedaba apuntando a un <ul>
    // que ya no está en el DOM, una referencia rota para el lector de pantalla
    // sobre el textarea del composer.
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)

    const { unmount } = render(
      <JiraMentionPicker
        cwd="/repo"
        query="GRAV-4"
        onPick={vi.fn()}
        onDismiss={vi.fn()}
        focusElement={textarea}
      />,
    )
    await screen.findByText('Loop chain colgada')
    await waitFor(() => expect(textarea.getAttribute('aria-controls')).toBeTruthy())

    unmount()

    expect(textarea.getAttribute('aria-controls')).toBeNull()
    expect(textarea.getAttribute('aria-expanded')).toBeNull()
    expect(textarea.getAttribute('aria-activedescendant')).toBeNull()
    textarea.remove()
  })

  it('cuando la búsqueda deja de tener resultados, también se limpia aria-controls', async () => {
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)

    const { rerender } = render(
      <JiraMentionPicker
        cwd="/repo"
        query="GRAV-4"
        onPick={vi.fn()}
        onDismiss={vi.fn()}
        focusElement={textarea}
      />,
    )
    await waitFor(() => expect(textarea.getAttribute('aria-controls')).toBeTruthy())

    jiraSearch.mockResolvedValue({ issues: [] })
    rerender(
      <JiraMentionPicker
        cwd="/repo"
        query="GRAV-99"
        onPick={vi.fn()}
        onDismiss={vi.fn()}
        focusElement={textarea}
      />,
    )

    await waitFor(() => expect(textarea.getAttribute('aria-controls')).toBeNull())
    expect(textarea.getAttribute('aria-expanded')).toBeNull()
    textarea.remove()
  })

  it('solo la búsqueda más reciente pinta, aunque resuelva después de reordenarse', async () => {
    type SearchResult = { issues: JiraIssueRef[] }
    let resolveFirst: (result: SearchResult) => void = () => {}
    let resolveSecond: (result: SearchResult) => void = () => {}
    jiraSearch
      .mockImplementationOnce(() => new Promise<SearchResult>(resolve => { resolveFirst = resolve }))
      .mockImplementationOnce(() => new Promise<SearchResult>(resolve => { resolveSecond = resolve }))

    const { rerender } = render(
      <JiraMentionPicker cwd="/repo" query="GRAV-4" onPick={vi.fn()} onDismiss={vi.fn()} focusElement={null} />,
    )
    await waitFor(() => expect(jiraSearch).toHaveBeenCalledTimes(1))

    rerender(
      <JiraMentionPicker cwd="/repo" query="GRAV-41" onPick={vi.fn()} onDismiss={vi.fn()} focusElement={null} />,
    )
    await waitFor(() => expect(jiraSearch).toHaveBeenCalledTimes(2))

    // La búsqueda MÁS NUEVA resuelve primero.
    resolveSecond({ issues: [refs[1]] })
    await screen.findByText('Timeout de PTY')

    // La búsqueda VIEJA resuelve después: no debe pisar lo ya pintado.
    resolveFirst({ issues: [refs[0]] })
    await waitFor(() => expect(screen.getByText('Timeout de PTY')).toBeTruthy())
    expect(screen.queryByText('Loop chain colgada')).toBeNull()
  })
})

describe('JiraMentionPicker — estado vacío', () => {
  it('sin showEmptyState no pinta nada: en el composer un panel vacío tapa lo que escribes', async () => {
    jiraSearch.mockResolvedValue({ issues: [] })
    const { container } = render(
      <JiraMentionPicker cwd="/repo" query="zzz" onPick={vi.fn()} onDismiss={vi.fn()} focusElement={null} />,
    )
    await waitFor(() => expect(jiraSearch).toHaveBeenCalled())
    await waitFor(() => expect(container.textContent).toBe(''))
  })

  it('con showEmptyState dice que no hay coincidencias en vez de callarse', async () => {
    jiraSearch.mockResolvedValue({ issues: [] })
    render(
      <JiraMentionPicker
        cwd="/repo"
        query="zzz"
        onPick={vi.fn()}
        onDismiss={vi.fn()}
        focusElement={null}
        showEmptyState
      />,
    )
    await screen.findByText('jira.noMatches')
  })

  it('un error del canal se muestra: era indistinguible de «sin resultados»', async () => {
    // El caso real: una clave de proyecto mal puesta genera un JQL que Jira
    // rechaza. Antes se tragaba y el usuario veía silencio.
    jiraSearch.mockResolvedValue({
      issues: [],
      error: 'Jira 400. Revisa las claves de proyecto en Ajustes: CDLC-TRANSFORMATION no tiene forma de clave de Jira.',
    })
    render(
      <JiraMentionPicker
        cwd="/repo"
        query="CT-"
        onPick={vi.fn()}
        onDismiss={vi.fn()}
        focusElement={null}
        showEmptyState
      />,
    )
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('CDLC-TRANSFORMATION')
    expect(screen.queryByText('jira.noMatches')).toBeNull()
  })
})
