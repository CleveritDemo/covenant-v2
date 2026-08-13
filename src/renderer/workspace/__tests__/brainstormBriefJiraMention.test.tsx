/** @vitest-environment jsdom */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { BrainstormBriefFields } from '../BrainstormBriefFields'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

// El working set trae su propio explorador de archivos y su IPC; aquí solo
// interesa qué contextIds recibe, así que se reduce a un marcador.
vi.mock('../BrainstormWorkingSetField', () => ({
  BrainstormWorkingSetField: () => <div data-testid="working-set" />,
}))

const jiraStatus = vi.fn()
const jiraSearch = vi.fn()
const materializeTabContext = vi.fn()

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
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    jiraStatus,
    jiraSearch,
    materializeTabContext,
  }
})

afterEach(cleanup)

/**
 * La fila del picker, no un `<option>` cualquiera: el brief tiene `Select`s
 * nativos y sus opciones comparten el rol.
 */
async function pickerOption(): Promise<HTMLElement> {
  // Los `<select>` nativos del brief también son `listbox`: hay que ir por el nombre.
  const list = await screen.findByRole('listbox', { name: 'jira.mentionListLabel' })
  return within(list).getByRole('option')
}

function renderBrief(overrides: Partial<React.ComponentProps<typeof BrainstormBriefFields>> = {}) {
  const props = {
    cwd: '/repo',
    topic: '',
    onTopicChange: vi.fn(),
    contextIds: [] as string[],
    filePaths: [] as string[],
    onWorkingSetChange: vi.fn(),
    outcome: 'decision' as never,
    onOutcomeChange: vi.fn(),
    maxRounds: 3,
    onMaxRoundsChange: vi.fn(),
    participantCount: 2,
    ...overrides,
  }
  render(<BrainstormBriefFields {...props} />)
  return props
}

// El modal de CREAR sala (`BrainstormStartModal`) tiene su propio campo de
// objetivo: no reusa `BrainstormBriefFields`, que solo usa el de editar. Cablear
// solo uno dejaba la mención invisible justo en el camino por el que se entra.
describe('mención de Jira en el tema de una sala', () => {
  it('elegir una issue la añade al working set, no solo al texto', async () => {
    // Convocar una sala sobre un ticket y tener que pegar su contexto aparte
    // era pedir el mismo dato dos veces.
    const props = renderBrief()
    await waitFor(() => expect(jiraStatus).toHaveBeenCalledWith('/repo'))

    const topic = screen.getByPlaceholderText('tabs.brainstormTopicPlaceholder')
    fireEvent.change(topic, { target: { value: '#CT-12' } })
    await waitFor(() => expect(jiraSearch).toHaveBeenCalledWith('/repo', 'CT-12'))

    fireEvent.click(await pickerOption())

    await waitFor(() => expect(materializeTabContext).toHaveBeenCalled())
    const { context } = materializeTabContext.mock.calls[0][0]
    expect(context.issueKey).toBe('CT-128')
    await waitFor(() => expect(props.onWorkingSetChange).toHaveBeenCalledWith({
      contextIds: [context.id],
      filePaths: [],
    }))
  })

  it('no duplica la issue si ya estaba en el working set', async () => {
    const props = renderBrief({ contextIds: ['iaterminal:jira:ct-128'] })
    await waitFor(() => expect(jiraStatus).toHaveBeenCalled())
    const topic = screen.getByPlaceholderText('tabs.brainstormTopicPlaceholder')
    fireEvent.change(topic, { target: { value: '#CT-12' } })
    fireEvent.click(await pickerOption())

    await waitFor(() => expect(props.onWorkingSetChange).toHaveBeenCalledWith({
      contextIds: ['iaterminal:jira:ct-128'],
      filePaths: [],
    }))
  })

  it('si el contexto no llega a disco, no se toca el working set', async () => {
    materializeTabContext.mockResolvedValue({ ok: false, error: 'sin credenciales' })
    const props = renderBrief()
    await waitFor(() => expect(jiraStatus).toHaveBeenCalled())
    const topic = screen.getByPlaceholderText('tabs.brainstormTopicPlaceholder')
    fireEvent.change(topic, { target: { value: '#CT-12' } })
    fireEvent.click(await pickerOption())

    await waitFor(() => expect(materializeTabContext).toHaveBeenCalled())
    expect(props.onWorkingSetChange).not.toHaveBeenCalled()
  })
})
