/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { OnboardingGravityField } from '../OnboardingGravityField'

afterEach(() => {
  cleanup()
  document.documentElement.removeAttribute('data-reduce-motion')
  vi.restoreAllMocks()
})

describe('OnboardingGravityField', () => {
  it('monta sin lanzar cuando getContext devuelve null', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    expect(() => render(<OnboardingGravityField />)).not.toThrow()
  })

  it('con reduce motion no llama requestAnimationFrame', () => {
    document.documentElement.setAttribute('data-reduce-motion', 'true')
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1)
    const ctx = {
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      strokeStyle: '',
      lineWidth: 1,
      lineCap: 'round',
    } as unknown as CanvasRenderingContext2D
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)

    render(<OnboardingGravityField />)

    expect(raf).not.toHaveBeenCalled()
  })
})
