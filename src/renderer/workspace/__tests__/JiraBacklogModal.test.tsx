/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string, vars?: Record<string, string>) => {
    if (key === 'tabs.jiraBacklogResult' && vars) {
      return `${vars.created}/${vars.failed}`
    }
    return key
  } }),
}))

vi.mock('../../components/TerminalModal', () => ({
  TerminalModal: ({
    open,
    children,
    footer,
  }: {
    open: boolean
    children: React.ReactNode
    footer?: React.ReactNode
  }) => (open ? <div>{children}{footer}</div> : null),
}))

const jiraStatus = vi.fn()
const jiraIssueTypes = vi.fn()
const jiraCreateIssues = vi.fn()

import { JiraBacklogModal } from '../JiraBacklogModal'

describe('JiraBacklogModal', () => {
  beforeEach(() => {
    jiraStatus.mockReset().mockResolvedValue({
      configured: true,
      site: 'https://example.atlassian.net',
      email: 'dev@example.com',
      projectKeys: ['GRAV'],
      connected: true,
    })
    jiraIssueTypes.mockReset().mockResolvedValue({
      ok: true,
      issueTypes: [
        { id: '1', name: 'Epic', subtask: false },
        { id: '2', name: 'Story', subtask: false },
        { id: '3', name: 'Task', subtask: false },
        { id: '4', name: 'Sub-task', subtask: true },
      ],
    })
    jiraCreateIssues.mockReset().mockResolvedValue({
      ok: true,
      results: [{ tempId: 'n1', ok: true, key: 'GRAV-1' }],
    })
    ;(window as unknown as { api: Record<string, unknown> }).api = {
      jiraStatus,
      jiraIssueTypes,
      jiraCreateIssues,
    }
  })

  afterEach(cleanup)

  it('shows not connected when Jira is missing', async () => {
    jiraStatus.mockResolvedValue({
      configured: false,
      site: '',
      email: '',
      projectKeys: [],
      connected: false,
    })

    render(
      <JiraBacklogModal
        open
        cwd="/repo"
        topic="Sprint"
        ceremony="free"
        fields={{ next: '- Ship it' }}
        onClose={() => undefined}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('tabs.jiraBacklogNotConnected')).toBeTruthy()
    })
    expect(jiraIssueTypes).not.toHaveBeenCalled()
  })

  it('builds editable rows from the closing plan', async () => {
    render(
      <JiraBacklogModal
        open
        cwd="/repo"
        topic="Sprint"
        ceremony="sprintPlanning"
        fields={{
          committed: '- S1 — Login',
          tasks: '- S1.1 — Wire form',
        }}
        onClose={() => undefined}
      />,
    )

    await waitFor(() => {
      expect(jiraIssueTypes).toHaveBeenCalledWith('/repo', 'GRAV')
    })
    expect(screen.getByDisplayValue('S1 — Login')).toBeTruthy()
    expect(screen.getByDisplayValue('S1.1 — Wire form')).toBeTruthy()
  })

  it('creates issues and shows the result line', async () => {
    render(
      <JiraBacklogModal
        open
        cwd="/repo"
        topic="Room"
        ceremony="free"
        fields={{ next: '- One task' }}
        onClose={() => undefined}
      />,
    )

    await waitFor(() => {
      expect(screen.getByDisplayValue('One task')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'tabs.jiraBacklogCreate' }))

    await waitFor(() => {
      expect(jiraCreateIssues).toHaveBeenCalledTimes(1)
    })
    const payload = jiraCreateIssues.mock.calls[0][1]
    expect(payload.projectKey).toBe('GRAV')
    expect(payload.nodes[0]).toMatchObject({
      tempId: 'n1',
      issueTypeName: 'Task',
      summary: 'One task',
    })
    await waitFor(() => {
      expect(screen.getByText('GRAV-1')).toBeTruthy()
      expect(screen.getByText('1/0')).toBeTruthy()
    })
  })

  it('disables create when a summary is blank', async () => {
    render(
      <JiraBacklogModal
        open
        cwd="/repo"
        topic="Room"
        ceremony="free"
        fields={{ next: '- One task' }}
        onClose={() => undefined}
      />,
    )

    await waitFor(() => {
      expect(screen.getByDisplayValue('One task')).toBeTruthy()
    })

    fireEvent.change(screen.getByDisplayValue('One task'), { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: 'tabs.jiraBacklogCreate' })).toHaveProperty('disabled', true)
  })

  it('deleting a story removes its subtasks from the tree and create payload', async () => {
    render(
      <JiraBacklogModal
        open
        cwd="/repo"
        topic="Sprint"
        ceremony="sprintPlanning"
        fields={{
          committed: '- S1 — Login flow',
          tasks: [
            '- S1.1 — Wire auth form',
            '- S1.2 — Validate tokens',
            '- Algo suelto',
          ].join('\n'),
        }}
        onClose={() => undefined}
      />,
    )

    await waitFor(() => {
      expect(screen.getByDisplayValue('S1 — Login flow')).toBeTruthy()
    })

    const storyRow = screen.getByDisplayValue('S1 — Login flow').closest('.jira-backlog__row')
    expect(storyRow).toBeTruthy()
    fireEvent.click(within(storyRow as HTMLElement).getByRole('button', { name: 'tabs.jiraBacklogDelete' }))

    expect(screen.queryByDisplayValue('S1 — Login flow')).toBeNull()
    expect(screen.queryByDisplayValue('S1.1 — Wire auth form')).toBeNull()
    expect(screen.queryByDisplayValue('S1.2 — Validate tokens')).toBeNull()
    expect(screen.getByDisplayValue('Algo suelto')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'tabs.jiraBacklogCreate' }))

    await waitFor(() => {
      expect(jiraCreateIssues).toHaveBeenCalledTimes(1)
    })
    const payload = jiraCreateIssues.mock.calls[0][1]
    const tempIds = payload.nodes.map((node: { tempId: string }) => node.tempId)
    expect(tempIds).not.toContain('n1')
    expect(tempIds).not.toContain('n1.1')
    expect(tempIds).not.toContain('n1.2')
    expect(tempIds).toEqual(['n2'])
  })

  it('shows per-row create results and disables successfully created rows', async () => {
    jiraCreateIssues.mockResolvedValue({
      ok: true,
      results: [
        { tempId: 'n1', ok: true, key: 'ABC-1' },
        { tempId: 'n2', ok: false, error: 'sin permiso' },
      ],
    })

    render(
      <JiraBacklogModal
        open
        cwd="/repo"
        topic="Room"
        ceremony="free"
        fields={{ next: '- Task A\n- Task B' }}
        onClose={() => undefined}
      />,
    )

    await waitFor(() => {
      expect(screen.getByDisplayValue('Task A')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'tabs.jiraBacklogCreate' }))

    await waitFor(() => {
      expect(screen.getByText('ABC-1')).toBeTruthy()
      expect(screen.getByText('sin permiso')).toBeTruthy()
    })
    expect(screen.getByDisplayValue('Task A')).toHaveProperty('disabled', true)
    expect(screen.getByDisplayValue('Task B')).toHaveProperty('disabled', false)
  })
})
