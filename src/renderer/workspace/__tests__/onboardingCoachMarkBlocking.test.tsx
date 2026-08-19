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

function queryBlocks(): NodeListOf<Element> {
  return document.querySelectorAll('.onboarding-coach-mark__block')
}

describe('OnboardingCoachMark blocking', () => {
  it('sin prop blocking: cuatro bloques solid sin clase --pass', () => {
    const anchor = mountWithAnchor({
      anchor: 'test-anchor',
      message: 'Paso informativo',
    })

    const blocks = queryBlocks()
    expect(blocks).toHaveLength(4)
    blocks.forEach((block) => {
      expect(block.getAttribute('data-onboarding-block')).toBe('solid')
      expect(block.classList.contains('onboarding-coach-mark__block--pass')).toBe(false)
    })

    document.body.removeChild(anchor)
  })

  it('blocking={false}: cuatro bloques pass con clase --pass', () => {
    const anchor = mountWithAnchor({
      anchor: 'test-anchor',
      message: 'Paso informativo',
      blocking: false,
    })

    const blocks = queryBlocks()
    expect(blocks).toHaveLength(4)
    blocks.forEach((block) => {
      expect(block.getAttribute('data-onboarding-block')).toBe('pass')
      expect(block.classList.contains('onboarding-coach-mark__block--pass')).toBe(true)
    })

    document.body.removeChild(anchor)
  })

  it('blocking={false} con onDismiss+dismissLabel: botón Entendido llama onDismiss', () => {
    const onDismiss = vi.fn()
    const anchor = mountWithAnchor({
      anchor: 'dismiss-anchor',
      message: 'Aquí quedan tus salas',
      blocking: false,
      onDismiss,
      dismissLabel: 'Entendido',
    })

    const button = screen.getByRole('button', { name: 'Entendido' })
    expect(button).toBeTruthy()
    fireEvent.click(button)
    expect(onDismiss).toHaveBeenCalledTimes(1)

    document.body.removeChild(anchor)
  })

  it('blocking={false} sin onDismiss: no hay botón', () => {
    const anchor = mountWithAnchor({
      anchor: 'plain-anchor',
      message: 'Elige un agente',
      blocking: false,
    })

    const tooltip = document.querySelector('.onboarding-coach-mark__tooltip')
    expect(tooltip?.querySelector('button')).toBeNull()

    document.body.removeChild(anchor)
  })
})
