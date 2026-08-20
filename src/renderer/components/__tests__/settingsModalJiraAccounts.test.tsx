/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CONFIG_DEFAULTS } from '@shared/configSchema'
import type { JiraAccount } from '@shared/jiraAccounts'
import { SettingsModal } from '../SettingsModal'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  }),
}))

vi.mock('../TerminalModal', () => ({
  TerminalModal: ({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) => (
    <div>{children}<div>{footer}</div></div>
  ),
}))

vi.mock('../AgentCliTable', () => ({
  AgentCliTable: () => <div data-testid="cli-table" />,
}))
vi.mock('../GitHubAccountsField', () => ({
  GitHubAccountsField: () => <div data-testid="accounts-field" />,
}))
vi.mock('../JiraConnectionField', () => ({
  JiraConnectionField: () => <div data-testid="jira-connection-field" />,
}))

const ACCOUNTS: JiraAccount[] = [
  {
    id: 'j1',
    label: 'Acme',
    site: 'https://acme.atlassian.net',
    email: 'dev@acme.com',
  },
  {
    id: 'j2',
    label: 'Beta',
    site: 'https://beta.atlassian.net',
    email: 'ops@beta.com',
  },
]

const jiraAccountsList = vi.fn()
const jiraAccountUpsert = vi.fn()
const jiraAccountDelete = vi.fn()
const jiraAccountSetDefault = vi.fn()
const jiraWorkspaceAccountGet = vi.fn()
const jiraWorkspaceAccountSet = vi.fn()
const setConfig = vi.fn()
const config = { ...CONFIG_DEFAULTS, musicEnabled: true }
const projectCwd = '/repo'

beforeEach(() => {
  jiraAccountsList.mockReset().mockResolvedValue({
    ok: true,
    accounts: ACCOUNTS,
    defaultAccountId: 'j1',
  })
  jiraAccountUpsert.mockReset().mockResolvedValue({ ok: true, account: ACCOUNTS[0] })
  jiraAccountDelete.mockReset().mockResolvedValue({ ok: true })
  jiraAccountSetDefault.mockReset().mockResolvedValue({ ok: true })
  jiraWorkspaceAccountGet.mockReset().mockResolvedValue({ ok: true, accountId: 'j2' })
  jiraWorkspaceAccountSet.mockReset().mockResolvedValue({ ok: true })
  setConfig.mockReset().mockResolvedValue({ ok: true })

  vi.stubGlobal('window', Object.assign(window, {
    api: {
      setConfig,
      openConfigFolder: vi.fn(),
      getAppVersion: vi.fn().mockResolvedValue('0.0.0'),
      getUpdateState: vi.fn().mockResolvedValue({ kind: 'idle' }),
      onUpdateState: vi.fn().mockReturnValue(() => {}),
      checkForUpdates: vi.fn().mockResolvedValue({ kind: 'idle' }),
      installUpdate: vi.fn(),
      jiraAccountsList,
      jiraAccountUpsert,
      jiraAccountDelete,
      jiraAccountSetDefault,
      jiraWorkspaceAccountGet,
      jiraWorkspaceAccountSet,
    },
  }))
})

afterEach(cleanup)

function openJiraSection(): void {
  render(
    <SettingsModal
      config={config}
      onSave={() => {}}
      onClose={() => {}}
      cwd={projectCwd}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'jira.section' }))
}

describe('SettingsModal Jira accounts', () => {
  it('al abrir Jira lista cuentas y el binding del workspace', async () => {
    openJiraSection()

    await waitFor(() => expect(jiraAccountsList).toHaveBeenCalled())
    await waitFor(() => expect(jiraWorkspaceAccountGet).toHaveBeenCalledWith(projectCwd))
    expect(screen.getByText('acme.atlassian.net · dev@acme.com')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Beta beta.atlassian.net' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByRole('button', { name: 'jiraAccounts.verify Acme' })).toBeNull()
  })

  it('elige cuenta para el workspace y heredar llama jiraWorkspaceAccountSet', async () => {
    openJiraSection()
    await waitFor(() => expect(jiraWorkspaceAccountGet).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'Acme acme.atlassian.net' }))
    await waitFor(() => expect(jiraWorkspaceAccountSet).toHaveBeenCalledWith(projectCwd, 'j1'))
    expect(jiraWorkspaceAccountGet).toHaveBeenCalledTimes(2)

    fireEvent.click(screen.getByRole('button', {
      name: 'jiraAccounts.inheritDefault jiraAccounts.inheritDefaultHint:Acme',
    }))
    await waitFor(() => expect(jiraWorkspaceAccountSet).toHaveBeenCalledWith(projectCwd, ''))
    expect(jiraWorkspaceAccountGet).toHaveBeenCalledTimes(3)
  })

  it('un ok:false en el alta muestra el error del IPC', async () => {
    jiraAccountsList.mockResolvedValueOnce({
      ok: true,
      accounts: [],
      defaultAccountId: '',
    })
    jiraAccountUpsert.mockResolvedValueOnce({ ok: false, error: 'Token inválido' })

    openJiraSection()
    await waitFor(() => expect(jiraAccountsList).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText('jiraAccounts.labelField'), { target: { value: 'Nueva' } })
    fireEvent.change(screen.getByLabelText('jiraAccounts.siteField'), {
      target: { value: 'https://nueva.atlassian.net' },
    })
    fireEvent.change(screen.getByLabelText('jiraAccounts.emailField'), {
      target: { value: 'me@nueva.com' },
    })
    fireEvent.change(screen.getByLabelText('jiraAccounts.tokenField'), {
      target: { value: 'bad' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'jiraAccounts.addAccount' }))

    await waitFor(() => expect(jiraAccountUpsert).toHaveBeenCalled())
    expect(await screen.findByText('Token inválido')).toBeTruthy()
    expect(jiraAccountsList).toHaveBeenCalledTimes(1)
  })
})
