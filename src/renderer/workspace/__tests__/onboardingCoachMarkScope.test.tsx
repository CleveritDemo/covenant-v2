/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { OnboardingCoachMark } from '../OnboardingCoachMark'

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
})

describe('OnboardingCoachMark scopeRef', () => {
  it('ignora el ancla de una tab inactiva y mide la del plano activo', () => {
    const inactiveTab = document.createElement('div')
    const inactiveAnchor = document.createElement('div')
    inactiveAnchor.setAttribute('data-onboarding', 'composer-input')
    inactiveAnchor.getBoundingClientRect = () => ({
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
    inactiveTab.appendChild(inactiveAnchor)
    document.body.appendChild(inactiveTab)

    const activePlane = document.createElement('div')
    const activeAnchor = document.createElement('div')
    activeAnchor.setAttribute('data-onboarding', 'composer-input')
    activeAnchor.getBoundingClientRect = () => ({
      x: 200,
      y: 300,
      top: 300,
      left: 200,
      right: 600,
      bottom: 340,
      width: 400,
      height: 40,
      toJSON: () => ({}),
    })
    activePlane.appendChild(activeAnchor)
    document.body.appendChild(activePlane)

    render(
      <OnboardingCoachMark
        anchor="composer-input"
        message="Escribe tu primer mensaje"
        scopeRef={{ current: activePlane }}
      />,
    )

    expect(screen.getByText('Escribe tu primer mensaje')).toBeTruthy()
    expect(document.querySelector('.onboarding-coach-mark__highlight')).toBeTruthy()
  })

  it('sin scopeRef sigue consultando document', () => {
    const anchor = document.createElement('div')
    anchor.setAttribute('data-onboarding', 'composer-input')
    anchor.getBoundingClientRect = () => ({
      x: 200,
      y: 300,
      top: 300,
      left: 200,
      right: 600,
      bottom: 340,
      width: 400,
      height: 40,
      toJSON: () => ({}),
    })
    document.body.appendChild(anchor)

    render(
      <OnboardingCoachMark
        anchor="composer-input"
        message="Escribe tu primer mensaje"
      />,
    )

    expect(screen.getByText('Escribe tu primer mensaje')).toBeTruthy()
  })
})
