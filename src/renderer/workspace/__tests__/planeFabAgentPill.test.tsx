/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { PlaneFab } from '../PlaneFab'

afterEach(() => cleanup())

describe('PlaneFab · píldora del FAB de agente', () => {
  it('lleva la etiqueta y el atajo dentro del botón', () => {
    render(
      <PlaneFab
        kind="agent"
        label="Nuevo agente"
        hint="⌘A · Eliges proveedor y rol"
        shortcut="⌘A"
        onClick={() => {}}
      />,
    )
    const btn = screen.getByRole('button', { name: 'Nuevo agente' })
    expect(btn.classList.contains('plane-fab--expands')).toBe(true)
    expect(btn.textContent).toContain('Nuevo agente')
    expect(btn.querySelector('.plane-fab__kbd')?.textContent).toBe('⌘A')
  })

  // Sin carpeta el FAB no se abre: la píldora diría "Nuevo agente" sin explicar
  // por qué no se puede, así que ahí el Tooltip sigue siendo el que informa.
  it('deshabilitado vuelve a ser disco y conserva el Tooltip', () => {
    render(
      <PlaneFab
        kind="agent"
        label="Nuevo agente"
        shortcut="⌘A"
        disabled
        disabledTitle="Elige la carpeta del proyecto"
        onClick={() => {}}
      />,
    )
    const btn = screen.getByRole('button', { name: 'Elige la carpeta del proyecto' })
    expect(btn.classList.contains('plane-fab--expands')).toBe(false)
    expect(btn.querySelector('.plane-fab__label')).toBeNull()
  })

  it('terminal y equipo siguen siendo discos sin etiqueta', () => {
    render(<PlaneFab kind="terminal" label="Nueva terminal" onClick={() => {}} />)
    const btn = screen.getByRole('button', { name: 'Nueva terminal' })
    expect(btn.classList.contains('plane-fab--expands')).toBe(false)
    expect(btn.querySelector('.plane-fab__label')).toBeNull()
  })
})
