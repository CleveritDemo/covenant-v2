/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { PlaneActivityLine } from '../PlaneActivityLine'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(1_700_000_000_000)
})
afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe('PlaneActivityLine', () => {
  it('appends a ticking elapsed clock to the label', () => {
    const startedAtMs = Date.now()
    const { container } = render(
      <PlaneActivityLine
        label="Pensando…"
        activityKey="thinking:"
        startedAtMs={startedAtMs}
      />,
    )
    const text = container.querySelector('.agent-pane__activity-text')
    expect(text?.textContent).toBe('Pensando… · 0:00')

    act(() => { vi.advanceTimersByTime(1000) })
    expect(text?.textContent).toBe('Pensando… · 0:01')
  })

  it('keeps the idle variant without a clock when the label is empty', () => {
    const { container } = render(
      <PlaneActivityLine label="" activityKey="" startedAtMs={0} />,
    )
    expect(container.querySelector('.agent-pane__activity--idle')).not.toBeNull()
    expect(container.querySelector('.agent-pane__activity-text')?.textContent).toBe('\u00A0')

    act(() => { vi.advanceTimersByTime(3000) })
    expect(container.querySelector('.agent-pane__activity-text')?.textContent).toBe('\u00A0')
  })
})
