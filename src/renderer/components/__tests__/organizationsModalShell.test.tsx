/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { OrganizationsView } from '../OrganizationsView'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  }),
}))

const ok = <T,>(data: T) => Promise.resolve({ ok: true as const, data })

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
  vi.stubGlobal('window', Object.assign(window, { api: { covenant } }))
})

afterEach(cleanup)

describe('OrganizationsView — shell de tres columnas', () => {
  it('usa el shell fullscreen (region), no TerminalModal', async () => {
    render(<OrganizationsView onClose={() => {}} />)

    expect(screen.getByRole('region', { name: 'organizations.title' })).toBeTruthy()
    expect(document.querySelector('.organizations-view')).toBeTruthy()
    expect(document.querySelector('.terminal-modal-root')).toBeNull()
  })

  it('abre la primera org y muestra rail, workspaces y la invitación a elegir uno', async () => {
    render(<OrganizationsView onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rodrigoanti/ })).toBeTruthy()
    })
    // La columna 2 lista los workspaces sin necesidad de expandir un acordeón.
    expect(await screen.findByText('covenant')).toBeTruthy()
    expect(screen.getByText('organizations.workspacePeopleCount:2')).toBeTruthy()
    expect(screen.getByText('organizations.selectWorkspace')).toBeTruthy()
  })

  it('seleccionar un workspace abre People y Repos en la tercera columna', async () => {
    render(<OrganizationsView onClose={() => {}} />)

    fireEvent.click(await screen.findByText('covenant'))

    await waitFor(() => {
      expect(screen.getByText('organizations.peopleSection')).toBeTruthy()
    })
    expect(screen.getByText('organizations.reposTab')).toBeTruthy()
    // Admin y assignee conviven en una sola lista de chips, con el rol como subtítulo.
    const chips = document.querySelectorAll('.orgs-chip')
    expect([...chips].map(chip => chip.querySelector('.orgs-chip__name')?.textContent))
      .toEqual(['karluiz', 'lenar'])
    expect([...chips].map(chip => chip.querySelector('.orgs-chip__role')?.textContent))
      .toEqual(['organizations.roleAdmin', 'organizations.assignee'])
    expect(screen.getByText('organizations.reposEmpty')).toBeTruthy()
  })

  it('los ajustes de la org fusionan members y admins en una tabla con rol', async () => {
    render(<OrganizationsView onClose={() => {}} />)

    fireEvent.click(await screen.findByRole('button', { name: 'organizations.orgSettings' }))

    await waitFor(() => {
      expect(screen.getByText('organizations.membersSection')).toBeTruthy()
    })
    // El owner no es asignable: se pinta como texto, no como select.
    expect(screen.getByText('organizations.roleOwner')).toBeTruthy()
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
      expect(covenant.orgAdminRemove).toHaveBeenCalledWith('rodrigoanti', 'karluiz')
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
