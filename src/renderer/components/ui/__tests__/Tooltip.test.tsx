/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Tooltip } from '../Tooltip'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

/** Los timers son falsos: hover + avanzar el reloj dentro de act(). */
function hover(el: HTMLElement, ms: number): void {
  fireEvent.mouseEnter(el)
  act(() => { vi.advanceTimersByTime(ms) })
}

// La ventana caliente es estado de módulo: este test va primero a propósito.
describe('Tooltip', () => {
  it('espera antes de abrir el primero', () => {
    render(<Tooltip content="folders · Folder structure"><button>a</button></Tooltip>)
    const anchor = screen.getByText('a')

    hover(anchor, 399)
    expect(screen.queryByRole('tooltip')).toBeNull()

    act(() => { vi.advanceTimersByTime(1) })
    expect(screen.getByRole('tooltip')).toBeTruthy()
  })

  it('abre el vecino sin espera dentro de la ventana caliente', () => {
    render(
      <>
        <Tooltip content="uno"><button>a</button></Tooltip>
        <Tooltip content="dos"><button>b</button></Tooltip>
      </>,
    )

    hover(screen.getByText('a'), 400)
    fireEvent.mouseLeave(screen.getByText('a'))

    hover(screen.getByText('b'), 0)
    expect(screen.getByRole('tooltip').textContent).toContain('dos')
  })

  it('no deja el tooltip pegado tras el clic', () => {
    render(<Tooltip content="uno"><button>a</button></Tooltip>)
    const anchor = screen.getByText('a')

    hover(anchor, 400)
    fireEvent.click(anchor)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('muestra el hint como segunda línea', () => {
    render(<Tooltip content="folders" hint="Clic para editar"><button>a</button></Tooltip>)

    hover(screen.getByText('a'), 400)
    const tip = screen.getByRole('tooltip')
    expect(tip.textContent).toBe('foldersClic para editar')
  })

  it('abre con hijo absolute (wrap que colapsa en titlebar music)', () => {
    render(
      <div style={{ position: 'relative', width: 40, height: 24 }}>
        <Tooltip content="Play">
          <button type="button" style={{ position: 'absolute', inset: 0 }}>
            go
          </button>
        </Tooltip>
      </div>,
    )

    hover(screen.getByText('go'), 400)
    expect(screen.getByRole('tooltip').textContent).toBe('Play')
  })

  it('se cierra al perder el foco de la ventana', () => {
    render(<Tooltip content="Play"><button>a</button></Tooltip>)
    hover(screen.getByText('a'), 400)
    expect(screen.getByRole('tooltip')).toBeTruthy()

    act(() => {
      window.dispatchEvent(new Event('blur'))
    })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('cancela el open pendiente si blur llega antes del delay', () => {
    render(<Tooltip content="Play"><button>a</button></Tooltip>)
    fireEvent.mouseEnter(screen.getByText('a'))
    act(() => { vi.advanceTimersByTime(200) })
    act(() => {
      window.dispatchEvent(new Event('blur'))
    })
    act(() => { vi.advanceTimersByTime(400) })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})
