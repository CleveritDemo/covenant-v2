/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { GitHubTokenField } from '../GitHubTokenField'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  }),
}))

const githubCheckToken = vi.fn()
const openExternalUrl = vi.fn()

beforeEach(() => {
  githubCheckToken.mockReset()
  vi.stubGlobal('window', Object.assign(window, { api: { githubCheckToken, openExternalUrl } }))
})

afterEach(cleanup)

describe('GitHubTokenField', () => {
  it('muestra la identidad y los scopes del token al montar', async () => {
    githubCheckToken.mockResolvedValue({ ok: true, login: 'karluiz', scopes: ['repo', 'workflow'] })

    render(<GitHubTokenField value="ghp_x" onChange={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('settings.githubTokenConnected:karluiz')).toBeTruthy()
    })
    expect(screen.getByText('repo · workflow')).toBeTruthy()
    expect(githubCheckToken).toHaveBeenCalledWith('ghp_x')
  })

  it('marca el campo como inválido cuando GitHub rechaza el token', async () => {
    githubCheckToken.mockResolvedValue({ ok: false, error: 'Bad credentials' })

    const { container } = render(<GitHubTokenField value="ghp_malo" onChange={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('settings.githubTokenInvalid:Bad credentials')).toBeTruthy()
    })
    expect(container.querySelector('input[aria-invalid="true"]')).toBeTruthy()
  })

  it('«missing» informa sin marcar error: el token puede venir del entorno', async () => {
    githubCheckToken.mockResolvedValue({ ok: false, error: 'missing' })

    const { container } = render(<GitHubTokenField value="" onChange={() => {}} />)

    await waitFor(() => expect(screen.getByText('settings.githubTokenMissing')).toBeTruthy())
    expect(container.querySelector('input[aria-invalid="true"]')).toBeNull()
  })

  it('no repite la llamada al salir del campo sin cambiar el valor', async () => {
    githubCheckToken.mockResolvedValue({ ok: true, login: 'karluiz', scopes: [] })

    const { container } = render(<GitHubTokenField value="ghp_x" onChange={() => {}} />)
    await waitFor(() => expect(githubCheckToken).toHaveBeenCalledTimes(1))

    fireEvent.blur(container.querySelector('input') as HTMLInputElement)
    expect(githubCheckToken).toHaveBeenCalledTimes(1)
  })
})
