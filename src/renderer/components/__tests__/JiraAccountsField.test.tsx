/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { JiraAccount } from '@shared/jiraAccounts'
import { JiraAccountsField } from '../JiraAccountsField'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  }),
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

function renderField(overrides: Partial<React.ComponentProps<typeof JiraAccountsField>> = {}) {
  const onSetDefault = vi.fn()
  const onDelete = vi.fn()
  const onUseInWorkspace = vi.fn()
  const onVerify = vi.fn()
  const onAdd = vi.fn()

  render(
    <JiraAccountsField
      accounts={ACCOUNTS}
      defaultAccountId="j1"
      workspaceAccountId=""
      hasProject
      onSetDefault={onSetDefault}
      onDelete={onDelete}
      onUseInWorkspace={onUseInWorkspace}
      onVerify={onVerify}
      onAdd={onAdd}
      {...overrides}
    />,
  )

  return { onSetDefault, onDelete, onUseInWorkspace, onVerify, onAdd }
}

afterEach(cleanup)

describe('JiraAccountsField', () => {
  it('pinta una ficha por cuenta con host y email', () => {
    renderField()

    expect(screen.getByText('acme.atlassian.net · dev@acme.com')).toBeTruthy()
    expect(screen.getByText('beta.atlassian.net · ops@beta.com')).toBeTruthy()
  })

  it('la cuenta por defecto muestra el badge y las demás no', () => {
    renderField()

    expect(screen.getByText('jiraAccounts.defaultAccount')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'jiraAccounts.makeDefault' })).toBeTruthy()
  })

  it('con hasProject false la fila de workspace no se monta', () => {
    renderField({ hasProject: false })

    expect(screen.queryByText('jiraAccounts.useInWorkspace')).toBeNull()
    expect(screen.queryByText('jiraAccounts.inheritDefault')).toBeNull()
  })

  it('elige otra cuenta para el workspace y heredar llama onUseInWorkspace', () => {
    const { onUseInWorkspace } = renderField()

    fireEvent.click(screen.getByRole('button', { name: 'Beta beta.atlassian.net' }))
    expect(onUseInWorkspace).toHaveBeenCalledWith('j2')

    fireEvent.click(screen.getByRole('button', { name: 'jiraAccounts.inheritDefault jiraAccounts.inheritDefaultHint:Acme' }))
    expect(onUseInWorkspace).toHaveBeenCalledWith('')
  })

  it('borrar abre confirm y solo tras confirmar llama onDelete', () => {
    const { onDelete } = renderField()

    fireEvent.click(screen.getByRole('button', { name: 'jiraAccounts.deleteAccount Acme' }))
    expect(screen.getByText('jiraAccounts.deleteConfirm:Acme')).toBeTruthy()
    expect(onDelete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'ui.confirmOk' }))
    expect(onDelete).toHaveBeenCalledWith('j1')
  })

  it('sin onVerify no pinta el botón de verificar; con él sigue llamando', () => {
    renderField({ onVerify: undefined })

    expect(screen.queryByRole('button', { name: 'jiraAccounts.verify Acme' })).toBeNull()

    cleanup()
    const { onVerify } = renderField()

    fireEvent.click(screen.getByRole('button', { name: 'jiraAccounts.verify Acme' }))
    expect(onVerify).toHaveBeenCalledWith('j1')
  })

  it('el alta llama onAdd con los cuatro campos y exige token', () => {
    const { onAdd } = renderField({ accounts: [] })

    fireEvent.change(screen.getByLabelText('jiraAccounts.labelField'), {
      target: { value: 'Nueva' },
    })
    fireEvent.change(screen.getByLabelText('jiraAccounts.siteField'), {
      target: { value: 'https://nueva.atlassian.net' },
    })
    fireEvent.change(screen.getByLabelText('jiraAccounts.emailField'), {
      target: { value: 'me@nueva.com' },
    })

    const addButton = screen.getByRole('button', { name: 'jiraAccounts.addAccount' })
    expect(addButton).toHaveProperty('disabled', true)

    fireEvent.change(screen.getByLabelText('jiraAccounts.tokenField'), {
      target: { value: 'tok_secret' },
    })
    expect(addButton).toHaveProperty('disabled', false)

    fireEvent.click(addButton)
    expect(onAdd).toHaveBeenCalledWith({
      label: 'Nueva',
      site: 'https://nueva.atlassian.net',
      email: 'me@nueva.com',
      apiToken: 'tok_secret',
    })
  })
})
