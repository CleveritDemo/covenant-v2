/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { DictationListeningOverlay } from '../DictationListeningOverlay'

afterEach(cleanup)

describe('DictationListeningOverlay', () => {
  it('renders nothing when inactive', () => {
    const { container } = render(
      <DictationListeningOverlay active={false} level={0.5} text="hola" />,
    )
    expect(container.querySelector('.dictation-listening-overlay')).toBeNull()
  })

  it('shows waveform and live text while active', () => {
    const { container } = render(
      <DictationListeningOverlay active level={0.4} text="streaming…" />,
    )
    expect(screen.getByText('streaming…')).toBeTruthy()
    expect(container.querySelectorAll('.dictation-listening-overlay__bar').length).toBeGreaterThan(8)
    expect(container.querySelector('.dictation-listening-overlay--live')).toBeTruthy()
  })

  it('uses idle pulse class when level is near zero', () => {
    const { container } = render(
      <DictationListeningOverlay active level={0} text="Te escucho…" />,
    )
    expect(container.querySelector('.dictation-listening-overlay--idle')).toBeTruthy()
  })
})
