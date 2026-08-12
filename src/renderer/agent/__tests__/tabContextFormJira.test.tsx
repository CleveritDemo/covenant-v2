/** @vitest-environment jsdom */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { TabContext } from '@shared/tabContext'
import { jiraDraftFromKey, TabContextFormModal } from '../TabContextFormModal'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

// El pie con Guardar/Descartar vive en TabContextFormModal; TerminalModal solo
// aporta el chrome (traffic lights, portal, foco atrapado) que no hace falta
// para probar el bloqueo del guardado. Mismo patrón que
// `workspace/__tests__/BrainstormEditRoomModal.test.tsx`.
vi.mock('../../components/TerminalModal', () => ({
  TerminalModal: ({
    open,
    children,
    footer,
  }: {
    open: boolean
    children: React.ReactNode
    footer?: React.ReactNode
  }) => (open ? <div>{children}<div>{footer}</div></div> : null),
}))

const previewTabContext = vi.fn()

beforeEach(() => {
  previewTabContext.mockReset().mockResolvedValue({ ok: true, content: '' })
  ;(window as unknown as { api: Record<string, unknown> }).api = { previewTabContext }
})

afterEach(cleanup)

describe('jiraDraftFromKey', () => {
  it('deriva id, archivo y nombre de la clave', () => {
    expect(jiraDraftFromKey('grav-412')).toEqual({
      id: 'iaterminal:jira:grav-412',
      name: 'GRAV-412',
      fileName: 'jira/GRAV-412.md',
      kind: 'jira',
      issueKey: 'GRAV-412',
    })
  })

  it('una clave inválida devuelve null: sin clave no hay contexto que refrescar', () => {
    expect(jiraDraftFromKey('no soy una clave')).toBeNull()
    expect(jiraDraftFromKey('')).toBeNull()
  })
})

// El helper puro ya prueba la derivación; estos dos casos cubren la parte que
// importa de verdad — que Guardar quede bloqueado en la UI, no solo que el
// helper devuelva null. Ver el hallazgo heredado de la tarea 5 en el reporte.
describe('TabContextFormModal — alta de jira', () => {
  it('al crear: sin clave Guardar está deshabilitado; con una clave válida se habilita', () => {
    render(
      <TabContextFormModal
        open
        mode="create"
        context={null}
        contexts={[]}
        cwd="/repo"
        onRefresh={() => {}}
        onClose={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('radio', { name: 'tabContexts.kind_jira' }))
    const saveButton = screen.getByRole('button', { name: 'tabContexts.saveContext' }) as HTMLButtonElement
    expect(saveButton.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('tabContexts.jiraKeyLabel', { exact: false }), {
      target: { value: 'grav-412' },
    })
    expect(saveButton.disabled).toBe(false)
  })

  it('al editar: volver a escribir una clave inválida bloquea Guardar aunque el draft ya tuviera una clave válida', () => {
    const existing: TabContext = {
      id: 'iaterminal:jira:grav-1',
      name: 'GRAV-1',
      fileName: 'jira/GRAV-1.md',
      kind: 'jira',
      issueKey: 'GRAV-1',
    }
    render(
      <TabContextFormModal
        open
        mode="edit"
        context={existing}
        contexts={[existing]}
        cwd="/repo"
        onRefresh={() => {}}
        onClose={() => {}}
      />,
    )

    const saveButton = screen.getByRole('button', { name: 'tabContexts.saveContext' }) as HTMLButtonElement
    expect(saveButton.disabled).toBe(false)

    const keyInput = screen.getByLabelText('tabContexts.jiraKeyLabel', { exact: false })
    fireEvent.change(keyInput, { target: { value: 'no soy una clave' } })
    expect(saveButton.disabled).toBe(true)

    fireEvent.change(keyInput, { target: { value: 'GRAV-2' } })
    expect(saveButton.disabled).toBe(false)
  })

  it('renombrar el contexto (campo Nombre, libre para cualquier kind) no le hace perder el subdirectorio jira/ a la ruta mostrada', () => {
    const existing: TabContext = {
      id: 'iaterminal:jira:grav-1',
      name: 'GRAV-1',
      fileName: 'jira/GRAV-1.md',
      kind: 'jira',
      issueKey: 'GRAV-1',
    }
    render(
      <TabContextFormModal
        open
        mode="edit"
        context={existing}
        contexts={[existing]}
        cwd="/repo"
        onRefresh={() => {}}
        onClose={() => {}}
      />,
    )

    fireEvent.change(screen.getByLabelText('tabContexts.name'), { target: { value: 'Bug de login' } })
    expect(screen.getByText(/\.gravity\/jira\/GRAV-1\.md$/)).toBeTruthy()
  })
})
