/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { PlaneMapGridParticles } from '../PlaneMapGridParticles'

function mockCanvas2d(): CanvasRenderingContext2D {
  return {
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000',
  } as unknown as CanvasRenderingContext2D
}

describe('PlaneMapGridParticles', () => {
  let rafSpy: ReturnType<typeof vi.spyOn>
  let cancelRafSpy: ReturnType<typeof vi.spyOn>
  let getContextSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    document.documentElement.removeAttribute('data-reduce-motion')
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    }))

    const ctx = mockCanvas2d()
    getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)

    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 400,
    })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => 300,
    })

    rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1)
    cancelRafSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    document.documentElement.removeAttribute('data-reduce-motion')
    rafSpy.mockRestore()
    cancelRafSpy.mockRestore()
    getContextSpy.mockRestore()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('monta canvas aria-hidden y arranca rAF con reduce-motion off', () => {
    const { container } = render(
      <div style={{ width: 400, height: 300 }}>
        <PlaneMapGridParticles />
      </div>,
    )

    const canvas = container.querySelector('canvas.plane-map-grid-particles')
    expect(canvas).toBeTruthy()
    expect(canvas?.getAttribute('aria-hidden')).toBe('true')
    expect(rafSpy).toHaveBeenCalled()
  })

  it('con data-reduce-motion=true no arranca loop rAF y limpia canvas', () => {
    document.documentElement.setAttribute('data-reduce-motion', 'true')
    const clearRect = vi.fn()
    getContextSpy.mockReturnValue({
      ...mockCanvas2d(),
      clearRect,
    } as unknown as CanvasRenderingContext2D)

    render(
      <div style={{ width: 400, height: 300 }}>
        <PlaneMapGridParticles />
      </div>,
    )

    expect(rafSpy).not.toHaveBeenCalled()
    expect(clearRect).toHaveBeenCalled()
  })
})
