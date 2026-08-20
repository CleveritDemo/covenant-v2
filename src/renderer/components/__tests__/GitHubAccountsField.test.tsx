/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { GitHubAccountsField } from '../GitHubAccountsField'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  }),
}))

const githubAccountsList = vi.fn()
const githubAccountUpsert = vi.fn()
const githubAccountDelete = vi.fn()
const githubAccountSetDefault = vi.fn()
const githubAccountCheck = vi.fn()
const githubCheckToken = vi.fn()
const openExternalUrl = vi.fn()

beforeEach(() => {
  githubAccountsList.mockReset()
  githubAccountUpsert.mockReset()
  githubAccountDelete.mockReset()
  githubAccountSetDefault.mockReset()
  githubAccountCheck.mockReset()
  githubCheckToken.mockReset()
  openExternalUrl.mockReset()
  githubAccountsList.mockResolvedValue({
    ok: true,
    accounts: [
      { id: 'a1', label: 'Personal' },
      { id: 'a2', label: 'Trabajo' },
    ],
    defaultAccountId: 'a1',
  })
  githubAccountUpsert.mockResolvedValue({ ok: true, account: { id: 'n1', label: 'Nueva' } })
  githubAccountDelete.mockResolvedValue({ ok: true })
  githubAccountSetDefault.mockResolvedValue({ ok: true })
  githubAccountCheck.mockResolvedValue({ ok: true, login: 'karluiz', scopes: ['repo', 'workflow'] })
  githubCheckToken.mockResolvedValue({ ok: true, login: 'karluiz', scopes: ['repo', 'workflow'] })
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    githubAccountsList,
    githubAccountUpsert,
    githubAccountDelete,
    githubAccountSetDefault,
    githubAccountCheck,
    githubCheckToken,
    openExternalUrl,
  }
})

afterEach(cleanup)

describe('GitHubAccountsField', () => {
  it('lista dos cuentas como fichas con identidad visible', async () => {
    render(<GitHubAccountsField />)

    await waitFor(() => {
      expect(screen.getByText('Personal')).toBeTruthy()
      expect(screen.getByText('Trabajo')).toBeTruthy()
    })
    expect(screen.queryByDisplayValue('Personal')).toBeNull()
    expect(screen.getByText('settings.githubDefault')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'settings.githubMakeDefault' })).toBeTruthy()
  })

  it('alta llama upsert con label y token', async () => {
    githubAccountsList.mockResolvedValue({ ok: true, accounts: [], defaultAccountId: '' })
    render(<GitHubAccountsField />)
    await waitFor(() => expect(githubAccountsList).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText('settings.githubAccountLabel'), {
      target: { value: 'Nueva' },
    })
    fireEvent.change(screen.getByPlaceholderText('settings.githubTokenPlaceholder'), {
      target: { value: 'ghp_abc' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'settings.githubAddAccount' }))

    await waitFor(() => {
      expect(githubAccountUpsert).toHaveBeenCalledWith({ label: 'Nueva', token: 'ghp_abc' })
    })
  })

  it('con cuentas existentes el alta empieza colapsada', async () => {
    render(<GitHubAccountsField />)
    await waitFor(() => expect(screen.getByText('Personal')).toBeTruthy())

    expect(screen.queryByLabelText('settings.githubAccountLabel')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'settings.githubAddAccount' }))
    expect(screen.getByLabelText('settings.githubAccountLabel')).toBeTruthy()
  })

  it('borrar pide confirmación', async () => {
    render(<GitHubAccountsField />)
    await waitFor(() => expect(screen.getByText('Personal')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'settings.githubDeleteAccount Personal' }))
    expect(screen.getByText('settings.githubDeleteConfirm:Personal')).toBeTruthy()
    expect(githubAccountDelete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'ui.confirmOk' }))
    await waitFor(() => expect(githubAccountDelete).toHaveBeenCalledWith('a1'))
  })

  it('borrar una cuenta llama onAccountDeleted con su id', async () => {
    const onAccountDeleted = vi.fn()
    render(<GitHubAccountsField onAccountDeleted={onAccountDeleted} />)
    await waitFor(() => expect(screen.getByText('Personal')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'settings.githubDeleteAccount Personal' }))
    fireEvent.click(screen.getByRole('button', { name: 'ui.confirmOk' }))
    await waitFor(() => expect(onAccountDeleted).toHaveBeenCalledWith('a1'))
  })

  it('validar una cuenta guardada usa githubAccountCheck y pinta login', async () => {
    render(<GitHubAccountsField />)
    await waitFor(() => expect(screen.getByText('Personal')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'settings.githubValidate Personal' }))
    await waitFor(() => {
      expect(githubAccountCheck).toHaveBeenCalledWith('a1')
      expect(screen.getByText('@karluiz')).toBeTruthy()
      expect(screen.getByText('settings.githubTokenConnected:karluiz')).toBeTruthy()
    })
    expect(screen.getByText('Personal · repo · workflow')).toBeTruthy()
    expect(githubCheckToken).not.toHaveBeenCalled()
  })

  it('renombrar muestra input solo al pulsar Renombrar', async () => {
    render(<GitHubAccountsField />)
    await waitFor(() => expect(screen.getByText('Personal')).toBeTruthy())

    fireEvent.click(screen.getAllByRole('button', { name: 'settings.githubRename' })[0])
    const input = screen.getByDisplayValue('Personal')
    fireEvent.change(input, { target: { value: 'Casa' } })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(githubAccountUpsert).toHaveBeenCalledWith({ id: 'a1', label: 'Casa' })
    })
  })
})
