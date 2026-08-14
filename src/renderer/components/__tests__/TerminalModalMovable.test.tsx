/**
 * @vitest-environment jsdom
 */
import React, { useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TerminalModal } from '../TerminalModal'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

afterEach(cleanup)

function MovableHarness({
  initialPosition,
  onPositionChange,
  onClose = () => {},
}: {
  initialPosition?: { x: number; y: number }
  onPositionChange?: (pos: { x: number; y: number }) => void
  onClose?: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  return (
    <div ref={containerRef} data-testid="plane" style={{ width: 800, height: 600, position: 'relative' }}>
      <TerminalModal
        open
        movable
        title="Wiki page"
        size="sm"
        portalContainerRef={containerRef}
        boundsRef={containerRef}
        initialPosition={initialPosition}
        onPositionChange={onPositionChange}
        onClose={onClose}
      >
        <p>Body</p>
      </TerminalModal>
    </div>
  )
}

describe('TerminalModal movable', () => {
  it('movable=false mantiene portal en document.body y root centrado', () => {
    render(
      <TerminalModal open title="Settings" onClose={() => {}}>
        <p>Content</p>
      </TerminalModal>,
    )
    const root = document.querySelector('.terminal-modal-root')
    expect(root).toBeTruthy()
    expect(root?.parentElement).toBe(document.body)
    expect(root?.classList.contains('terminal-modal-root--movable')).toBe(false)
  })

  it('movable=true porta al contenedor del plano', async () => {
    render(<MovableHarness initialPosition={{ x: 120, y: 80 }} />)
    const plane = screen.getByTestId('plane')
    await waitFor(() => {
      const root = plane.querySelector('.terminal-modal-root--movable')
      expect(root).toBeTruthy()
      expect(root?.parentElement).toBe(plane)
    })
  })

  it('initialPosition fija left/top del panel', async () => {
    render(<MovableHarness initialPosition={{ x: 140, y: 90 }} />)
    const panel = screen.getByRole('dialog') as HTMLElement
    await waitFor(() => {
      expect(panel.style.left).toBe('140px')
      expect(panel.style.top).toBe('90px')
    })
  })

  it('arrastrar la titlebar mueve el panel y notifica al soltar', async () => {
    const onPositionChange = vi.fn()
    render(<MovableHarness initialPosition={{ x: 100, y: 100 }} onPositionChange={onPositionChange} />)
    const plane = screen.getByTestId('plane')
    Object.defineProperty(plane, 'clientWidth', { configurable: true, value: 800 })
    Object.defineProperty(plane, 'clientHeight', { configurable: true, value: 600 })
    const panel = screen.getByRole('dialog') as HTMLElement
    await waitFor(() => expect(panel.style.left).toBe('100px'))
    const titlebar = panel.querySelector('.terminal-modal-titlebar') as HTMLElement

    await act(async () => {
      fireEvent.pointerDown(titlebar, { clientX: 100, clientY: 100, button: 0, pointerId: 1, bubbles: true })
      fireEvent.pointerMove(window, { clientX: 160, clientY: 130, pointerId: 1, bubbles: true })
      fireEvent.pointerUp(window, { clientX: 160, clientY: 130, pointerId: 1, bubbles: true })
    })

    expect(panel.style.left).toBe('160px')
    expect(panel.style.top).toBe('130px')
    expect(onPositionChange).toHaveBeenCalledWith({ x: 160, y: 130 })
  })

  it('pointerdown en traffic close no inicia drag y cierra', async () => {
    const onClose = vi.fn()
    const onPositionChange = vi.fn()
    render(
      <MovableHarness
        initialPosition={{ x: 100, y: 100 }}
        onClose={onClose}
        onPositionChange={onPositionChange}
      />,
    )
    const plane = screen.getByTestId('plane')
    await waitFor(() => {
      expect(plane.querySelector('.terminal-modal-root--movable')).toBeTruthy()
    })
    const closeBtn = plane.querySelector(
      '.terminal-modal-traffic-btn--close',
    ) as HTMLButtonElement
    expect(closeBtn).toBeTruthy()
    await act(async () => {
      fireEvent.pointerDown(closeBtn, { button: 0, pointerId: 1, bubbles: true })
      fireEvent.pointerUp(closeBtn, { button: 0, pointerId: 1, bubbles: true })
    })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onPositionChange).not.toHaveBeenCalled()
  })
})
