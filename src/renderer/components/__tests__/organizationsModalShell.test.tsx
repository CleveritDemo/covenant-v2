/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { OrganizationsView } from '../OrganizationsView'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  }),
}))

const ok = <T,>(data: T) => Promise.resolve({ ok: true as const, data })

const githubAccountsList = vi.fn()

/** jsdom no implementa Popover API: mismo polyfill que Select.test.tsx. */
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
  workspaceAgentsList: vi.fn(),
  workspaceAgentUpsert: vi.fn(),
  workspaceAgentDelete: vi.fn(),
  workspaceContextsList: vi.fn(),
  workspaceContextUpsert: vi.fn(),
  workspaceContextDelete: vi.fn(),
  orgAdminsList: vi.fn(),
  orgAdminAdd: vi.fn(),
  orgAdminRemove: vi.fn(),
}

beforeEach(() => {
  for (const fn of Object.values(covenant)) fn.mockReset()
  covenant.status.mockImplementation(() => ok({ signedIn: true, login: 'karluiz' }))
  covenant.orgsList.mockImplementation(() => ok([{ slug: 'rodrigoanti', name: 'rodrigoanti', role: 'owner' }]))
  covenant.membersList.mockImplementation(() => ok([
    { login: 'rodrigoanti', role: 'owner' },
    { login: 'karluiz' },
    { login: 'lenar' },
  ]))
  covenant.memberLoginsList.mockImplementation(() => ok(['rodrigoanti', 'karluiz', 'lenar']))
  covenant.orgAdminsList.mockImplementation(() => ok(['karluiz']))
  covenant.defaultsList.mockImplementation(() => ok([]))
  covenant.workspacesList.mockImplementation(() => ok([
    { id: 'w1', name: 'covenant', assignees: ['lenar'], admins: ['karluiz'], createdBy: 'karluiz' },
  ]))
  covenant.workspaceReposList.mockImplementation(() => ok([]))
  covenant.workspaceAgentsList.mockImplementation(() => ok([]))
  covenant.workspaceContextsList.mockImplementation(() => ok([]))
  githubAccountsList.mockReset()
  githubAccountsList.mockResolvedValue({ ok: true, accounts: [], defaultAccountId: '' })
  vi.stubGlobal('window', Object.assign(window, {
    api: { covenant, githubAccountsList, githubReposList: vi.fn().mockResolvedValue({ repos: [], truncated: false }) },
  }))
})

afterEach(cleanup)

describe('OrganizationsView — shell de tres columnas', () => {
  it('usa el shell fullscreen (region), no TerminalModal', async () => {
    render(<OrganizationsView onClose={() => {}} />)

    expect(screen.getByRole('region', { name: 'organizations.title' })).toBeTruthy()
    expect(document.querySelector('.organizations-view')).toBeTruthy()
    expect(document.querySelector('.terminal-modal-root')).toBeNull()
  })

  it('abre la primera org, autoselecciona el primer workspace y llena el detalle', async () => {
    render(<OrganizationsView onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rodrigoanti/ })).toBeTruthy()
    })
    expect(await screen.findByLabelText('organizations.workspacePeopleCount:2')).toBeTruthy()
    expect(document.querySelector('.person-avatar-stack')).toBeTruthy()
    expect(screen.queryByText('organizations.workspacePeopleCount:2')).toBeNull()
    expect(await screen.findByText('organizations.peopleSection')).toBeTruthy()
    expect(screen.queryByText('organizations.selectWorkspace')).toBeNull()
  })

  it('seleccionar un workspace abre Personas y Repos en pestañas del detalle', async () => {
    render(<OrganizationsView onClose={() => {}} />)

    fireEvent.click((await screen.findAllByText('covenant'))[0])

    await waitFor(() => {
      expect(screen.getByRole('radiogroup', { name: 'organizations.workspaceTabsLabel' })).toBeTruthy()
    })
    expect(screen.getByText('organizations.peopleSection')).toBeTruthy()
    // Admin y assignee conviven en una sola lista de chips, con el rol como subtítulo.
    const chips = document.querySelectorAll('.orgs-chip')
    expect([...chips].map(chip => chip.querySelector('.orgs-chip__name')?.textContent))
      .toEqual(['karluiz', 'lenar'])
    expect([...chips].map(chip => chip.querySelector('.orgs-chip__role')?.textContent))
      .toEqual(['organizations.roleAdmin', 'organizations.assignee'])

    fireEvent.click(screen.getByRole('radio', { name: 'organizations.reposTab' }))
    expect(await screen.findByText('organizations.reposEmpty')).toBeTruthy()
    expect(covenant.workspaceReposList).toHaveBeenCalled()
    expect(covenant.workspaceAgentsList).not.toHaveBeenCalled()
  })

  it('la pestaña Agentes lista los agentes del workspace', async () => {
    covenant.workspaceAgentsList.mockImplementation(() => ok([
      { agentId: 'tl', definition: { name: 'Noah', role: 'technical leader' } },
      { agentId: 'sin-nombre', definition: {} },
    ]))
    render(<OrganizationsView onClose={() => {}} />)

    fireEvent.click((await screen.findAllByText('covenant'))[0])
    fireEvent.click(screen.getByRole('radio', { name: 'organizations.agentsTab' }))

    expect(await screen.findByText('Noah')).toBeTruthy()
    expect(screen.getByText('technical leader')).toBeTruthy()
    expect(screen.getByText('sin-nombre')).toBeTruthy()
    expect(screen.getByText('organizations.orgManagedFromWorkspaceHint')).toBeTruthy()
    expect(covenant.workspaceAgentsList).toHaveBeenCalledTimes(1)
    expect(covenant.workspaceContextsList).not.toHaveBeenCalled()
  })

  it('la pestaña Contextos lista nombre y kind, y el vacío tiene su texto', async () => {
    covenant.workspaceContextsList.mockImplementation(() => ok([
      { contextId: 'front-rules', kind: 'notes', name: 'Front Rules' },
    ]))
    render(<OrganizationsView onClose={() => {}} />)

    fireEvent.click((await screen.findAllByText('covenant'))[0])
    fireEvent.click(screen.getByRole('radio', { name: 'organizations.contextsTab' }))

    expect(await screen.findByText('Front Rules')).toBeTruthy()
    expect(screen.getByText('notes')).toBeTruthy()
    expect(screen.queryByText('front-rules')).toBeNull()
    expect(covenant.workspaceContextsList).toHaveBeenCalledTimes(1)
    expect(covenant.workspaceAgentsList).not.toHaveBeenCalled()

    cleanup()
    covenant.workspaceContextsList.mockImplementation(() => ok([]))
    render(<OrganizationsView onClose={() => {}} />)
    fireEvent.click((await screen.findAllByText('covenant'))[0])
    fireEvent.click(screen.getByRole('radio', { name: 'organizations.contextsTab' }))
    expect(await screen.findByText('organizations.contextsEmpty')).toBeTruthy()
  })

  it('los ajustes de la org fusionan members y admins en una tabla con rol', async () => {
    render(<OrganizationsView onClose={() => {}} />)

    fireEvent.click(await screen.findByRole('button', { name: 'organizations.orgSettings' }))

    await waitFor(() => {
      expect(screen.getByText('organizations.membersSection')).toBeTruthy()
    })
    const members = screen.getByLabelText('organizations.membersSection')
    expect(within(members).getByText('organizations.roleOwner')).toBeTruthy()
    const roleSelects = screen.getAllByRole('button', { name: /^organizations\.roleFor:/ })
    expect(roleSelects).toHaveLength(2)
    expect(screen.getByText('organizations.dangerZone')).toBeTruthy()
  })

  it('cambiar el rol a member llama a orgAdminRemove', async () => {
    covenant.orgAdminRemove.mockImplementation(() => ok(null))
    render(<OrganizationsView onClose={() => {}} />)

    fireEvent.click(await screen.findByRole('button', { name: 'organizations.orgSettings' }))
    fireEvent.click(await screen.findByRole('button', { name: 'organizations.roleFor:karluiz' }))
    const panel = await screen.findByRole('listbox', { name: 'organizations.roleFor:karluiz' })
    fireEvent.click(within(panel).getByRole('option', { name: 'organizations.roleUser' }))

    await waitFor(() => {
      expect(covenant.orgAdminRemove).toHaveBeenCalledWith('', 'rodrigoanti', 'karluiz')
    })
  })

  it('sin sesión la vista es solo el panel de sign in', async () => {
    covenant.status.mockImplementation(() => ok({ signedIn: false }))
    render(<OrganizationsView onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('organizations.signInPrompt')).toBeTruthy()
    })
    expect(screen.queryByText('organizations.orgRailHeading')).toBeNull()
  })

  it('Escape llama onClose', () => {
    const onClose = vi.fn()
    render(<OrganizationsView onClose={onClose} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('OrganizationsView — selector de cuenta', () => {
  it('con dos cuentas muestra el selector y al cambiarlo las llamadas llevan el otro id', async () => {
    githubAccountsList.mockResolvedValue({
      ok: true,
      accounts: [
        { id: 'a1', label: 'Personal' },
        { id: 'a2', label: 'Trabajo' },
      ],
      defaultAccountId: 'a1',
    })
    render(<OrganizationsView onClose={() => {}} />)

    const trigger = await screen.findByRole('button', { name: 'organizations.accountSelector' })
    await waitFor(() => {
      expect(covenant.status).toHaveBeenCalledWith('a1')
    })

    const panel = within(document.querySelector('.orgs-col__foot') as HTMLElement).getByRole('listbox', { hidden: true })
    act(() => {
      panel.dispatchEvent(Object.assign(new Event('toggle'), { newState: 'open' }))
      panel.showPopover()
    })
    fireEvent.pointerDown(within(panel).getByRole('option', { name: 'Trabajo' }))
    fireEvent.click(within(panel).getByRole('option', { name: 'Trabajo' }))

    await waitFor(() => {
      expect(covenant.status).toHaveBeenCalledWith('a2')
    })
    expect(trigger).toBeTruthy()
  })

  it('un 403 obsoleto al cambiar de cuenta no pinta forbidden sobre la org nueva', async () => {
    githubAccountsList.mockResolvedValue({
      ok: true,
      accounts: [
        { id: 'a1', label: 'Personal' },
        { id: 'a2', label: 'Trabajo' },
      ],
      defaultAccountId: 'a1',
    })
    covenant.orgsList.mockImplementation((accountId: string) => {
      if (accountId === 'a2') return ok([{ slug: 'org-b', name: 'Org B', role: 'owner' }])
      return ok([{ slug: 'org-a', name: 'Org A', role: 'owner' }])
    })
    let resolveStaleForbidden!: (value: { ok: false; error: string }) => void
    const staleForbidden = new Promise<{ ok: false; error: string }>((resolve) => {
      resolveStaleForbidden = resolve
    })
    covenant.workspacesList.mockImplementation((accountId: string, slug: string) => {
      if (accountId === 'a2' && slug === 'org-a') return staleForbidden
      if (accountId === 'a2' && slug === 'org-b') {
        return ok([{ id: 'wb', name: 'workspace-b', assignees: [], admins: ['karluiz'], createdBy: 'karluiz' }])
      }
      return ok([{ id: 'wa', name: 'workspace-a', assignees: [], admins: ['karluiz'], createdBy: 'karluiz' }])
    })
    render(<OrganizationsView onClose={() => {}} />)

    expect(await screen.findByText('organizations.peopleSection')).toBeTruthy()
    expect(within(document.querySelector('.orgs-col--mid') as HTMLElement).getByText('workspace-a')).toBeTruthy()

    const panel = within(document.querySelector('.orgs-col__foot') as HTMLElement).getByRole('listbox', { hidden: true })
    act(() => {
      panel.dispatchEvent(Object.assign(new Event('toggle'), { newState: 'open' }))
      panel.showPopover()
    })
    fireEvent.pointerDown(within(panel).getByRole('option', { name: 'Trabajo' }))
    fireEvent.click(within(panel).getByRole('option', { name: 'Trabajo' }))

    await waitFor(() => {
      expect(within(document.querySelector('.orgs-col--mid') as HTMLElement).getByText('workspace-b')).toBeTruthy()
    })

    await act(async () => {
      resolveStaleForbidden({ ok: false, error: 'forbidden' })
    })

    expect(within(document.querySelector('.orgs-col--mid') as HTMLElement).getByText('workspace-b')).toBeTruthy()
    expect(document.querySelector('.orgs-section-error')).toBeNull()
    expect(screen.queryByText('forbidden')).toBeNull()
  })

  it('con una sola cuenta no muestra selector', async () => {
    githubAccountsList.mockResolvedValue({
      ok: true,
      accounts: [{ id: 'a1', label: 'Personal' }],
      defaultAccountId: 'a1',
    })
    render(<OrganizationsView onClose={() => {}} />)

    await waitFor(() => {
      expect(covenant.status).toHaveBeenCalled()
    })
    expect(screen.queryByRole('button', { name: 'organizations.accountSelector' })).toBeNull()
  })
})

describe('OrganizationsView — empty state y filtro', () => {
  it('sin workspaces el detalle invita a crear con el mismo compose de la columna', async () => {
    covenant.workspacesList.mockImplementation(() => ok([]))
    render(<OrganizationsView onClose={() => {}} />)

    expect(await screen.findByText('organizations.emptyWorkspacesTitle')).toBeTruthy()
    expect(screen.getByText('organizations.emptyWorkspacesHint')).toBeTruthy()
    const empty = document.querySelector('.orgs-panel-empty')
    expect(empty).toBeTruthy()
    fireEvent.click(within(empty as HTMLElement).getByRole('button', { name: 'organizations.formCreateWorkspace' }))
    expect(await screen.findByLabelText('organizations.workspaceName')).toBeTruthy()
  })

  it('con más de 6 orgs monta el filtro y un miss pinta filterNoMatch, no noOrgs', async () => {
    covenant.orgsList.mockImplementation(() => ok(
      Array.from({ length: 7 }, (_, i) => ({
        slug: `org-${i}`,
        name: `Org ${i}`,
        role: 'owner',
      })),
    ))
    render(<OrganizationsView onClose={() => {}} />)

    const filter = await screen.findByRole('searchbox', { name: 'organizations.filterOrgs' })
    fireEvent.change(filter, { target: { value: 'zzz-no-match' } })
    expect(await screen.findByText('organizations.filterNoMatch')).toBeTruthy()
    expect(screen.queryByText('organizations.noOrgs')).toBeNull()
  })
})
