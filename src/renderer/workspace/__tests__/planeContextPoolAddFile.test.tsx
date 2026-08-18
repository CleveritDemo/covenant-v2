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

const ADD_FILE_LABEL = 'Agregar archivo…'

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

describe('PlaneContextPool — botón agregar archivo', () => {
  it('con onAddFile y addFileLabel renderiza el botón con ese aria-label y la clase add-file', () => {
    setup({ onAddFile: vi.fn(), addFileLabel: ADD_FILE_LABEL })
    const button = screen.getByLabelText(ADD_FILE_LABEL)
    expect(button.className).toBe('plane-context-pool__add-file')
  })

  it('el clic llama onAddFile una vez', () => {
    const onAddFile = vi.fn()
    setup({ onAddFile, addFileLabel: ADD_FILE_LABEL })
    fireEvent.click(screen.getByLabelText(ADD_FILE_LABEL))
    expect(onAddFile).toHaveBeenCalledTimes(1)
  })

  it('sin onAddFile no renderiza el botón; el de crear sigue', () => {
    setup({ addFileLabel: ADD_FILE_LABEL })
    expect(screen.queryByLabelText(ADD_FILE_LABEL)).toBeNull()
    expect(document.querySelector('.plane-context-pool__create')).toBeTruthy()
  })
})
