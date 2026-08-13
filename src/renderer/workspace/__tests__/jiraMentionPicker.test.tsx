/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { JiraMentionPicker } from '../JiraMentionPicker'

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
    render(<JiraMentionPicker cwd="/repo" query="GRAV-4" onPick={vi.fn()} onDismiss={vi.fn()} />)
    await waitFor(() => expect(jiraSearch).toHaveBeenCalledWith('/repo', 'GRAV-4'))
    await screen.findByText('Loop chain colgada')
    expect(screen.getByText('GRAV-407')).toBeTruthy()
  })

  it('Enter elige la fila activa', async () => {
    const onPick = vi.fn()
    render(<JiraMentionPicker cwd="/repo" query="GRAV-4" onPick={onPick} onDismiss={vi.fn()} />)
    await screen.findByText('Loop chain colgada')
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onPick).toHaveBeenCalledWith(refs[1])
  })

  it('Escape cierra sin elegir', async () => {
    const onDismiss = vi.fn()
    render(<JiraMentionPicker cwd="/repo" query="GRAV-4" onPick={vi.fn()} onDismiss={onDismiss} />)
    await screen.findByText('Loop chain colgada')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onDismiss).toHaveBeenCalled()
  })

  it('sin resultados no pinta una lista vacía flotando', async () => {
    jiraSearch.mockResolvedValue([])
    const { container } = render(
      <JiraMentionPicker cwd="/repo" query="ZZZ" onPick={vi.fn()} onDismiss={vi.fn()} />,
    )
    await waitFor(() => expect(jiraSearch).toHaveBeenCalled())
    await waitFor(() => expect(container.querySelector('.jira-mention__list')).toBeNull())
  })
})
