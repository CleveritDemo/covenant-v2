/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PlaneContextPool, type PlaneContextPoolProps } from '../PlaneContextPool'
import { PLANE_CONTEXT_DRAG_MIME } from '../planeContextDrag'

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

/** jsdom no trae DataTransfer; solo hace falta lo que usa el dragstart/drop. */
const dragTransfer = (contextId = 'tree') => {
  const store = new Map<string, string>()
  return {
    types: [PLANE_CONTEXT_DRAG_MIME, 'text/plain'],
    setData: vi.fn((type: string, value: string) => { store.set(type, value) }),
    getData: vi.fn((type: string) => store.get(type) ?? (type === 'text/plain' ? contextId : '')),
    setDragImage: vi.fn(),
    effectAllowed: '' as string,
    dropEffect: '' as string,
  }
}

function setup(overrides: Partial<PlaneContextPoolProps> = {}) {
  const onToggleAssign = vi.fn()
  const onOpenContext = vi.fn()
  const onDeleteContext = vi.fn()
  render(
    <PlaneContextPool
      title="Contextos"
      configureLabel="Administrar"
      createLabel="Nuevo"
      assignLabel="Asignar a agentes"
      assignEmptyHint="Crea un agente"
      assignedCountLabel={n => `Asignado a ${n}`}
      editLabel="Editar"
      deleteLabel="Eliminar"
      deleteConfirmMessage={name => `¿Eliminar «${name}»?`}
      deleteConfirmDetail="Se quitará del catálogo."
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
      onDeleteContext={onDeleteContext}
      onToggleAssign={onToggleAssign}
      {...overrides}
    />,
  )
  return { onToggleAssign, onOpenContext, onDeleteContext }
}

const chipButton = () => screen.getByRole('button', { name: /Estructura/ })

const openChipMenu = () => {
  fireEvent.contextMenu(chipButton())
  return screen.getByRole('menu')
}

const openAssignModal = () => {
  fireEvent.click(chipButton())
}

describe('PlaneContextPool — asignación por modal', () => {
  it('el clic en chip abre el modal de asignación, no el menú contextual', () => {
    setup()
    expect(chipButton().querySelector('.plane-context-pool__chip-name')).toBeNull()
    openAssignModal()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('segundo clic en el mismo chip cierra el modal', () => {
    setup()
    openAssignModal()
    fireEvent.click(chipButton())
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('el chip es solo ícono; el nombre aparece en el modal', () => {
    setup()
    openAssignModal()
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('Estructura')
    expect(document.querySelector('.plane-context-pool__pop')).toBeNull()
  })

  it('clic abre el modal con los agentes del plano y su estado', () => {
    setup()
    openAssignModal()
    expect(screen.getByRole('dialog')).toBeTruthy()
    const [atlas, forja] = screen.getAllByRole('option')
    expect(atlas.getAttribute('aria-selected')).toBe('true')
    expect(forja.getAttribute('aria-selected')).toBe('false')
    expect(screen.getByRole('dialog').textContent).toContain('1/2')
  })

  it('marcar un agente lo asigna y desmarcar lo quita', () => {
    const { onToggleAssign } = setup()
    openAssignModal()
    const [atlas, forja] = screen.getAllByRole('option')
    fireEvent.click(forja)
    fireEvent.click(atlas)
    expect(onToggleAssign.mock.calls).toEqual([['p2', 'tree'], ['p1', 'tree']])
  })

  it('clic derecho → editar llama onOpenContext', () => {
    const { onOpenContext } = setup()
    openChipMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: /Editar/ }))
    expect(onOpenContext).toHaveBeenCalledWith('tree')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('clic derecho → eliminar confirma y llama onDelete(contextId)', () => {
    const { onDeleteContext } = setup()
    openChipMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: /Eliminar/ }))
    expect(screen.getByText('¿Eliminar «Estructura»?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'ui.confirmOk' }))
    expect(onDeleteContext).toHaveBeenCalledWith('tree')
  })

  it('clic derecho → eliminar y cancelar no llama onDelete', () => {
    const { onDeleteContext } = setup()
    openChipMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: /Eliminar/ }))
    fireEvent.click(screen.getByRole('button', { name: 'ui.confirmNo' }))
    expect(onDeleteContext).not.toHaveBeenCalled()
  })

  it('Escape cierra el modal', () => {
    setup()
    openAssignModal()
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('sin agentes en el plano el modal explica qué falta', () => {
    setup({ agents: [] })
    openAssignModal()
    expect(screen.getByText('Crea un agente')).toBeTruthy()
  })

  it('arrastrar no abre el modal ni el menú', () => {
    setup()
    const chip = chipButton()
    fireEvent.mouseDown(chip, { button: 0 })
    fireEvent.dragStart(chip, { dataTransfer: dragTransfer() })
    fireEvent.click(chip)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('el fantasma del arrastre es un clon colgado del body, no el chip in situ', () => {
    setup()
    const chip = chipButton()
    const transfer = dragTransfer()
    fireEvent.mouseDown(chip, { button: 0 })
    fireEvent.dragStart(chip, { dataTransfer: transfer })
    const [ghost] = transfer.setDragImage.mock.calls[0] as [HTMLElement]
    expect(ghost.parentElement).toBe(document.body)
    expect(ghost.classList.contains('plane-context-pool__chip--ghost')).toBe(true)
  })
})

/** Catálogo grande: 9 contextos, ninguno asignado salvo el que se indique. */
const bigCatalog = (assignedTo: string[] = []) => ({
  contexts: Array.from({ length: 9 }, (_, i) => ({
    id: `c${i}`,
    name: `Contexto ${i}`,
    kind: 'notes' as const,
    kindLabel: 'Notas',
    icon: 'note' as const,
    color: '#0aa',
  })),
  contextCatalog: Array.from({ length: 9 }, (_, i) => ({
    id: `c${i}`,
    name: `Contexto ${i}`,
    fileName: `c${i}.md`,
    kind: 'notes' as const,
  })),
  agents: [{ paneId: 'p1', title: 'Atlas', contextIds: assignedTo }],
})

const poolRoot = () => document.querySelector('.plane-context-pool-shell')
const glassBar = () => document.querySelector('.plane-context-pool')
const poolChips = () =>
  Array.from(document.querySelectorAll('.plane-context-pool__chip:not(.plane-context-pool__chip--ghost)'))

describe('PlaneContextPool — shell y botones externos', () => {
  it('configure y create quedan fuera de la barra glass', () => {
    setup()
    const bar = glassBar()!
    const configure = screen.getByLabelText('Administrar')
    const create = screen.getByLabelText('Nuevo')
    expect(bar.contains(configure)).toBe(false)
    expect(bar.contains(create)).toBe(false)
  })

  it('orden visual: barra glass, configure, create', () => {
    setup()
    const shell = poolRoot()!
    const children = Array.from(shell.children)
    const barIdx = children.findIndex(el => el.classList.contains('plane-context-pool'))
    const configureIdx = children.findIndex(el => el.contains(screen.getByLabelText('Administrar')))
    const createIdx = children.findIndex(el => el.contains(screen.getByLabelText('Nuevo')))
    expect(barIdx).toBeLessThan(configureIdx)
    expect(configureIdx).toBeLessThan(createIdx)
  })

  it('sin contextos no renderiza la barra glass', () => {
    setup({ contexts: [], contextCatalog: [] })
    expect(glassBar()).toBeNull()
    expect(screen.getByLabelText('Administrar')).toBeTruthy()
    expect(screen.getByLabelText('Nuevo')).toBeTruthy()
    const shell = poolRoot()!
    const children = Array.from(shell.children)
    const configureIdx = children.findIndex(el => el.contains(screen.getByLabelText('Administrar')))
    const createIdx = children.findIndex(el => el.contains(screen.getByLabelText('Nuevo')))
    expect(configureIdx).toBeLessThan(createIdx)
  })
})

describe('PlaneContextPool — barra vertical', () => {
  it('lista todos los contextos sin recortar ni badge +N', () => {
    setup(bigCatalog())
    expect(poolChips()).toHaveLength(9)
    expect(document.querySelector('.plane-context-pool__overflow-badge')).toBeNull()
    expect(screen.getByRole('button', { name: /Contexto 8/ })).toBeTruthy()
  })

  it('sube al tope los contextos en uso', () => {
    setup(bigCatalog(['c8']))
    expect(poolChips()[0].getAttribute('aria-label')).toContain('Contexto 8')
    expect(poolChips()[0].querySelector('.plane-context-pool__chip-pin')).toBeTruthy()
  })

  it('chip abre el modal de asignación al clic sin hover previo', () => {
    setup(bigCatalog())
    fireEvent.click(screen.getByRole('button', { name: /Contexto 8/ }))
    expect(screen.getByRole('dialog').textContent).toContain('Contexto 8')
  })

  it('el fantasma de arrastre conserva el chip visible', () => {
    setup(bigCatalog())
    const chip = screen.getByRole('button', { name: /Contexto 8/ })
    const transfer = dragTransfer('c8')
    fireEvent.mouseDown(chip, { button: 0 })
    fireEvent.dragStart(chip, { dataTransfer: transfer })
    const [ghost] = transfer.setDragImage.mock.calls[0] as [HTMLElement]
    expect(ghost.classList.contains('plane-context-pool__chip--ghost')).toBe(true)
  })
})
