/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
})
