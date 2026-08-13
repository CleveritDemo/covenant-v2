/** @vitest-environment jsdom */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { BrainstormStartModal } from '../BrainstormStartModal'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

// Solo aporta chrome (portal, foco atrapado, traffic lights); el campo de
// objetivo y su mención viven dentro.
vi.mock('../../components/TerminalModal', () => ({
  TerminalModal: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    (open ? <div>{children}</div> : null),
}))

const jiraStatus = vi.fn()
const jiraSearch = vi.fn()
const materializeTabContext = vi.fn()
const listBrainstorms = vi.fn()

const issue = {
  key: 'CT-128',
  summary: 'Permissions en rojo',
  status: 'Por hacer',
  issueType: 'Bug',
  assignee: null,
  updated: '2026-08-12T09:40:00.000Z',
}

beforeEach(() => {
  jiraStatus.mockReset().mockResolvedValue({
    configured: true,
    site: 'https://x.atlassian.net',
    email: 'a@x.com',
    projectKeys: ['CT'],
    connected: true,
  })
  jiraSearch.mockReset().mockResolvedValue({ issues: [issue] })
  materializeTabContext.mockReset().mockResolvedValue({ ok: true, content: '' })
  listBrainstorms.mockReset().mockResolvedValue([])
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    jiraStatus,
    jiraSearch,
    materializeTabContext,
    listBrainstorms,
  }
})

afterEach(cleanup)

/** Los `<select>` del modal también son `listbox`: hay que ir por el nombre. */
async function pickerOption(): Promise<HTMLElement> {
  const list = await screen.findByRole('listbox', { name: 'jira.mentionListLabel' })
  return within(list).getByRole('option')
}

function renderStart() {
  render(
    <BrainstormStartModal
      open
      cwd="/repo"
      agents={[]}
      onClose={vi.fn()}
      onStarted={vi.fn()}
    />,
  )
}

describe('mención de Jira al CREAR una sala', () => {
  // El modal de crear no reusa `BrainstormBriefFields` (eso es el de editar):
  // tiene su propio campo de objetivo, y cablear solo uno dejó la mención
  // invisible justo en el camino por el que se entra a la feature.
  it('`#` abre el buscador en el objetivo de la sala nueva', async () => {
    renderStart()
    await waitFor(() => expect(jiraStatus).toHaveBeenCalledWith('/repo'))

    const goal = screen.getByPlaceholderText('tabs.brainstormTopicPlaceholder')
    fireEvent.change(goal, { target: { value: '#CT-12' } })

    await waitFor(() => expect(jiraSearch).toHaveBeenCalledWith('/repo', 'CT-12'))
    expect(await pickerOption()).toBeTruthy()
  })

  it('elegir la issue la escribe en el objetivo y la materializa como contexto', async () => {
    renderStart()
    await waitFor(() => expect(jiraStatus).toHaveBeenCalled())

    const goal = screen.getByPlaceholderText('tabs.brainstormTopicPlaceholder') as HTMLTextAreaElement
    fireEvent.change(goal, { target: { value: '#CT-12' } })
    fireEvent.click(await pickerOption())

    await waitFor(() => expect(goal.value).toBe('CT-128 '))
    await waitFor(() => expect(materializeTabContext).toHaveBeenCalled())
    expect(materializeTabContext.mock.calls[0][0].context.issueKey).toBe('CT-128')
  })

  it('si el contexto no llega a disco, el objetivo igual queda escrito', async () => {
    // El texto es del usuario; el adjunto es un efecto. Que falle Jira no puede
    // borrar lo que la persona acaba de elegir.
    materializeTabContext.mockResolvedValue({ ok: false, error: 'sin credenciales' })
    renderStart()
    await waitFor(() => expect(jiraStatus).toHaveBeenCalled())

    const goal = screen.getByPlaceholderText('tabs.brainstormTopicPlaceholder') as HTMLTextAreaElement
    fireEvent.change(goal, { target: { value: '#CT-12' } })
    fireEvent.click(await pickerOption())

    await waitFor(() => expect(goal.value).toBe('CT-128 '))
  })
})
