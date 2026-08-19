/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { OrganizationsView } from '../OrganizationsView'
import type { OrgWorkspaceSelection } from '../OrgWorkspaceTabPickerModal'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  }),
}))

const ok = <T,>(data: T) => Promise.resolve({ ok: true as const, data })

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

const covenant = {
  status: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  orgsList: vi.fn(),
  orgCreate: vi.fn(),
  membersList: vi.fn(),
  memberLoginsList: vi.fn(),
  memberAdd: vi.fn(),
  memberRemove: vi.fn(),
  defaultsList: vi.fn(),
  defaultSet: vi.fn(),
  defaultUnset: vi.fn(),
  workspacesList: vi.fn(),
  workspaceCreate: vi.fn(),
  workspaceRename: vi.fn(),
  workspaceDelete: vi.fn(),
  workspaceAssigneeAdd: vi.fn(),
  workspaceAssigneeRemove: vi.fn(),
  workspaceAdminAdd: vi.fn(),
  workspaceAdminRemove: vi.fn(),
  workspaceReposList: vi.fn(),
  workspaceRepoAdd: vi.fn(),
  workspaceRepoUpdate: vi.fn(),
  workspaceRepoDelete: vi.fn(),
  orgAdminsList: vi.fn(),
  orgAdminAdd: vi.fn(),
  orgAdminRemove: vi.fn(),
  workspaceAgentsList: vi.fn(),
  workspaceAgentUpsert: vi.fn(),
  workspaceAgentDelete: vi.fn(),
  workspaceContextsList: vi.fn(),
  workspaceContextUpsert: vi.fn(),
  workspaceContextDelete: vi.fn(),
}

beforeEach(() => {
  for (const fn of Object.values(covenant)) fn.mockReset()
  covenant.status.mockImplementation(() => ok({ signedIn: true, login: 'karluiz' }))
  covenant.orgsList.mockImplementation(() => ok([{ slug: 'rodrigoanti', name: 'rodrigoanti', role: 'owner' }]))
  covenant.membersList.mockImplementation(() => ok([{ login: 'karluiz', role: 'owner' }]))
  covenant.memberLoginsList.mockImplementation(() => ok(['karluiz']))
  covenant.orgAdminsList.mockImplementation(() => ok(['karluiz']))
  covenant.defaultsList.mockImplementation(() => ok([]))
  covenant.workspacesList.mockImplementation(() => ok([
    { id: 'w1', name: 'covenant', assignees: [], admins: ['karluiz'], createdBy: 'karluiz' },
  ]))
  covenant.workspaceReposList.mockImplementation(() => ok([]))
  covenant.workspaceAgentsList.mockImplementation(() => ok([]))
  covenant.workspaceContextsList.mockImplementation(() => ok([]))
  githubAccountsList.mockReset()
  githubAccountsList.mockResolvedValue({
    ok: true,
    accounts: [{ id: 'acc-1', label: 'karluiz' }],
    defaultAccountId: 'acc-1',
  })
  vi.stubGlobal('window', Object.assign(window, {
    api: { covenant, githubAccountsList, githubReposList: vi.fn().mockResolvedValue({ repos: [], truncated: false }) },
  }))
})

afterEach(cleanup)

async function openWorkspaceDetail(): Promise<void> {
  await waitFor(() => {
    expect(covenant.orgsList.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
  fireEvent.click((await screen.findAllByText('covenant'))[0])
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'organizations.openAsTab' })).toBeTruthy()
  })
}

describe('OrganizationsView — Abrir como tab', () => {
  it('pinta el botón en el detalle y al pulsarlo llama onOpenWorkspace con workspaceId y accountId', async () => {
    const onOpenWorkspace = vi.fn<(selection: OrgWorkspaceSelection) => void>()
    const onClose = vi.fn()
    render(<OrganizationsView onClose={onClose} onOpenWorkspace={onOpenWorkspace} />)

    await openWorkspaceDetail()
    fireEvent.click(screen.getByRole('button', { name: 'organizations.openAsTab' }))

    await waitFor(() => {
      expect(onOpenWorkspace).toHaveBeenCalledTimes(1)
    })
    const selection = onOpenWorkspace.mock.calls[0][0]
    expect(selection.orgWorkspace?.workspaceId).toBe('w1')
    expect(selection.accountId).toBe('acc-1')
    expect(onClose).toHaveBeenCalled()
  })

  it('si workspaceAgentsList falla no llama onOpenWorkspace y pinta el error', async () => {
    covenant.workspaceAgentsList.mockImplementation(() =>
      Promise.resolve({ ok: false as const, error: 'agents down' }),
    )
    const onOpenWorkspace = vi.fn()
    render(<OrganizationsView onClose={() => {}} onOpenWorkspace={onOpenWorkspace} />)

    await openWorkspaceDetail()
    fireEvent.click(screen.getByRole('button', { name: 'organizations.openAsTab' }))

    expect((await screen.findByRole('alert')).textContent).toBe('agents down')
    expect(onOpenWorkspace).not.toHaveBeenCalled()
  })
})
