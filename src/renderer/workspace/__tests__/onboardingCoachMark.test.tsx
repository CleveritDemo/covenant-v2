/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
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
})
