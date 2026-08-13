/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  }),
}))

import { JiraIssueChip } from '../JiraIssueChip'

afterEach(cleanup)

describe('JiraIssueChip', () => {
  it('muestra la clave y el estado', () => {
    render(<JiraIssueChip issueKey="GRAV-412" summary="Loop chain colgada" status="In Progress" stale={false} onOpen={vi.fn()} />)
    expect(screen.getByText('GRAV-412')).toBeTruthy()
    expect(screen.getByText('In Progress')).toBeTruthy()
  })

  it('un snapshot vencido se marca en vez de fingir estar al día', () => {
    const { container } = render(
      <JiraIssueChip issueKey="GRAV-412" summary="x" status="Done" stale onOpen={vi.fn()} />,
    )
    expect(container.querySelector('.jira-chip--stale')).toBeTruthy()
  })

  it('el clic abre el snapshot completo', () => {
    const onOpen = vi.fn()
    render(<JiraIssueChip issueKey="GRAV-412" summary="x" status="Done" stale={false} onOpen={onOpen} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalled()
  })

  it('no usa el atributo title: el tooltip es el del kit', () => {
    const { container } = render(
      <JiraIssueChip issueKey="GRAV-412" summary="x" status="Done" stale={false} onOpen={vi.fn()} />,
    )
    expect(container.querySelector('[title]')).toBeNull()
  })

  it('sin resumen/estado parseables, el chip sigue mostrando la clave', () => {
    render(<JiraIssueChip issueKey="GRAV-412" summary="" status="" stale onOpen={vi.fn()} />)
    expect(screen.getByText('GRAV-412')).toBeTruthy()
    expect(screen.getByRole('button')).toBeTruthy()
  })

  it('la frescura se anuncia sin pasar el cursor: no solo vive en el tooltip', () => {
    // Sin hover/focus: el Tooltip nunca monta su burbuja (createPortal solo
    // corre si `visible`). Si el único lugar donde vive `stale` fuera esa
    // burbuja, este test lo perdería igual que un lector de pantalla que
    // nunca dispara el hover — por eso se busca en el texto del botón
    // (participa en su nombre accesible: sin `display:none`/`visibility:hidden`),
    // no en el tooltip.
    render(<JiraIssueChip issueKey="GRAV-412" summary="x" status="Done" stale onOpen={vi.fn()} />)
    expect(document.querySelector('[role="tooltip"]')).toBeNull()
    const button = screen.getByRole('button')
    expect(button.textContent).toContain('jira.staleHint')
  })

  it('sin vencer, el botón no lleva el aviso de frescura', () => {
    render(<JiraIssueChip issueKey="GRAV-412" summary="x" status="Done" stale={false} onOpen={vi.fn()} />)
    expect(screen.getByRole('button').textContent).not.toContain('jira.staleHint')
  })

  it('con snapshot lleno, el hint lleva estado Y fecha de actualización de la issue', async () => {
    // `stale` dice si el ARCHIVO se llenó; `updated`, cuándo cambió la ISSUE.
    // Sin la fecha, un snapshot de hace dos semanas se veía igual de al día
    // que uno de hace un minuto.
    render(
      <JiraIssueChip
        issueKey="GRAV-412"
        summary="Loop chain colgada"
        status="Done"
        stale={false}
        updated="2026-08-01T09:00:00.000Z"
        onOpen={vi.fn()}
      />,
    )
    fireEvent.focus(screen.getByRole('button'))

    const bubble = await screen.findByRole('tooltip')
    expect(bubble.textContent).toContain('Done')
    expect(bubble.textContent).toContain('jira.updatedHint:2026-08-01T09:00:00.000Z')
  })

  it('sin fecha de actualización, el hint es solo el estado', async () => {
    render(
      <JiraIssueChip issueKey="GRAV-412" summary="x" status="Done" stale={false} onOpen={vi.fn()} />,
    )
    fireEvent.focus(screen.getByRole('button'))

    const bubble = await screen.findByRole('tooltip')
    expect(bubble.textContent).not.toContain('jira.updatedHint')
  })

  it('vencido, el hint sigue siendo el aviso de frescura y no la fecha', async () => {
    render(
      <JiraIssueChip
        issueKey="GRAV-412"
        summary="x"
        status="Done"
        stale
        updated="2026-08-01T09:00:00.000Z"
        onOpen={vi.fn()}
      />,
    )
    fireEvent.focus(screen.getByRole('button'))

    const bubble = await screen.findByRole('tooltip')
    expect(bubble.textContent).toContain('jira.staleHint')
    expect(bubble.textContent).not.toContain('jira.updatedHint')
  })

  it('el ícono decorativo no se anuncia dos veces: aria-hidden', () => {
    const { container } = render(
      <JiraIssueChip issueKey="GRAV-412" summary="x" status="Done" stale={false} onOpen={vi.fn()} />,
    )
    expect(container.querySelector('svg[aria-hidden="true"]')).toBeTruthy()
  })
})
