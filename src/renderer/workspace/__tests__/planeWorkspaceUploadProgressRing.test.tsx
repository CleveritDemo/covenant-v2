/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  PlaneWorkspaceUploadProgress,
  PlaneWorkspaceUploadProgressSlot,
  PLANE_WORKSPACE_UPLOAD_PROGRESS_EXIT_MS,
} from '../PlaneWorkspaceUploadProgress'

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../PlaneWorkspaceUploadProgress.css'),
  'utf8',
)

const DIAL_CIRCUMFERENCE = 2 * Math.PI * 8

afterEach(cleanup)

describe('PlaneWorkspaceUploadProgress ring', () => {
  it('expone progressbar con aria-valuenow y arco proporcional al porcentaje', () => {
    const { container } = render(
      <PlaneWorkspaceUploadProgress
        percent={42}
        ariaLabel="Publicando 42%"
        cancelLabel="Cancelar publicación"
        onCancel={vi.fn()}
      />,
    )

    const bar = screen.getByRole('progressbar', { name: 'Publicando 42%' })
    expect(bar.getAttribute('aria-valuenow')).toBe('42')
    expect(bar.classList.contains('plane-workspace-upload-progress--active')).toBe(true)

    const arc = container.querySelector('.plane-workspace-upload-progress__dial-arc') as SVGCircleElement
    expect(arc.getAttribute('stroke-dasharray')).toBe(String(DIAL_CIRCUMFERENCE))
    expect(arc.style.strokeDashoffset).toBe(String(DIAL_CIRCUMFERENCE * (1 - 42 / 100)))
  })

  it('marca complete al llegar a 100 y deshabilita cancelar en exit', () => {
    const { container, rerender } = render(
      <PlaneWorkspaceUploadProgress
        percent={100}
        ariaLabel="Publicando 100%"
        cancelLabel="Cancelar publicación"
        onCancel={vi.fn()}
      />,
    )

    expect(container.querySelector('.plane-workspace-upload-progress--complete')).toBeTruthy()

    rerender(
      <PlaneWorkspaceUploadProgress
        percent={100}
        exiting
        ariaLabel="Publicando 100%"
        cancelLabel="Cancelar publicación"
        onCancel={vi.fn()}
      />,
    )

    expect((screen.getByRole('button', { name: 'Cancelar publicación' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    expect(container.querySelector('.plane-workspace-upload-progress--exit-complete')).toBeTruthy()
  })

  it('dispara onCancel al pulsar el anillo', () => {
    const onCancel = vi.fn()
    render(
      <PlaneWorkspaceUploadProgress
        percent={15}
        ariaLabel="Publicando 15%"
        cancelLabel="Cancelar publicación"
        onCancel={onCancel}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar publicación' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('no declara elementos de la barra lineal anterior', () => {
    const { container } = render(
      <PlaneWorkspaceUploadProgress
        percent={50}
        ariaLabel="Publicando 50%"
        cancelLabel="Cancelar publicación"
        onCancel={vi.fn()}
      />,
    )

    expect(container.querySelector('.plane-workspace-upload-progress__track')).toBeNull()
    expect(container.querySelector('.plane-workspace-upload-progress__fill')).toBeNull()
    expect(container.querySelector('.plane-workspace-upload-progress__percent')).toBeNull()
    expect(container.querySelector('.plane-workspace-upload-progress__pulse')).toBeNull()
    expect(container.querySelector('.plane-workspace-upload-progress__cancel')).toBeNull()
    expect(container.querySelector('.plane-workspace-upload-progress__ring')).toBeTruthy()
  })
})

describe('PlaneWorkspaceUploadProgressSlot', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('mantiene el anillo montado durante el fade-out', () => {
    vi.useFakeTimers()
    const { rerender } = render(
      <PlaneWorkspaceUploadProgressSlot
        progress={88}
        getAriaLabel={percent => `Publicando ${percent}%`}
        cancelLabel="Cancelar publicación"
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByRole('progressbar')).toBeTruthy()

    rerender(
      <PlaneWorkspaceUploadProgressSlot
        progress={null}
        getAriaLabel={percent => `Publicando ${percent}%`}
        cancelLabel="Cancelar publicación"
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByRole('progressbar')).toBeTruthy()
    expect(screen.getByRole('progressbar').classList.contains('plane-workspace-upload-progress--exit')).toBe(
      true,
    )

    act(() => {
      vi.advanceTimersByTime(PLANE_WORKSPACE_UPLOAD_PROGRESS_EXIT_MS)
    })
    expect(screen.queryByRole('progressbar')).toBeNull()
  })
})

describe('PlaneWorkspaceUploadProgress ring CSS', () => {
  it('ocupa 20px y elimina selectores de la barra lineal', () => {
    expect(css).toMatch(/\.plane-workspace-upload-progress\s*\{[^}]*width:\s*20px/m)
    expect(css).not.toContain('__track')
    expect(css).not.toContain('__fill')
    expect(css).not.toContain('__percent')
    expect(css).not.toContain('__pulse')
    expect(css).not.toContain('__cancel')
    expect(css).not.toContain('plane-upload-progress-track-in')
    expect(css).not.toContain('plane-upload-progress-sheen')
  })

  it('reusa plane-upload-progress-pulse-complete sobre el dial al completar', () => {
    expect(css).toContain('plane-upload-progress-pulse-complete')
    expect(css).toMatch(
      /\.plane-workspace-upload-progress--complete[\s\S]*\.plane-workspace-upload-progress__dial/,
    )
  })

  it('anula animaciones en reduce motion para raíz, dial-arc y glyph', () => {
    expect(css).toContain('html[data-reduce-motion="true"]')
    expect(css).toContain('.plane-workspace-upload-progress__dial-arc')
    expect(css).toContain('.plane-workspace-upload-progress__glyph')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  })
})
