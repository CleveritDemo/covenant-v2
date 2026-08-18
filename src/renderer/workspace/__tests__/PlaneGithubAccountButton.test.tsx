/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PlaneGithubAccountButton } from '../PlaneGithubAccountButton'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string) => key,
  }),
}))

const githubAccountsList = vi.fn()
const githubWorkspaceAccountGet = vi.fn()
const githubWorkspaceAccountSet = vi.fn()

beforeEach(() => {
  githubAccountsList.mockReset()
  githubWorkspaceAccountGet.mockReset()
  githubWorkspaceAccountSet.mockReset()
  githubAccountsList.mockResolvedValue({
    ok: true,
    accounts: [
      { id: 'a1', label: 'Personal' },
      { id: 'a2', label: 'Trabajo' },
    ],
    defaultAccountId: 'a1',
  })
  githubWorkspaceAccountGet.mockResolvedValue({ ok: true, accountId: 'a1' })
  githubWorkspaceAccountSet.mockResolvedValue({ ok: true })
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    githubAccountsList,
    githubWorkspaceAccountGet,
    githubWorkspaceAccountSet,
  }
})

afterEach(cleanup)

describe('PlaneGithubAccountButton', () => {
  it('muestra la etiqueta de la cuenta activa', async () => {
    render(<PlaneGithubAccountButton projectFolder="/tmp/repo" />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'tabs.planeGithubAccount' }).textContent).toContain('Personal')
    })
  })

  it('elegir otra llama set con su id', async () => {
    render(<PlaneGithubAccountButton projectFolder="/tmp/repo" />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'tabs.planeGithubAccount' }).textContent).toContain('Personal')
    })

    fireEvent.click(screen.getByText('Trabajo'))
    await waitFor(() => {
      expect(githubWorkspaceAccountSet).toHaveBeenCalledWith('/tmp/repo', 'a2')
    })
  })

  it('usar la por defecto llama set con null', async () => {
    render(<PlaneGithubAccountButton projectFolder="/tmp/repo" />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'tabs.planeGithubAccount' }).textContent).toContain('Personal')
    })

    fireEvent.click(screen.getByText('tabs.planeGithubAccountUseDefault'))
    await waitFor(() => {
      expect(githubWorkspaceAccountSet).toHaveBeenCalledWith('/tmp/repo', null)
    })
  })

  it('no se monta sin projectFolder', () => {
    const { container } = render(<PlaneGithubAccountButton projectFolder="" />)
    expect(container.firstChild).toBeNull()
    expect(githubAccountsList).not.toHaveBeenCalled()
  })

  it('cuenta bindeada ausente de la lista muestra la etiqueta por defecto', async () => {
    githubWorkspaceAccountGet.mockResolvedValue({ ok: true, accountId: 'gone' })
    render(<PlaneGithubAccountButton projectFolder="/tmp/repo" />)
    await waitFor(() => {
      const label = screen.getByRole('button', { name: 'tabs.planeGithubAccount' }).textContent
      expect(label).toContain('tabs.planeGithubAccountDefault')
      expect(label).not.toContain('gone')
    })
  })
})
