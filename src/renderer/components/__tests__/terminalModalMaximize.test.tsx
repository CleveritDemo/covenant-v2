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

function MovableMaximizableHarness() {
  const containerRef = useRef<HTMLDivElement>(null)
  return (
    <div ref={containerRef} data-testid="plane" style={{ width: 800, height: 600, position: 'relative' }}>
      <TerminalModal
        open
        movable
        maximizable
        title="Context"
        size="sm"
        portalContainerRef={containerRef}
        boundsRef={containerRef}
        initialPosition={{ x: 100, y: 80 }}
        onClose={() => {}}
      >
        <p>Body</p>
      </TerminalModal>
    </div>
  )
}

describe('TerminalModal maximize', () => {
  it('sin maximizable el botón de zoom sigue deshabilitado', () => {
    render(
      <TerminalModal open title="Settings" onClose={() => {}}>
        <p>Content</p>
      </TerminalModal>,
    )
    const zoomBtn = document.querySelector(
      '.window-controls__btn--zoom',
    ) as HTMLButtonElement
    expect(zoomBtn).toBeTruthy()
    expect(zoomBtn.disabled).toBe(true)
  })

  it('con maximizable, click en zoom alterna terminal-modal-panel--maximized', async () => {
    render(
      <TerminalModal open maximizable title="Context" onClose={() => {}}>
        <p>Body</p>
      </TerminalModal>,
    )
    const panel = screen.getByRole('dialog')
    const zoomBtn = document.querySelector(
      '.window-controls__btn--zoom',
    ) as HTMLButtonElement
    expect(zoomBtn.disabled).toBe(false)

    await act(async () => {
      fireEvent.pointerDown(zoomBtn, { button: 0, pointerId: 1, bubbles: true })
    })
    expect(panel.classList.contains('terminal-modal-panel--maximized')).toBe(true)

    await act(async () => {
      fireEvent.pointerDown(zoomBtn, { button: 0, pointerId: 2, bubbles: true })
    })
    expect(panel.classList.contains('terminal-modal-panel--maximized')).toBe(false)
  })

  it('con maximizable y maximized, el panel no lleva style de posición', async () => {
    render(<MovableMaximizableHarness />)
    const panel = screen.getByRole('dialog') as HTMLElement
    await waitFor(() => {
      expect(panel.style.left).toBe('100px')
      expect(panel.style.top).toBe('80px')
    })
    const zoomBtn = document.querySelector(
      '.window-controls__btn--zoom',
    ) as HTMLButtonElement

    await act(async () => {
      fireEvent.pointerDown(zoomBtn, { button: 0, pointerId: 1, bubbles: true })
    })

    expect(panel.classList.contains('terminal-modal-panel--maximized')).toBe(true)
    expect(panel.style.left).toBe('')
    expect(panel.style.top).toBe('')
    expect(panel.style.getPropertyValue('--terminal-modal-enter-ox')).toBe('')
  })
})
