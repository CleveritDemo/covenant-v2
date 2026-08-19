/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { PlaneContextPool } from '../PlaneContextPool'
import { PlaneFabStack } from '../PlaneFabStack'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

afterEach(() => {
  cleanup()
})

describe('anclas de onboarding Ejecutar', () => {
  it('el pool y el FAB de terminal llevan data-onboarding para el coach mark', () => {
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
        contexts={[]}
        agents={[]}
        onConfigure={vi.fn()}
        onCreate={vi.fn()}
        onToggleAssign={vi.fn()}
      />,
    )
    render(
      <PlaneFabStack
        canAdd
        agentTitle="Agregar agente"
        terminalTitle="Agregar terminal"
        onAddAgent={vi.fn()}
        onAddTerminal={vi.fn()}
      />,
    )

    expect(document.querySelector('.plane-context-pool-shell')?.getAttribute('data-onboarding'))
      .toBe('context-pool')
    expect(document.querySelector('.plane-fab--terminal')?.getAttribute('data-onboarding'))
      .toBe('plane-terminal-fab')
  })
})
