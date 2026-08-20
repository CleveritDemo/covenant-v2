/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { OnboardingCoachMark } from '../OnboardingCoachMark'

afterEach(cleanup)

const ANCHOR_RECT = {
  x: 40,
  y: 40,
  top: 40,
  left: 40,
  right: 140,
  bottom: 72,
  width: 100,
  height: 32,
  toJSON: () => ({}),
}

function mountWithAnchor(
  props: React.ComponentProps<typeof OnboardingCoachMark>,
): HTMLDivElement {
  const anchor = document.createElement('div')
  anchor.setAttribute('data-onboarding', props.anchor)
  anchor.getBoundingClientRect = () => ANCHOR_RECT
  document.body.appendChild(anchor)
  render(<OnboardingCoachMark {...props} />)
  return anchor
}

/**
 * El coach ya no sella la UI: no hay prop `blocking` ni bloques que capturen
 * clics. El velo son cuatro rectángulos inertes con hueco en el control, y lo
 * único clicable es el OK de los pasos informativos.
 */
describe('OnboardingCoachMark no bloquea la UI', () => {
  it('pinta cuatro velos alrededor del hueco y ninguno captura clics', () => {
    const anchor = mountWithAnchor({
      anchor: 'test-anchor',
      message: 'Paso informativo',
    })

    const veils = document.querySelectorAll('.onboarding-coach-mark__veil')
    expect(veils).toHaveLength(4)
    expect(document.querySelectorAll('.onboarding-coach-mark__block')).toHaveLength(0)

    document.body.removeChild(anchor)
  })

  it('sin OK la tarjeta tampoco es clicable (no lleva --actionable)', () => {
    const anchor = mountWithAnchor({
      anchor: 'plain-anchor',
      message: 'Elige un agente',
    })

    const callout = document.querySelector('.onboarding-coach-mark__callout')
    expect(callout?.classList.contains('onboarding-coach-mark__callout--actionable')).toBe(false)
    expect(callout?.querySelector('button')).toBeNull()

    document.body.removeChild(anchor)
  })

  it('con OK: la tarjeta se vuelve clicable y el botón llama onDismiss', () => {
    const onDismiss = vi.fn()
    const anchor = mountWithAnchor({
      anchor: 'dismiss-anchor',
      message: 'Aquí quedan tus salas',
      onDismiss,
      dismissLabel: 'OK',
    })

    const callout = document.querySelector('.onboarding-coach-mark__callout')
    expect(callout?.classList.contains('onboarding-coach-mark__callout--actionable')).toBe(true)

    const button = screen.getByRole('button', { name: 'OK' })
    fireEvent.click(button)
    expect(onDismiss).toHaveBeenCalledTimes(1)

    document.body.removeChild(anchor)
  })

  it('OK apagado mientras falta hacer lo que el paso pide', () => {
    const onDismiss = vi.fn()
    const anchor = mountWithAnchor({
      anchor: 'disabled-anchor',
      message: 'Escribe el objetivo',
      onDismiss,
      dismissLabel: 'OK',
      dismissDisabled: true,
    })

    const button = screen.getByRole('button', { name: 'OK' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
    expect(onDismiss).not.toHaveBeenCalled()

    document.body.removeChild(anchor)
  })
})
