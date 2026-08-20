/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { coachMeasuresEqual, OnboardingCoachMark } from '../OnboardingCoachMark'

afterEach(cleanup)

describe('OnboardingCoachMark', () => {
  it('muestra el mensaje cuando existe el ancla', () => {
    const anchor = document.createElement('button')
    anchor.setAttribute('data-onboarding', 'test-anchor')
    anchor.textContent = 'Target'
    anchor.getBoundingClientRect = () => ({
      x: 40,
      y: 40,
      top: 40,
      left: 40,
      right: 140,
      bottom: 72,
      width: 100,
      height: 32,
      toJSON: () => ({}),
    })
    document.body.appendChild(anchor)

    render(
      <OnboardingCoachMark
        anchor="test-anchor"
        title="Elige tu forma de trabajar"
        message="Elige tu camino"
      />,
    )

    expect(document.body.textContent).toContain('Elige tu camino')
    expect(
      document.querySelector('.onboarding-coach-mark__title')?.textContent,
    ).toBe('Elige tu forma de trabajar')
    expect(document.querySelector('.onboarding-coach-mark__highlight')).toBeNull()
    expect(anchor.classList.contains('onboarding-coach-target')).toBe(true)
    expect(document.querySelector('.onboarding-coach-mark__caret')).not.toBeNull()
    // Velo con hueco en el control: cuatro rectángulos, ninguno captura clics.
    expect(document.querySelectorAll('.onboarding-coach-mark__veil')).toHaveLength(4)
  })

  it('no monta el globo si falta el ancla', () => {
    render(
      <OnboardingCoachMark anchor="missing-anchor" message="No debería verse" />,
    )

    expect(screen.queryByText('No debería verse')).toBeNull()
  })

  it('apunta al control desde el costado cuando el ancla es angosta', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 })

    const anchor = document.createElement('button')
    anchor.setAttribute('data-onboarding', 'composer-input')
    anchor.getBoundingClientRect = () => ({
      x: 200,
      y: 700,
      top: 700,
      left: 200,
      right: 240,
      bottom: 740,
      width: 40,
      height: 40,
      toJSON: () => ({}),
    })
    document.body.appendChild(anchor)

    render(
      <OnboardingCoachMark
        anchor="composer-input"
        message="Escribe el primer mensaje"
      />,
    )

    const callout = document.querySelector('.onboarding-coach-mark__callout')
    expect(callout?.classList.contains('onboarding-coach-mark__callout--right')).toBe(true)

    document.body.removeChild(anchor)
  })

  it('con onDismiss y dismissLabel pinta el botón y habilita el globo', () => {
    const onDismiss = vi.fn()
    const anchor = document.createElement('button')
    anchor.setAttribute('data-onboarding', 'dismiss-anchor')
    anchor.getBoundingClientRect = () => ({
      x: 40,
      y: 40,
      top: 40,
      left: 40,
      right: 140,
      bottom: 72,
      width: 100,
      height: 32,
      toJSON: () => ({}),
    })
    document.body.appendChild(anchor)

    render(
      <OnboardingCoachMark
        anchor="dismiss-anchor"
        message="Aquí quedan tus salas"
        onDismiss={onDismiss}
        dismissLabel="Entendido"
      />,
    )

    const callout = document.querySelector('.onboarding-coach-mark__callout')
    expect(callout?.classList.contains('onboarding-coach-mark__callout--actionable')).toBe(true)
    const button = screen.getByRole('button', { name: 'Entendido' })
    expect(button.className).toContain('btn--primary')
    fireEvent.click(button)
    expect(onDismiss).toHaveBeenCalledTimes(1)

    document.body.removeChild(anchor)
  })

  it('sin onDismiss ni dismissLabel el globo no captura clics', () => {
    const anchor = document.createElement('button')
    anchor.setAttribute('data-onboarding', 'plain-anchor')
    anchor.getBoundingClientRect = () => ({
      x: 40,
      y: 40,
      top: 40,
      left: 40,
      right: 140,
      bottom: 72,
      width: 100,
      height: 32,
      toJSON: () => ({}),
    })
    document.body.appendChild(anchor)

    render(
      <OnboardingCoachMark
        anchor="plain-anchor"
        message="Elige un agente"
      />,
    )

    const callout = document.querySelector('.onboarding-coach-mark__callout')
    expect(callout?.classList.contains('onboarding-coach-mark__callout--actionable')).toBe(false)
    expect(callout?.querySelector('button')).toBeNull()

    document.body.removeChild(anchor)
  })


  it('pone el radar en el control cuando el ancla es un envoltorio', () => {
    const wrapper = document.createElement('span')
    wrapper.setAttribute('data-onboarding', 'brainstorm-rail')
    const button = document.createElement('button')
    button.getBoundingClientRect = () => ({
      x: 40,
      y: 200,
      top: 200,
      left: 40,
      right: 76,
      bottom: 236,
      width: 36,
      height: 36,
      toJSON: () => ({}),
    })
    wrapper.appendChild(button)
    document.body.appendChild(wrapper)

    render(
      <OnboardingCoachMark anchor="brainstorm-rail" message="Abre el brainstorm" />,
    )

    expect(button.classList.contains('onboarding-coach-target')).toBe(true)
    expect(wrapper.classList.contains('onboarding-coach-target')).toBe(false)

    document.body.removeChild(wrapper)
  })

  it('no baja al hijo si no es un control', () => {
    const shell = document.createElement('div')
    shell.setAttribute('data-onboarding', 'context-pool')
    shell.getBoundingClientRect = () => ({
      x: 30,
      y: 400,
      top: 400,
      left: 30,
      right: 230,
      bottom: 440,
      width: 200,
      height: 40,
      toJSON: () => ({}),
    })
    const inner = document.createElement('div')
    shell.appendChild(inner)
    document.body.appendChild(shell)

    render(<OnboardingCoachMark anchor="context-pool" message="Suelta un contexto" />)

    expect(shell.classList.contains('onboarding-coach-target')).toBe(true)
    expect(inner.classList.contains('onboarding-coach-target')).toBe(false)

    document.body.removeChild(shell)
  })

  it('con dismissDisabled el OK se pinta apagado y no dispara', () => {
    const onDismiss = vi.fn()
    const anchor = document.createElement('label')
    anchor.setAttribute('data-onboarding', 'brainstorm-goal')
    anchor.getBoundingClientRect = () => ({
      x: 100,
      y: 120,
      top: 120,
      left: 100,
      right: 400,
      bottom: 168,
      width: 300,
      height: 48,
      toJSON: () => ({}),
    })
    document.body.appendChild(anchor)

    render(
      <OnboardingCoachMark
        anchor="brainstorm-goal"
        message="Escribe el objetivo"
        onDismiss={onDismiss}
        dismissLabel="OK"
        dismissDisabled
      />,
    )

    const button = screen.getByRole('button', { name: 'OK' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
    expect(onDismiss).not.toHaveBeenCalled()

    document.body.removeChild(anchor)
  })

  it('elige la copia visible del ancla cuando hay una oculta antes', () => {
    // Las tabs inactivas siguen montadas: su composer tiene el mismo
    // data-onboarding con caja 0x0 y antes ganaba, así que el coach no pintaba.
    const hidden = document.createElement('div')
    hidden.setAttribute('data-onboarding', 'composer-input')
    hidden.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      toJSON: () => ({}),
    })
    const visible = document.createElement('div')
    visible.setAttribute('data-onboarding', 'composer-input')
    visible.getBoundingClientRect = () => ({
      x: 200,
      y: 600,
      top: 600,
      left: 200,
      right: 500,
      bottom: 640,
      width: 300,
      height: 40,
      toJSON: () => ({}),
    })
    document.body.append(hidden, visible)

    render(
      <OnboardingCoachMark anchor="composer-input" message="Escribe un mensaje" />,
    )

    expect(document.body.textContent).toContain('Escribe un mensaje')
    expect(visible.classList.contains('onboarding-coach-target')).toBe(true)
    expect(hidden.classList.contains('onboarding-coach-target')).toBe(false)

    hidden.remove()
    visible.remove()
  })

  it('sigue al ancla cuando el layout la mueve', async () => {
    // Al abrir el chat el composer se desplaza: con la medida vieja el globo
    // apuntaba a donde estaba el control, no a donde está.
    let top = 400
    const anchor = document.createElement('button')
    anchor.setAttribute('data-onboarding', 'composer-agents')
    anchor.getBoundingClientRect = () => ({
      x: 100,
      y: top,
      top,
      left: 100,
      right: 220,
      bottom: top + 30,
      width: 120,
      height: 30,
      toJSON: () => ({}),
    })
    document.body.appendChild(anchor)

    render(<OnboardingCoachMark anchor="composer-agents" message="Elige un agente" />)
    const before = document.querySelector('.onboarding-coach-mark__callout') as HTMLElement
    const beforeTop = before.style.top

    top = 200
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 32))
    })

    const after = document.querySelector('.onboarding-coach-mark__callout') as HTMLElement
    expect(after.style.top).not.toBe(beforeTop)

    document.body.removeChild(anchor)
  })

  it('quita la clase radar del ancla al desmontar', () => {
    const anchor = document.createElement('button')
    anchor.setAttribute('data-onboarding', 'radar-cleanup')
    anchor.getBoundingClientRect = () => ({
      x: 40,
      y: 40,
      top: 40,
      left: 40,
      right: 140,
      bottom: 72,
      width: 100,
      height: 32,
      toJSON: () => ({}),
    })
    document.body.appendChild(anchor)

    const { unmount } = render(
      <OnboardingCoachMark anchor="radar-cleanup" message="Señal" />,
    )
    expect(anchor.classList.contains('onboarding-coach-target')).toBe(true)
    unmount()
    expect(anchor.classList.contains('onboarding-coach-target')).toBe(false)

    document.body.removeChild(anchor)
  })
})

describe('coachMeasuresEqual', () => {
  const measure = { rect: { top: 10, left: 20, width: 30, height: 40 }, holePad: 18 }

  it('iguala medidas equivalentes y distingue las que cambian', () => {
    expect(coachMeasuresEqual(measure, { ...measure })).toBe(true)
    expect(coachMeasuresEqual(null, null)).toBe(true)
    expect(coachMeasuresEqual(measure, null)).toBe(false)
    expect(
      coachMeasuresEqual(measure, { ...measure, rect: { ...measure.rect, top: 11 } }),
    ).toBe(false)
    expect(coachMeasuresEqual(measure, { ...measure, holePad: 12 })).toBe(false)
  })
})
