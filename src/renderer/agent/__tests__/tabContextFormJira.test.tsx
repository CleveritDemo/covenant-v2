/** @vitest-environment jsdom */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    // Sin clave todavía, la línea de ruta no debe mostrar un archivo fantasma
    // (`.gravity/jira/issue.md`, o un stem que arrastre el nombre sugerido).
    expect(screen.queryByText(/\.gravity\/jira\//)).toBeNull()

    fireEvent.change(screen.getByLabelText('tabContexts.jiraKeyLabel', { exact: false }), {
      target: { value: 'grav-412' },
    })
    expect(saveButton.disabled).toBe(false)
    expect(screen.getByText('.gravity/jira/GRAV-412.md')).toBeTruthy()
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

  it('renombrar el contexto (campo Nombre, libre para cualquier kind) no le hace perder el subdirectorio jira/ a la ruta mostrada ni a Revelar', async () => {
    const existing: TabContext = {
      id: 'iaterminal:jira:grav-1',
      name: 'GRAV-1',
      fileName: 'jira/GRAV-1.md',
      kind: 'jira',
      issueKey: 'GRAV-1',
    }
    const revealTabContext = vi.fn().mockResolvedValue({ ok: true })
    ;(window as unknown as { api: Record<string, unknown> }).api = {
      previewTabContext,
      revealTabContext,
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
    // El botón Revelar depende de `isSaved`, que compara contra `draft.fileName`
    // para el resto de kinds — ese mismo campo que el Input de Nombre acaba de
    // reescribir sin el subdirectorio `jira/`. Si `isSaved` no lo excluyera para
    // `jira`, este botón se apagaría tras el renombrado aunque el .md siga ahí.
    const revealButton = screen.getByRole('button', { name: 'tabContexts.reveal' }) as HTMLButtonElement
    expect(revealButton.disabled).toBe(false)

    // No basta con que el botón esté habilitado: si el `onClick` sigue
    // pasando `draft.fileName` (reescrito por el rename a `Bug-de-login.md`),
    // `revealTabContext` recibe una ruta que nunca existió y el usuario ve
    // "el archivo no existe todavía" en un botón que parecía funcionar.
    fireEvent.click(revealButton)
    await waitFor(() => expect(revealTabContext).toHaveBeenCalledWith('/repo', 'jira/GRAV-1.md'))
  })

  // Sin este test, el botón podía quedar habilitado por el helper puro y el
  // camino real de Guardar (materializeTabContext, cerrar, refrescar) podía
  // seguir roto sin que ningún test lo notara — que es justo lo que pasó:
  // `materializeTabContext` para `jira` era de solo lectura y devolvía
  // `ok:false` incluso con clave válida (ver el fix en `tabContextBuild.ts`).
  it('con clave válida, Guardar llama a materializeTabContext y cierra el modal', async () => {
    const materializeTabContext = vi.fn().mockResolvedValue({ ok: true, content: '' })
    ;(window as unknown as { api: Record<string, unknown> }).api = {
      previewTabContext,
      materializeTabContext,
    }
    const onRefresh = vi.fn()
    const onClose = vi.fn()

    render(
      <TabContextFormModal
        open
        mode="create"
        context={null}
        contexts={[]}
        cwd="/repo"
        onRefresh={onRefresh}
        onClose={onClose}
      />,
    )

    fireEvent.click(screen.getByRole('radio', { name: 'tabContexts.kind_jira' }))
    fireEvent.change(screen.getByLabelText('tabContexts.jiraKeyLabel', { exact: false }), {
      target: { value: 'GRAV-412' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'tabContexts.saveContext' }))

    await waitFor(() => expect(materializeTabContext).toHaveBeenCalledTimes(1))
    const [{ context, cwd }] = materializeTabContext.mock.calls[0] as [{ context: TabContext; cwd: string }]
    expect(context.kind).toBe('jira')
    expect(context.issueKey).toBe('GRAV-412')
    expect(context.fileName).toBe('jira/GRAV-412.md')
    expect(cwd).toBe('/repo')
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })
})
