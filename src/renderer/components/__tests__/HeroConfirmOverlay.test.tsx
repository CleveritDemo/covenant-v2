/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { HeroConfirmOverlay } from '../HeroConfirmOverlay'

afterEach(cleanup)

describe('HeroConfirmOverlay', () => {
  it('busy: Espacio cancela cuando hay onCancel', () => {
    const onCancel = vi.fn()
    render(
      <HeroConfirmOverlay
        variant="busy"
        open
        title="Sincronizando…"
        hint="Espacio cancelar"
        onCancel={onCancel}
      />,
    )
    expect(screen.getByText('Espacio cancelar')).toBeTruthy()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('busy: sin onCancel no escucha Espacio', () => {
    const onCancel = vi.fn()
    render(
      <HeroConfirmOverlay
        variant="busy"
        open
        title="Sincronizando…"
      />,
    )
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    expect(onCancel).not.toHaveBeenCalled()
  })
})
