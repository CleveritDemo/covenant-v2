/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor, within } from '@testing-library/react'
import { OrganizationsView } from '../OrganizationsView'

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
  covenant.orgsList.mockImplementation(() => ok([
    { slug: 'me', name: 'My space', role: 'owner', personal: true },
    { slug: 'acme', name: 'Acme', role: 'owner', personal: false },
  ]))
  covenant.membersList.mockImplementation(() => ok([{ login: 'karluiz', role: 'owner' }]))
  covenant.memberLoginsList.mockImplementation(() => ok(['karluiz']))
  covenant.orgAdminsList.mockImplementation(() => ok(['karluiz']))
  covenant.defaultsList.mockImplementation(() => ok([]))
  covenant.workspacesList.mockImplementation(() => ok([
    { id: 'w1', name: 'covenant', assignees: ['ana'], admins: ['bob'], createdBy: 'karluiz' },
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

function workspaceNav(container: HTMLElement): HTMLElement {
  const nav = container.querySelector('.orgs-col--mid .orgs-nav')
  if (!(nav instanceof HTMLElement)) throw new Error('workspace nav missing')
  return nav
}

describe('OrganizationsView — filas de org y workspace', () => {
  it('fila personal: icono user, hint y sin badge de rol', async () => {
    const { container } = render(<OrganizationsView onClose={() => {}} />)
    let personalAvatar: Element | null = null
    await waitFor(() => {
      personalAvatar = container.querySelector('.orgs-nav__avatar--personal')
      expect(personalAvatar).toBeTruthy()
    })
    const personal = personalAvatar!.closest('button')
    expect(personal).toBeTruthy()
    expect(personal?.querySelector('.orgs-nav__avatar--personal')).toBeTruthy()
    expect(personal?.querySelector('svg')).toBeTruthy()
    expect(within(personal!).getByText('organizations.personalOrgHint')).toBeTruthy()
    expect(within(personal!).queryByText('organizations.roleOwner')).toBeNull()
    expect(within(personal!).queryByText('organizations.roleAdmin')).toBeNull()
    expect(within(personal!).queryByText('organizations.roleMember')).toBeNull()
  })

  it('fila con role owner pinta el badge de owner', async () => {
    const { container } = render(<OrganizationsView onClose={() => {}} />)
    let owner: HTMLElement | null = null
    await waitFor(() => {
      const title = within(container).queryByText('Acme')
      owner = title?.closest('button') ?? null
      expect(owner).toBeTruthy()
    })
    expect(within(owner!).getByText('organizations.roleOwner')).toBeTruthy()
    expect(owner?.querySelector('.badge--accent')).toBeTruthy()
  })

  it('fila de workspace con 2 personas pinta la pila y no el texto del contador', async () => {
    const { container } = render(<OrganizationsView onClose={() => {}} />)
    let row: Element | null = null
    await waitFor(() => {
      row = workspaceNav(container).querySelector('.orgs-nav__item')
      expect(row?.querySelector('.person-avatar-stack')).toBeTruthy()
    })
    expect(row).toBeTruthy()
    expect(row!.querySelectorAll('.person-avatar-stack__face')).toHaveLength(2)
    expect(within(row as HTMLElement).queryByText('organizations.workspacePeopleCount:2')).toBeNull()
    expect(within(row as HTMLElement).getByLabelText('organizations.workspacePeopleCount:2')).toBeTruthy()
  })
})
