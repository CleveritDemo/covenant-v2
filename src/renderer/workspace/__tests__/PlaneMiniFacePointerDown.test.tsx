/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PlaneMiniFace } from '../PlaneMiniFace'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}))

afterEach(cleanup)

describe('PlaneMiniFace pointerdown', () => {
  it('no arma skip ni abre en controles interactivos; el cuerpo sí abre al click', () => {
    const onOpen = vi.fn()
    const onConfigure = vi.fn()
    render(
      <PlaneMiniFace
        name="Agent"
        statusLabel="Idle"
        configLabel="Config"
        onConfigure={onConfigure}
        onOpen={onOpen}
      />,
    )

    const configBtn = screen.getByRole('button', { name: 'Config' })
    fireEvent.pointerDown(configBtn, { button: 0, bubbles: true })
    expect(onOpen).not.toHaveBeenCalled()

    const face = document.querySelector('.plane-mini-face')!
    fireEvent.click(face, { button: 0, bubbles: true })
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})
