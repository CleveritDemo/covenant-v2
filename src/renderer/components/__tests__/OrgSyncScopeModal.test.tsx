/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { OrgSyncScopeModal } from '../OrgSyncScopeModal'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, vars?: Record<string, number>) => {
      if (key === 'organizations.uploadDeleteWarning' && vars) {
        return `delete:${vars.contexts}:${vars.agents}`
      }
      return key
    },
  }),
}))

vi.mock('../TerminalModal', () => ({
  TerminalModal: ({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) => (
    <div>{children}<div>{footer}</div></div>
  ),
}))

vi.mock('../ui', async importOriginal => {
  const actual = await importOriginal<typeof import('../ui')>()
  return {
    ...actual,
    Skeleton: () => <div data-testid="upload-plan-skeleton" />,
  }
})

afterEach(cleanup)

const deletePlan = {
  agentIdsToDelete: ['a1', 'a2'],
  contextIdsToDelete: ['c1', 'c2', 'c3'],
}

function renderUploadModal(
  overrides: Partial<React.ComponentProps<typeof OrgSyncScopeModal>> = {},
) {
  const onConfirm = vi.fn()
  const onClose = vi.fn()
  render(
    <OrgSyncScopeModal
      open
      mode="upload"
      onClose={onClose}
      onConfirm={onConfirm}
      {...overrides}
    />,
  )
  return { onConfirm, onClose }
}

describe('OrgSyncScopeModal upload mode', () => {
  it('con planLoading pinta skeleton y no el aviso', () => {
    renderUploadModal({ planLoading: true, plan: deletePlan })
    expect(screen.getByTestId('upload-plan-skeleton')).toBeTruthy()
    expect(screen.queryByText('delete:3:2')).toBeNull()
    expect(screen.queryByText('organizations.uploadDeleteNone')).toBeNull()
  })

  it('con plan y alcance all muestra ambos conteos', () => {
    renderUploadModal({ plan: deletePlan })
    expect(screen.getByText('delete:3:2')).toBeTruthy()
  })

  it('al cambiar a contexts los agentes bajan a 0', () => {
    renderUploadModal({ plan: deletePlan })
    fireEvent.click(screen.getByText('organizations.uploadScopeContextsTitle'))
    expect(screen.getByText('delete:3:0')).toBeTruthy()
  })

  it('sin borrados muestra uploadDeleteNone', () => {
    renderUploadModal({
      plan: { agentIdsToDelete: [], contextIdsToDelete: [] },
    })
    expect(screen.getByText('organizations.uploadDeleteNone')).toBeTruthy()
    expect(screen.queryByText(/^delete:/)).toBeNull()
  })
})
