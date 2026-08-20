/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ContextTransferTarget } from '@shared/contextTransfer'
import * as contextTransfer from '@shared/contextTransfer'
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
        filePath: '/tmp/.gravity/notes.md',
      }),
      listProjectAgents: vi.fn().mockResolvedValue([]),
    },
  })
})

const transferTargets: ContextTransferTarget[] = [
  { tabId: 'tab-b', title: 'Backend', cwd: '/tmp/backend' },
  { tabId: 'tab-c', title: 'Frontend', cwd: '/tmp/frontend' },
]

function setup(overrides: Partial<PlaneContextPoolProps> = {}) {
  const onTransferContext = vi.fn()
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
      transferLabel="Enviar a…"
      transferModalTitle="Enviar contexto"
      transferEmptyHint="Abre otra pestaña con proyecto."
      transferTargets={transferTargets}
      cwd="/tmp/project"
      contexts={[
        {
          id: 'notes-1',
          name: 'Brief',
          kind: 'notes',
          kindLabel: 'Notas',
          icon: 'note',
          color: '#0aa',
        },
      ]}
      contextCatalog={[
        { id: 'notes-1', name: 'Brief', fileName: 'notes-1.md', kind: 'notes' },
      ]}
      agents={[]}
      onConfigure={vi.fn()}
      onCreate={vi.fn()}
      onOpenContext={vi.fn()}
      onDeleteContext={vi.fn()}
      onToggleAssign={vi.fn()}
      onTransferContext={onTransferContext}
      {...overrides}
    />,
  )
  return { onTransferContext }
}

const chipButton = () => screen.getByRole('button', { name: /Brief/ })

const openChipMenu = () => {
  fireEvent.contextMenu(chipButton())
  return screen.getByRole('menu')
}

const menuItems = () =>
  within(openChipMenu()).getAllByRole('menuitem').map(item => item.textContent?.trim() ?? '')

describe('PlaneContextPool — enviar contexto', () => {
  it('sin onTransferContext el menú no muestra la entrada', () => {
    setup({ onTransferContext: undefined })
    openChipMenu()
    expect(screen.queryByRole('menuitem', { name: /Enviar/ })).toBeNull()
  })

  it('con onTransferContext y contexto notes la entrada aparece entre Editar y Eliminar', () => {
    setup()
    expect(menuItems()).toEqual(['Editar', 'Enviar a…', 'Eliminar'])
  })

  it('elegir un destino llama onTransferContext con contextId y target correctos', () => {
    const { onTransferContext } = setup()
    openChipMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: /Enviar/ }))
    fireEvent.click(screen.getByRole('button', { name: /Backend/ }))
    expect(onTransferContext).toHaveBeenCalledTimes(1)
    expect(onTransferContext).toHaveBeenCalledWith('notes-1', transferTargets[0])
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('con un contexto agentResult la entrada no aparece', () => {
    expect(contextTransfer.canTransferContextKind('agentResult')).toBe(false)
    vi.spyOn(contextTransfer, 'canTransferContextKind').mockReturnValue(false)
    setup()
    openChipMenu()
    expect(screen.queryByRole('menuitem', { name: /Enviar/ })).toBeNull()
    expect(menuItems()).toEqual(['Editar', 'Eliminar'])
  })
})
