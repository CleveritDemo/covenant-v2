/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PlaneContextPool, type PlaneContextPoolProps } from '../PlaneContextPool'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

afterEach(() => {
  cleanup()
  document.querySelectorAll('.plane-context-pool__chip--ghost').forEach(el => el.remove())
  vi.unstubAllGlobals()
})

beforeEach(() => {
  Object.assign(window, {
    api: {
      previewTabContext: vi.fn().mockResolvedValue({
        ok: true,
        content: 'preview body',
        filePath: '/tmp/.gravity/tree.md',
      }),
      listProjectAgents: vi.fn().mockResolvedValue([]),
    },
  })
})

/** jsdom no trae DataTransfer; solo hace falta lo que usa el dragstart. */
const dragTransfer = () => ({
  setData: vi.fn(),
  setDragImage: vi.fn(),
  effectAllowed: '',
})

function setup(overrides: Partial<PlaneContextPoolProps> = {}) {
  const onToggleAssign = vi.fn()
  const onOpenContext = vi.fn()
  render(
    <PlaneContextPool
      title="Contextos"
      configureLabel="Administrar"
      createLabel="Nuevo"
      assignLabel="Asignar a agentes"
      assignEmptyHint="Crea un agente"
      assignedCountLabel={n => `Asignado a ${n}`}
      editLabel="Editar"
      cwd="/tmp/project"
      contexts={[
        { id: 'tree', name: 'Estructura', kind: 'folderTree', kindLabel: 'Árbol', icon: 'folder', color: '#0aa' },
      ]}
      contextCatalog={[
        { id: 'tree', name: 'Estructura', fileName: 'tree.md', kind: 'folderTree' },
      ]}
      agents={[
        { paneId: 'p1', title: 'Atlas', contextIds: ['tree'] },
        { paneId: 'p2', title: 'Forja', contextIds: [] },
      ]}
      onConfigure={vi.fn()}
      onCreate={vi.fn()}
      onOpenContext={onOpenContext}
      onToggleAssign={onToggleAssign}
      {...overrides}
    />,
  )
  return { onToggleAssign, onOpenContext }
}

describe('PlaneContextPool — asignación por modal', () => {
  it('el chip es solo ícono; el nombre aparece en el modal', () => {
    setup()
    const chip = screen.getByRole('button', { name: /Estructura/ })
    expect(chip.querySelector('.plane-context-pool__chip-name')).toBeNull()
    fireEvent.click(chip)
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('Estructura')
    expect(document.querySelector('.plane-context-pool__pop')).toBeNull()
  })

  it('el clic abre el modal con los agentes del plano y su estado', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /Estructura/ }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    const [atlas, forja] = screen.getAllByRole('option')
    expect(atlas.getAttribute('aria-selected')).toBe('true')
    expect(forja.getAttribute('aria-selected')).toBe('false')
    expect(screen.getByRole('dialog').textContent).toContain('1/2')
  })

  it('marcar un agente lo asigna y desmarcar lo quita', () => {
    const { onToggleAssign } = setup()
    fireEvent.click(screen.getByRole('button', { name: /Estructura/ }))
    const [atlas, forja] = screen.getAllByRole('option')
    fireEvent.click(forja)
    fireEvent.click(atlas)
    expect(onToggleAssign.mock.calls).toEqual([['p2', 'tree'], ['p1', 'tree']])
  })

  it('editar cierra el modal y abre el flujo de edición', () => {
    const { onOpenContext } = setup()
    fireEvent.click(screen.getByRole('button', { name: /Estructura/ }))
    fireEvent.click(screen.getByRole('button', { name: /Editar/ }))
    expect(onOpenContext).toHaveBeenCalledWith('tree')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Escape cierra el modal', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /Estructura/ }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('sin agentes en el plano el modal explica qué falta', () => {
    setup({ agents: [] })
    fireEvent.click(screen.getByRole('button', { name: /Estructura/ }))
    expect(screen.getByText('Crea un agente')).toBeTruthy()
  })

  it('arrastrar no abre el modal', () => {
    setup()
    const chip = screen.getByRole('button', { name: /Estructura/ })
    fireEvent.dragStart(chip, { dataTransfer: dragTransfer() })
    fireEvent.click(chip)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('el fantasma del arrastre es un clon colgado del body, no el chip in situ', () => {
    setup()
    const chip = screen.getByRole('button', { name: /Estructura/ })
    const transfer = dragTransfer()
    fireEvent.dragStart(chip, { dataTransfer: transfer })
    const [ghost] = transfer.setDragImage.mock.calls[0] as [HTMLElement]
    expect(ghost.parentElement).toBe(document.body)
    expect(ghost.classList.contains('plane-context-pool__chip--ghost')).toBe(true)
  })
})
