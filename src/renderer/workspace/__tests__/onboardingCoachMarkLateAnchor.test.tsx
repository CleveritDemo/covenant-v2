/**
 * @vitest-environment jsdom
 *
 * Antes (773e9ee): si el ancla no existía al montar, el efecto hacía return
 * temprano y el coach mark quedaba ciego para siempre aunque el ancla apareciera
 * después. Después: MutationObserver reintenta hasta que el ancla existe.
 */
import React, { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { OnboardingCoachMark } from '../OnboardingCoachMark'

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
})

function stubRect(el: HTMLElement): void {
  el.getBoundingClientRect = () => ({
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
}

describe('OnboardingCoachMark late anchor', () => {
  it('pinta el coach mark cuando el ancla aparece después de montar', async () => {
    render(
      <OnboardingCoachMark
        anchor="brainstorm-goal"
        message="Escribe el objetivo"
      />,
    )

    expect(document.querySelector('.onboarding-coach-mark')).toBeNull()

    act(() => {
      const el = document.createElement('div')
      el.setAttribute('data-onboarding', 'brainstorm-goal')
      stubRect(el)
      document.body.appendChild(el)
    })

    await waitFor(() => {
      expect(document.querySelector('.onboarding-coach-mark')).toBeTruthy()
      expect(document.body.textContent).toContain('Escribe el objetivo')
    })
  })

  it('con scopeRef solo reacciona a anclas dentro del contenedor', async () => {
    const scope = document.createElement('div')
    document.body.appendChild(scope)
    const scopeRef = createRef<HTMLElement | null>()
    ;(scopeRef as React.MutableRefObject<HTMLElement | null>).current = scope

    render(
      <OnboardingCoachMark
        anchor="brainstorm-goal"
        message="Solo dentro del scope"
        scopeRef={scopeRef}
      />,
    )

    expect(document.querySelector('.onboarding-coach-mark')).toBeNull()

    act(() => {
      const outside = document.createElement('div')
      outside.setAttribute('data-onboarding', 'brainstorm-goal')
      stubRect(outside)
      document.body.appendChild(outside)
    })

    await act(async () => {
      await Promise.resolve()
    })
    expect(document.querySelector('.onboarding-coach-mark')).toBeNull()

    act(() => {
      const inside = document.createElement('div')
      inside.setAttribute('data-onboarding', 'brainstorm-goal')
      stubRect(inside)
      scope.appendChild(inside)
    })

    await waitFor(() => {
      expect(document.querySelector('.onboarding-coach-mark')).toBeTruthy()
      expect(document.body.textContent).toContain('Solo dentro del scope')
    })
  })

  it('al desmontar no deja observer activo que llame setState', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { unmount } = render(
      <OnboardingCoachMark
        anchor="brainstorm-goal"
        message="Escribe el objetivo"
      />,
    )

    expect(document.querySelector('.onboarding-coach-mark')).toBeNull()
    unmount()

    act(() => {
      const el = document.createElement('div')
      el.setAttribute('data-onboarding', 'brainstorm-goal')
      stubRect(el)
      document.body.appendChild(el)
    })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(errorSpy.mock.calls).toEqual([])
    errorSpy.mockRestore()
  })
})
