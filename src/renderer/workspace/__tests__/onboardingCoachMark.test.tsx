/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { OnboardingCoachMark } from '../OnboardingCoachMark'

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
        message="Elige tu camino"
        stepLabel="Paso 1"
      />,
    )

    expect(document.body.textContent).toContain('Elige tu camino')
    expect(document.body.textContent).toContain('Paso 1')
    expect(document.querySelector('.onboarding-coach-mark__highlight')).toBeTruthy()
  })

  it('no monta tooltip si falta el ancla', () => {
    render(
      <OnboardingCoachMark anchor="missing-anchor" message="No debería verse" />,
    )

    expect(screen.queryByText('No debería verse')).toBeNull()
  })

  it('coloca el tooltip arriba cuando el ancla está al fondo del viewport', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 })

    const anchor = document.createElement('button')
    anchor.setAttribute('data-onboarding', 'composer-input')
    anchor.getBoundingClientRect = () => ({
      x: 200,
      y: 700,
      top: 700,
      left: 200,
      right: 400,
      bottom: 740,
      width: 200,
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

    const tooltip = document.querySelector('.onboarding-coach-mark__tooltip')
    expect(tooltip?.classList.contains('onboarding-coach-mark__tooltip--above')).toBe(true)

    document.body.removeChild(anchor)
  })

  it('con fallback 96px y ancla al fondo aplica --above y top numérico >= 8', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 })

    const anchor = document.createElement('button')
    anchor.setAttribute('data-onboarding', 'bottom-anchor')
    anchor.getBoundingClientRect = () => ({
      x: 200,
      y: 700,
      top: 700,
      left: 200,
      right: 400,
      bottom: 740,
      width: 200,
      height: 40,
      toJSON: () => ({}),
    })
    document.body.appendChild(anchor)

    render(
      <OnboardingCoachMark
        anchor="bottom-anchor"
        message="Escribe el primer mensaje"
      />,
    )

    const tooltip = document.querySelector('.onboarding-coach-mark__tooltip') as HTMLElement | null
    expect(tooltip?.classList.contains('onboarding-coach-mark__tooltip--above')).toBe(true)
    const topPx = Number.parseFloat(tooltip?.style.top ?? '')
    expect(topPx).toBeGreaterThanOrEqual(8)

    document.body.removeChild(anchor)
  })

  it('con onDismiss y dismissLabel pinta el botón y habilita el tooltip', () => {
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

    const tooltip = document.querySelector('.onboarding-coach-mark__tooltip')
    expect(tooltip?.classList.contains('onboarding-coach-mark__tooltip--actionable')).toBe(true)
    const button = screen.getByRole('button', { name: 'Entendido' })
    fireEvent.click(button)
    expect(onDismiss).toHaveBeenCalledTimes(1)

    document.body.removeChild(anchor)
  })

  it('sin onDismiss ni dismissLabel el tooltip queda igual', () => {
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

    const tooltip = document.querySelector('.onboarding-coach-mark__tooltip')
    expect(tooltip?.classList.contains('onboarding-coach-mark__tooltip--actionable')).toBe(false)
    expect(tooltip?.querySelector('button')).toBeNull()

    document.body.removeChild(anchor)
  })
})
