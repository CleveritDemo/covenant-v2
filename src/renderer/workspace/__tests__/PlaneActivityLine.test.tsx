/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { PlaneActivityLine } from '../PlaneActivityLine'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (key === 'agentPane.activityStale' && params?.since) {
        return `no news for ${params.since}`
      }
      return key
    },
    i18n: { language: 'en' },
  }),
}))

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

  it('does not show a stale notice with default props', () => {
    const now = Date.now()
    const { container } = render(
      <PlaneActivityLine
        label="Writing the response…"
        activityKey="writing:"
        startedAtMs={now - 60_000}
        lastEventAtMs={now - 50_000}
      />,
    )

    act(() => { vi.advanceTimersByTime(50_000) })
    expect(container.querySelector('.agent-pane__activity-stale')).toBeNull()
  })

  it('shows a stale notice after staleAfterMs without CLI events', () => {
    const now = Date.now()
    const { container } = render(
      <PlaneActivityLine
        label="Writing the response…"
        activityKey="writing:"
        startedAtMs={now - 60_000}
        lastEventAtMs={now - 41_000}
        canGoStale
      />,
    )

    expect(container.querySelector('.agent-pane__activity-stale')).not.toBeNull()
    expect(container.querySelector('.agent-pane__activity-stale')?.textContent)
      .toBe(' · no news for 0:41')
  })

  it('hides the stale notice before staleAfterMs elapses', () => {
    const now = Date.now()
    const { container } = render(
      <PlaneActivityLine
        label="Writing the response…"
        activityKey="writing:"
        startedAtMs={now - 60_000}
        lastEventAtMs={now - 39_000}
        canGoStale
      />,
    )

    expect(container.querySelector('.agent-pane__activity-stale')).toBeNull()
  })

  it('clears the stale notice when lastEventAtMs refreshes', () => {
    const now = Date.now()
    const { container, rerender } = render(
      <PlaneActivityLine
        label="Writing the response…"
        activityKey="writing:"
        startedAtMs={now - 60_000}
        lastEventAtMs={now - 45_000}
        canGoStale
      />,
    )

    expect(container.querySelector('.agent-pane__activity-stale')).not.toBeNull()

    rerender(
      <PlaneActivityLine
        label="Writing the response…"
        activityKey="writing:"
        startedAtMs={now - 60_000}
        lastEventAtMs={Date.now()}
        canGoStale
      />,
    )

    expect(container.querySelector('.agent-pane__activity-stale')).toBeNull()
  })
})
