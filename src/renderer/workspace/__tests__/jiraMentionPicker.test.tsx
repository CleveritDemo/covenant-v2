/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { JiraMentionPicker } from '../JiraMentionPicker'
import type { JiraIssueRef } from '@shared/jiraIssue'

const jiraSearch = vi.fn()

const refs = [
  { key: 'GRAV-412', summary: 'Loop chain colgada', status: 'In Progress', issueType: 'Bug', assignee: 'Rodrigo' },
  { key: 'GRAV-407', summary: 'Timeout de PTY', status: 'In Review', issueType: 'Bug', assignee: null },
]

beforeEach(() => {
  jiraSearch.mockReset().mockResolvedValue(refs)
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
    expect(screen.getByText('GRAV-407')).toBeTruthy()
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
    jiraSearch.mockResolvedValue([])
    const { container } = render(
      <JiraMentionPicker cwd="/repo" query="ZZZ" onPick={vi.fn()} onDismiss={vi.fn()} focusElement={null} />,
    )
    await waitFor(() => expect(jiraSearch).toHaveBeenCalled())
    await waitFor(() => expect(container.querySelector('.jira-mention__list')).toBeNull())
  })

  it('sin resultados, Enter/Escape/flechas no se tragan (nada que cerrar)', async () => {
    jiraSearch.mockResolvedValue([])
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

    jiraSearch.mockResolvedValue([])
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
    let resolveFirst: (issues: JiraIssueRef[]) => void = () => {}
    let resolveSecond: (issues: JiraIssueRef[]) => void = () => {}
    jiraSearch
      .mockImplementationOnce(() => new Promise<JiraIssueRef[]>(resolve => { resolveFirst = resolve }))
      .mockImplementationOnce(() => new Promise<JiraIssueRef[]>(resolve => { resolveSecond = resolve }))

    const { rerender } = render(
      <JiraMentionPicker cwd="/repo" query="GRAV-4" onPick={vi.fn()} onDismiss={vi.fn()} focusElement={null} />,
    )
    await waitFor(() => expect(jiraSearch).toHaveBeenCalledTimes(1))

    rerender(
      <JiraMentionPicker cwd="/repo" query="GRAV-41" onPick={vi.fn()} onDismiss={vi.fn()} focusElement={null} />,
    )
    await waitFor(() => expect(jiraSearch).toHaveBeenCalledTimes(2))

    // La búsqueda MÁS NUEVA resuelve primero.
    resolveSecond([refs[1]])
    await screen.findByText('Timeout de PTY')

    // La búsqueda VIEJA resuelve después: no debe pisar lo ya pintado.
    resolveFirst([refs[0]])
    await waitFor(() => expect(screen.getByText('Timeout de PTY')).toBeTruthy())
    expect(screen.queryByText('Loop chain colgada')).toBeNull()
  })
})
