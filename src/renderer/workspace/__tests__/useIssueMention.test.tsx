/** @vitest-environment jsdom */
import React, { useRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { GithubIssueRef } from '@shared/githubIssue'
import type { JiraIssueRef } from '@shared/jiraIssue'
import type { IssueMentionPicked } from '@shared/issueMention'
import { useIssueMention } from '../useIssueMention'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

const jiraSearch = vi.fn()
const jiraStatus = vi.fn()
const githubIssueSearch = vi.fn()
const githubIssueStatus = vi.fn()

const refs: JiraIssueRef[] = [
  { key: 'GRAV-412', summary: 'Loop chain colgada', status: 'In Progress', issueType: 'Bug', assignee: 'Rodrigo', updated: '2026-08-12T09:40:00.000Z' },
  { key: 'GRAV-407', summary: 'Timeout de PTY', status: 'In Review', issueType: 'Bug', assignee: null, updated: '2026-08-10T09:40:00.000Z' },
]

const githubIssue: GithubIssueRef = {
  number: 123,
  title: 'Fix picker',
  state: 'open',
  repoFullName: 'acme/app',
  updated: '2026-08-18T00:00:00.000Z',
  author: 'gigi',
  labels: [],
}

beforeEach(() => {
  jiraStatus.mockReset().mockResolvedValue({
    configured: true,
    site: 'https://x.atlassian.net',
    email: 'a@x.com',
    projectKeys: ['GRAV'],
    connected: true,
  })
  jiraSearch.mockReset().mockResolvedValue({ issues: refs })
  githubIssueStatus.mockReset().mockResolvedValue({
    connected: true,
    repoFullName: 'acme/app',
  })
  githubIssueSearch.mockReset().mockResolvedValue({ issues: [githubIssue] })
  ;(window as unknown as { api: unknown }).api = {
    jiraStatus,
    jiraSearch,
    githubIssueStatus,
    githubIssueSearch,
  }
})

afterEach(cleanup)

const Box: React.FC<{ onPicked?: (picked: IssueMentionPicked) => void }> = ({ onPicked }) => {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  const mention = useIssueMention({
    cwd: '/repo',
    value,
    onValueChange: setValue,
    inputRef: ref,
    onPicked,
  })
  return (
    <div>
      <textarea
        ref={ref}
        aria-label="draft"
        value={value}
        onChange={event => {
          setValue(event.target.value)
          mention.handleChange(event.target)
        }}
        onSelect={event => mention.handleSelect(event.currentTarget)}
      />
      {mention.picker}
    </div>
  )
}

describe('useIssueMention — carrera de búsqueda', () => {
  it('solo la búsqueda más reciente pinta, aunque resuelva después de reordenarse', async () => {
    type SearchResult = { issues: JiraIssueRef[] }
    let resolveFirst: (result: SearchResult) => void = () => {}
    let resolveSecond: (result: SearchResult) => void = () => {}
    jiraSearch
      .mockImplementationOnce(() => new Promise<SearchResult>(resolve => { resolveFirst = resolve }))
      .mockImplementationOnce(() => new Promise<SearchResult>(resolve => { resolveSecond = resolve }))

    render(<Box />)
    const box = screen.getByLabelText('draft') as HTMLTextAreaElement
    await waitFor(() => expect(jiraStatus).toHaveBeenCalledWith('/repo'))

    fireEvent.change(box, { target: { value: '#GRAV-4' } })
    await waitFor(() => expect(jiraSearch).toHaveBeenCalledTimes(1))

    fireEvent.change(box, { target: { value: '#GRAV-41' } })
    await waitFor(() => expect(jiraSearch).toHaveBeenCalledTimes(2))

    resolveSecond({ issues: [refs[1]] })
    await screen.findByText('Timeout de PTY')

    resolveFirst({ issues: [refs[0]] })
    await waitFor(() => expect(screen.getByText('Timeout de PTY')).toBeTruthy())
    expect(screen.queryByText('Loop chain colgada')).toBeNull()
  })
})

describe('useIssueMention — GitHub', () => {
  it('con GitHub conectado y Jira sin projectKeys, `#123` busca solo GitHub', async () => {
    jiraStatus.mockResolvedValue({
      configured: false,
      site: '',
      email: '',
      projectKeys: [],
      connected: false,
    })
    render(<Box />)
    const box = screen.getByLabelText('draft') as HTMLTextAreaElement
    await waitFor(() => expect(githubIssueStatus).toHaveBeenCalledWith('/repo'))

    fireEvent.change(box, { target: { value: '#123' } })
    await waitFor(() => expect(githubIssueSearch).toHaveBeenCalledWith('/repo', '123'))
    expect(jiraSearch).not.toHaveBeenCalled()
  })

  it('`#CT-1` busca solo Jira aunque GitHub esté conectado', async () => {
    render(<Box />)
    const box = screen.getByLabelText('draft') as HTMLTextAreaElement
    await waitFor(() => expect(jiraStatus).toHaveBeenCalledWith('/repo'))

    fireEvent.change(box, { target: { value: '#CT-1' } })
    await waitFor(() => expect(jiraSearch).toHaveBeenCalledWith('/repo', 'CT-1'))
    expect(githubIssueSearch).not.toHaveBeenCalled()
  })

  it('elegir una fila de GitHub llama onPicked con source github', async () => {
    jiraStatus.mockResolvedValue({
      configured: false,
      site: '',
      email: '',
      projectKeys: [],
      connected: false,
    })
    const onPicked = vi.fn()
    render(<Box onPicked={onPicked} />)
    const box = screen.getByLabelText('draft') as HTMLTextAreaElement
    await waitFor(() => expect(githubIssueStatus).toHaveBeenCalledWith('/repo'))

    fireEvent.change(box, { target: { value: '#123' } })
    const option = await screen.findByRole('option')
    fireEvent.click(option)

    await waitFor(() => expect(onPicked).toHaveBeenCalledTimes(1))
    expect(onPicked).toHaveBeenCalledWith({ source: 'github', issue: githubIssue })
  })
})
