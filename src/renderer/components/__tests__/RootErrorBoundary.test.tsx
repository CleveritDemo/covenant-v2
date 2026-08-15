/** @vitest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RootErrorBoundary } from '../RootErrorBoundary'

const reportRendererError = vi.fn()

beforeEach(() => {
  reportRendererError.mockClear()
  ;(window as unknown as { api: unknown }).api = { reportRendererError }
  // React imprime el error capturado por consola: ruido esperado en este test.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

function Boom(): React.ReactElement {
  throw new Error('explotó el render')
}

describe('RootErrorBoundary', () => {
  it('renderiza los hijos cuando no hay fallo', () => {
    render(
      <RootErrorBoundary>
        <p>contenido</p>
      </RootErrorBoundary>,
    )
    expect(screen.getByText('contenido')).toBeTruthy()
  })

  it('pinta el panel de error en vez de dejar el árbol vacío', () => {
    const { container } = render(
      <RootErrorBoundary>
        <Boom />
      </RootErrorBoundary>,
    )
    expect(container.querySelector('.root-error')).not.toBeNull()
    expect(screen.getByRole('alert').textContent).toContain('explotó el render')
  })

  it('reporta el error a main con la pila de componentes', () => {
    render(
      <RootErrorBoundary>
        <Boom />
      </RootErrorBoundary>,
    )
    expect(reportRendererError).toHaveBeenCalled()
    const payload = reportRendererError.mock.calls[0][0]
    expect(payload.source).toBe('error-boundary')
    expect(payload.message).toBe('explotó el render')
    expect(payload.stack).toBeTruthy()
    expect(payload.componentStack).toContain('Boom')
  })
})
