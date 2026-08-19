/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { GithubRepoListResult, GithubRepoOption } from '../../../shared/githubRepoPicker'
import { GithubRepoPicker } from '../GithubRepoPicker'
import { WorkspaceDetailPanel } from '../WorkspaceDetailPanel'
import type { CovenantApi } from '../../covenantApi'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
    i18n: { language: 'en' },
  }),
}))

const getCovenantApi = vi.fn<() => CovenantApi | undefined>()

vi.mock('../../covenantApi', async importOriginal => {
  const actual = await importOriginal<typeof import('../../covenantApi')>()
  return {
    ...actual,
    getCovenantApi: () => getCovenantApi(),
  }
})

const acme: GithubRepoOption = {
  fullName: 'acme/app',
  cloneUrl: 'https://github.com/acme/app.git',
  isPrivate: true,
  archived: false,
  pushedAt: '2026-01-15T12:00:00Z',
  description: 'App',
}

const other: GithubRepoOption = {
  fullName: 'acme/other',
  cloneUrl: 'https://github.com/acme/other.git',
  isPrivate: false,
  archived: false,
  pushedAt: '2026-02-01T12:00:00Z',
  description: '',
}

const githubReposList = vi.fn<(accountId: string, query: string) => Promise<GithubRepoListResult>>()

function listResult(overrides: Partial<GithubRepoListResult> = {}): GithubRepoListResult {
  return { repos: [acme, other], truncated: false, ...overrides }
}

beforeEach(() => {
  githubReposList.mockReset()
  githubReposList.mockResolvedValue(listResult())
  getCovenantApi.mockReset()
  ;(window as unknown as { api: Record<string, unknown> }).api = { githubReposList }
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe('GithubRepoPicker', () => {
  it('pide la lista al montar y pinta las filas', async () => {
    render(
      <GithubRepoPicker
        accountId="acc-1"
        disabled={false}
        excludeFullNames={[]}
        onPick={() => {}}
      />,
    )

    await waitFor(() => expect(githubReposList).toHaveBeenCalledWith('acc-1', ''))
    expect(await screen.findByRole('option', { name: 'acme/app' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'acme/other' })).toBeTruthy()
    expect(screen.getByText('organizations.repoPickerPrivate')).toBeTruthy()
  })

  it('escribir dispara una segunda llamada con el texto tras el debounce', async () => {
    vi.useFakeTimers()
    render(
      <GithubRepoPicker
        accountId="acc-1"
        disabled={false}
        excludeFullNames={[]}
        onPick={() => {}}
      />,
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(githubReposList).toHaveBeenCalledTimes(1)
    expect(githubReposList).toHaveBeenCalledWith('acc-1', '')

    fireEvent.change(screen.getByPlaceholderText('organizations.repoPickerPlaceholder'), {
      target: { value: 'acme' },
    })
    expect(githubReposList).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(249)
    })
    expect(githubReposList).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(githubReposList).toHaveBeenCalledTimes(2)
    expect(githubReposList).toHaveBeenLastCalledWith('acc-1', 'acme')
  })

  it('las filas ya vinculadas se pintan deshabilitadas y no llaman onPick', async () => {
    const onPick = vi.fn()
    render(
      <GithubRepoPicker
        accountId="acc-1"
        disabled={false}
        excludeFullNames={['ACME/APP']}
        onPick={onPick}
      />,
    )

    const linked = await screen.findByRole('option', { name: 'acme/app. organizations.repoPickerAlreadyLinked' })
    expect((linked as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(linked)
    expect(onPick).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('option', { name: 'acme/other' }))
    expect(onPick).toHaveBeenCalledWith(other)
  })

  it('↑/↓ mueven la selección, Enter elige y Escape limpia el filtro', async () => {
    const onPick = vi.fn()
    render(
      <GithubRepoPicker
        accountId="acc-1"
        disabled={false}
        excludeFullNames={[]}
        onPick={onPick}
      />,
    )
    await screen.findByRole('option', { name: 'acme/app' })

    const filter = screen.getByPlaceholderText('organizations.repoPickerPlaceholder')
    fireEvent.change(filter, { target: { value: 'acme' } })
    fireEvent.keyDown(filter, { key: 'ArrowDown' })
    fireEvent.keyDown(filter, { key: 'Enter' })
    expect(onPick).toHaveBeenCalledWith(other)

    fireEvent.keyDown(filter, { key: 'Escape' })
    expect(filter).toHaveProperty('value', '')
  })

  it('pinta el error y la pista de truncado sin caja', async () => {
    githubReposList.mockResolvedValue(listResult({
      truncated: true,
      error: 'rate limited',
    }))
    render(
      <GithubRepoPicker
        accountId="acc-1"
        disabled={false}
        excludeFullNames={[]}
        onPick={() => {}}
      />,
    )

    expect(await screen.findByText('rate limited')).toBeTruthy()
    expect(screen.getByText('organizations.repoPickerTruncated')).toBeTruthy()
    expect(document.querySelector('.github-repo-picker__status')?.className)
      .not.toMatch(/danger|error-box/)
  })
})

describe('WorkspaceReposSection — picker de alta', () => {
  const workspace = {
    id: 'w1',
    name: 'covenant',
    assignees: ['lenar'],
    admins: ['karluiz'],
    createdBy: 'karluiz',
  }

  function renderPanel(): ReturnType<typeof render> {
    const covenant = {
      workspaceReposList: vi.fn().mockResolvedValue({ ok: true, data: [] }),
      workspaceRepoAdd: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: 'r1', repoFullName: 'acme/app', cloneUrl: acme.cloneUrl, position: 0, createdAt: 0 },
      }),
      workspaceRepoUpdate: vi.fn(),
      workspaceRepoDelete: vi.fn(),
    } as unknown as CovenantApi
    getCovenantApi.mockReturnValue(covenant)
    return render(
      <WorkspaceDetailPanel
        slug="rodrigoanti"
        workspace={workspace}
        accountId="acc-1"
        memberLogins={['karluiz', 'lenar']}
        canManageAssignees
        canManageProjectAdmins
        canDelete={false}
        busy={false}
        openBusy={false}
        openError={null}
        onOpenRequest={() => {}}
        onDeleteRequest={() => {}}
        onAssigneeAdd={() => {}}
        onAssigneeRemove={() => {}}
        onAdminAdd={() => {}}
        onAdminRemove={() => {}}
      />,
    )
  }

  it('elegir en el picker rellena la URL, enfoca la carpeta y no envía', async () => {
    renderPanel()
    fireEvent.click(await screen.findByRole('button', { name: 'organizations.addRepo' }))

    fireEvent.click(await screen.findByRole('option', { name: 'acme/app' }))
    await act(async () => {
      await new Promise<void>(resolve => {
        requestAnimationFrame(() => resolve())
      })
    })

    const url = screen.getByLabelText('organizations.repoCloneUrlPlaceholder') as HTMLInputElement
    expect(url.value).toBe(acme.cloneUrl)
    expect(screen.getByLabelText('organizations.repoFolderNameLabel')).toBe(document.activeElement)
    expect(getCovenantApi()!.workspaceRepoAdd).not.toHaveBeenCalled()
  })
})
