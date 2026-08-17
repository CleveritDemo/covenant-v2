/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PromoteWorkspaceModal } from '../PromoteWorkspaceModal'

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

afterEach(cleanup)

const orgs = [{ slug: 'acme', name: 'Acme' }]
const repos = [
  { path: '/tmp/proj/api', name: 'api', repoFullName: 'acme/api', hasRemote: true },
  { path: '/tmp/proj/local', name: 'local', repoFullName: '', hasRemote: false },
]

function renderModal(
  overrides: Partial<React.ComponentProps<typeof PromoteWorkspaceModal>> = {},
) {
  const onConfirm = vi.fn()
  const onClose = vi.fn()
  render(
    <PromoteWorkspaceModal
      open
      folderPath="/tmp/my-workspace"
      orgs={orgs}
      repos={repos}
      busy={false}
      onClose={onClose}
      onConfirm={onConfirm}
      {...overrides}
    />,
  )
  return { onConfirm, onClose }
}

describe('PromoteWorkspaceModal', () => {
  it('prefija el nombre con el último segmento de la carpeta', () => {
    renderModal()
    const input = screen.getByLabelText('organizations.promoteNameLabel') as HTMLInputElement
    expect(input.value).toBe('my-workspace')
  })

  it('deshabilita Publicar si el nombre queda vacío', () => {
    renderModal()
    const input = screen.getByLabelText('organizations.promoteNameLabel') as HTMLInputElement
    fireEvent.change(input, { target: { value: '   ' } })
    expect(
      (screen.getByRole('button', { name: 'organizations.promoteConfirm' }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })

  it('marca los repos con remoto y deja sin remoto deshabilitados', () => {
    renderModal()
    const withRemote = screen.getByRole('option', { name: 'api' }) as HTMLInputElement
    const withoutRemote = screen.getByRole('option', { name: 'organizations.promoteRepoNoRemote' }) as HTMLInputElement
    expect(withRemote.checked).toBe(true)
    expect(withoutRemote.checked).toBe(false)
    expect(withoutRemote.disabled).toBe(true)
  })

  it('confirma org, nombre y paths marcados', () => {
    const { onConfirm } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'organizations.promoteConfirm' }))
    expect(onConfirm).toHaveBeenCalledWith({
      orgSlug: 'acme',
      workspaceName: 'my-workspace',
      repoPaths: ['/tmp/proj/api'],
    })
  })

  it('deshabilita Publicar sin organización elegida', () => {
    renderModal({ orgs: [{ slug: 'acme', name: 'Acme' }, { slug: 'beta', name: 'Beta' }] })
    expect(
      (screen.getByRole('button', { name: 'organizations.promoteConfirm' }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })
})
