/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PlaneContextPool, type PlaneContextPoolProps } from '../PlaneContextPool'

afterEach(() => {
  cleanup()
  // El clon del dragstart se borra en un setTimeout que el test no deja correr.
  document.querySelectorAll('.plane-context-pool__chip--ghost').forEach(el => el.remove())
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
      contexts={[
        { id: 'tree', name: 'Estructura', kind: 'folderTree', kindLabel: 'Árbol', icon: 'folder', color: '#0aa' },
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

describe('PlaneContextPool — asignación por clic', () => {
  it('el chip es solo ícono; el nombre aparece al abrir el popover', () => {
    setup()
    const chip = screen.getByRole('button', { name: /Estructura/ })
    expect(chip.querySelector('.plane-context-pool__chip-name')).toBeNull()
    expect(chip.textContent).toContain('1')
    fireEvent.click(chip)
    const dialog = screen.getByRole('dialog', { name: 'Asignar a agentes' })
    expect(dialog.textContent).toContain('Estructura')
  })

  it('el clic abre el popover con los agentes del plano y su estado', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /Estructura/ }))
    expect(screen.getByRole('dialog', { name: 'Asignar a agentes' })).toBeTruthy()
    const [atlas, forja] = screen.getAllByRole('option')
    expect(atlas.getAttribute('aria-selected')).toBe('true')
    expect(forja.getAttribute('aria-selected')).toBe('false')
    // El contador de la cabecera resume el reparto.
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

  it('editar sigue disponible desde el pie del popover', () => {
    const { onOpenContext } = setup()
    fireEvent.click(screen.getByRole('button', { name: /Estructura/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    expect(onOpenContext).toHaveBeenCalledWith('tree')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Escape cierra el popover', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /Estructura/ }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('sin agentes en el plano el popover explica qué falta', () => {
    setup({ agents: [] })
    fireEvent.click(screen.getByRole('button', { name: /Estructura/ }))
    expect(screen.getByText('Crea un agente')).toBeTruthy()
  })

  it('arrastrar no abre el popover', () => {
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
