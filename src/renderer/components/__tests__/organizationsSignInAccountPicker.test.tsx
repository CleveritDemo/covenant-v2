/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { CovenantApi } from '../../covenantApi'
import { OrganizationsView } from '../OrganizationsView'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  }),
}))

const getCovenantApi = vi.fn<(accountId?: string) => CovenantApi | undefined>()

vi.mock('../../covenantApi', async importOriginal => {
  const actual = await importOriginal<typeof import('../../covenantApi')>()
  return {
    ...actual,
    getCovenantApi: (accountId?: string) => getCovenantApi(accountId),
  }
})

const githubAccountsList = vi.fn()

beforeAll(() => {
  const proto = HTMLElement.prototype as HTMLElement & {
    showPopover: () => void
    hidePopover: () => void
    togglePopover: () => boolean
  }
  const dispatchToggle = (el: HTMLElement, newState: 'open' | 'closed'): void => {
    el.dispatchEvent(Object.assign(new Event('toggle'), { newState }))
  }
  proto.showPopover = function showPopover(this: HTMLElement) {
    this.setAttribute('data-open', '')
    dispatchToggle(this, 'open')
  }
  proto.hidePopover = function hidePopover(this: HTMLElement) {
    this.removeAttribute('data-open')
    dispatchToggle(this, 'closed')
  }
  proto.togglePopover = function togglePopover(this: HTMLElement) {
    if (this.hasAttribute('data-open')) {
      this.hidePopover()
      return false
    }
    this.showPopover()
    return true
  }
})

function stubApi(overrides: Partial<CovenantApi> = {}): CovenantApi {
  const noop = vi.fn().mockResolvedValue({ ok: true, data: [] })
  return {
    status: vi.fn().mockResolvedValue({ ok: true, data: { signedIn: false } }),
    signIn: vi.fn().mockResolvedValue({ ok: true, data: { signedIn: false } }),
    signOut: vi.fn().mockResolvedValue({ ok: true, data: null }),
    orgsList: vi.fn().mockResolvedValue({ ok: true, data: [] }),
    workspacesList: noop,
    workspaceCreate: noop,
    workspaceRename: noop,
    workspaceDelete: noop,
    workspaceAssigneeAdd: noop,
    workspaceAssigneeRemove: noop,
    workspaceAdminAdd: noop,
    workspaceAdminRemove: noop,
    workspaceAgentsList: vi.fn().mockResolvedValue({ ok: true, data: [] }),
    workspaceAgentUpsert: noop,
    workspaceAgentDelete: noop,
    workspaceContextsList: vi.fn().mockResolvedValue({ ok: true, data: [] }),
    workspaceContextUpsert: noop,
    workspaceContextDelete: noop,
    orgAdminsList: noop,
    orgAdminAdd: noop,
    orgAdminRemove: noop,
    ...overrides,
  } as unknown as CovenantApi
}

beforeEach(() => {
  githubAccountsList.mockReset()
  getCovenantApi.mockReset()
  getCovenantApi.mockImplementation(() => stubApi())
  vi.stubGlobal('window', Object.assign(window, {
    api: {
      covenant: stubApi(),
      githubAccountsList,
      githubReposList: vi.fn().mockResolvedValue({ repos: [], truncated: false }),
    },
  }))
})

afterEach(cleanup)

describe('OrganizationsView — selector de cuenta en SignInPanel', () => {
  it('con dos cuentas muestra el selector en sign-in y el hint nombra la cuenta activa', async () => {
    githubAccountsList.mockResolvedValue({
      ok: true,
      accounts: [
        { id: 'a1', label: 'Personal' },
        { id: 'a2', label: 'Trabajo' },
      ],
      defaultAccountId: 'a1',
    })
    render(<OrganizationsView onClose={() => {}} />)

    const signIn = await waitFor(() => {
      const el = document.querySelector('.orgs-signin')
      expect(el).toBeTruthy()
      return el as HTMLElement
    })
    expect(within(signIn).getByRole('button', { name: 'organizations.accountSelector' })).toBeTruthy()
    expect(within(signIn).getByText('organizations.signInAccountHint:Personal')).toBeTruthy()
  })

  it('con una sola cuenta no renderiza el selector', async () => {
    githubAccountsList.mockResolvedValue({
      ok: true,
      accounts: [{ id: 'a1', label: 'Personal' }],
      defaultAccountId: 'a1',
    })
    render(<OrganizationsView onClose={() => {}} />)

    await waitFor(() => {
      expect(document.querySelector('.orgs-signin')).toBeTruthy()
    })
    expect(screen.queryByRole('button', { name: 'organizations.accountSelector' })).toBeNull()
  })

  it('al cambiar el selector se pide el facade con el otro accountId', async () => {
    githubAccountsList.mockResolvedValue({
      ok: true,
      accounts: [
        { id: 'a1', label: 'Personal' },
        { id: 'a2', label: 'Trabajo' },
      ],
      defaultAccountId: 'a1',
    })
    getCovenantApi.mockImplementation((accountId?: string) => stubApi())

    render(<OrganizationsView onClose={() => {}} />)

    const signIn = await waitFor(() => {
      const el = document.querySelector('.orgs-signin')
      expect(el).toBeTruthy()
      return el as HTMLElement
    })
    await waitFor(() => {
      expect(getCovenantApi).toHaveBeenCalledWith('a1')
    })

    const panel = within(signIn).getByRole('listbox', { hidden: true })
    act(() => {
      panel.dispatchEvent(Object.assign(new Event('toggle'), { newState: 'open' }))
      panel.showPopover()
    })
    fireEvent.pointerDown(within(panel).getByRole('option', { name: 'Trabajo' }))
    fireEvent.click(within(panel).getByRole('option', { name: 'Trabajo' }))

    await waitFor(() => {
      expect(getCovenantApi).toHaveBeenCalledWith('a2')
    })
  })
})
