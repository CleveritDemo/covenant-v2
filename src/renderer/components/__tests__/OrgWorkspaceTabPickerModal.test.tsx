/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { CovenantApi } from '../../covenantApi'
import type { OrgWorkspaceCatalogEntry } from '../../../shared/orgWorkspaceCatalog'
import { OrgWorkspaceTabPickerModal } from '../OrgWorkspaceTabPickerModal'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('../TerminalModal', () => ({
  TerminalModal: ({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) => (
    <div>{children}<div>{footer}</div></div>
  ),
}))

const getCovenantApi = vi.fn<(accountId?: string) => CovenantApi | undefined>()

vi.mock('../../covenantApi', async importOriginal => {
  const actual = await importOriginal<typeof import('../../covenantApi')>()
  return {
    ...actual,
    getCovenantApi: (accountId?: string) => getCovenantApi(accountId),
  }
})

const catalog: OrgWorkspaceCatalogEntry[] = [
  { slug: 'acme', orgName: 'Acme', workspaceId: 'ws-1', name: 'Atlas', canRename: true },
]

function stubApi(overrides: Partial<CovenantApi> = {}): CovenantApi {
  const noop = vi.fn().mockResolvedValue({ ok: true, data: [] })
  return {
    status: vi.fn().mockResolvedValue({ ok: true, data: { signedIn: false } }),
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

function renderModal(
  api: CovenantApi | undefined,
  overrides: Partial<React.ComponentProps<typeof OrgWorkspaceTabPickerModal>> = {},
) {
  getCovenantApi.mockReset()
  getCovenantApi.mockReturnValue(api)
  const onConfirm = vi.fn()
  const onClose = vi.fn()
  render(
    <OrgWorkspaceTabPickerModal
      open
      catalog={catalog}
      accountId="acc-bound"
      onClose={onClose}
      onConfirm={onConfirm}
      {...overrides}
    />,
  )
  return { onConfirm, onClose }
}

beforeEach(() => {
  getCovenantApi.mockReset()
})

afterEach(cleanup)

describe('OrgWorkspaceTabPickerModal signed-out gate', () => {
  it('oculta el catálogo de org y muestra el copy localizado si la cuenta no tiene sesión', async () => {
    renderModal(stubApi())
    await waitFor(() => {
      expect(screen.getByText('organizations.newTabWorkspaceSignedOut')).toBeTruthy()
    })
    expect(screen.queryByText('Atlas')).toBeNull()
    expect(screen.queryByText('Acme')).toBeNull()
    expect(screen.getByText('organizations.newTabWorkspacePersonal')).toBeTruthy()
  })

  it('fuerza Personal y deja Create tab habilitado sin pegarle a la red', async () => {
    let resolveStatus!: (value: { ok: true; data: { signedIn: boolean } }) => void
    const statusPromise = new Promise<{ ok: true; data: { signedIn: boolean } }>(resolve => {
      resolveStatus = resolve
    })
    const api = stubApi({
      status: vi.fn().mockReturnValue(statusPromise),
    })
    const { onConfirm } = renderModal(api)
    fireEvent.click(screen.getByRole('button', { name: /Atlas/ }))
    expect(screen.getByRole('button', { name: /Atlas/ }).getAttribute('aria-current')).toBe('true')
    await act(async () => {
      resolveStatus({ ok: true, data: { signedIn: false } })
    })
    await waitFor(() => {
      expect(screen.getByText('organizations.newTabWorkspaceSignedOut')).toBeTruthy()
    })
    expect(screen.queryByRole('button', { name: /Atlas/ })).toBeNull()
    expect(
      screen.getByRole('button', { name: /organizations.newTabWorkspacePersonal/ }).getAttribute('aria-current'),
    ).toBe('true')
    const confirm = screen.getByRole('button', { name: 'organizations.newTabWorkspaceConfirm' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(false)
    fireEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledWith({ agents: [], contexts: [], catalogKey: '' })
    expect(api.workspaceAgentsList).not.toHaveBeenCalled()
  })

  it('mapea el 401 Not signed in al copy localizado y deja otros errores crudos', async () => {
    const signedIn = stubApi({
      status: vi.fn().mockResolvedValue({ ok: true, data: { signedIn: true, login: 'alice' } }),
      orgsList: vi.fn().mockResolvedValue({
        ok: true,
        data: [{ slug: 'acme', name: 'Acme', role: 'owner' }],
      }),
      workspacesList: vi.fn().mockResolvedValue({
        ok: true,
        data: [{
          id: 'ws-1',
          name: 'Atlas',
          createdAt: 1,
          admins: [],
          assignees: [],
          createdBy: 'alice',
        }],
      }),
      workspaceAgentsList: vi.fn().mockResolvedValue({ ok: false, error: 'Not signed in' }),
      workspaceContextsList: vi.fn().mockResolvedValue({ ok: true, data: [] }),
    })
    renderModal(signedIn)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Atlas/ })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: /Atlas/ }))
    fireEvent.click(screen.getByRole('button', { name: 'organizations.newTabWorkspaceConfirm' }))
    expect(await screen.findByText('organizations.newTabWorkspaceSignedOut')).toBeTruthy()
    expect(screen.queryByText('Not signed in')).toBeNull()

    cleanup()
    const otherError = stubApi({
      status: vi.fn().mockResolvedValue({ ok: true, data: { signedIn: true, login: 'alice' } }),
      orgsList: vi.fn().mockResolvedValue({
        ok: true,
        data: [{ slug: 'acme', name: 'Acme', role: 'owner' }],
      }),
      workspacesList: vi.fn().mockResolvedValue({
        ok: true,
        data: [{
          id: 'ws-1',
          name: 'Atlas',
          createdAt: 1,
          admins: [],
          assignees: [],
          createdBy: 'alice',
        }],
      }),
      workspaceAgentsList: vi.fn().mockResolvedValue({ ok: false, error: 'workspace down' }),
      workspaceContextsList: vi.fn().mockResolvedValue({ ok: true, data: [] }),
    })
    renderModal(otherError)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Atlas/ })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: /Atlas/ }))
    fireEvent.click(screen.getByRole('button', { name: 'organizations.newTabWorkspaceConfirm' }))
    expect(await screen.findByText('workspace down')).toBeTruthy()
  })

  it('no toca accountSignedIn si no hay API y sigue pintando el catálogo', async () => {
    renderModal(undefined)
    expect(screen.getByText('Atlas')).toBeTruthy()
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByText('Atlas')).toBeTruthy()
    expect(screen.queryByText('organizations.newTabWorkspaceSignedOut')).toBeNull()
  })
})
